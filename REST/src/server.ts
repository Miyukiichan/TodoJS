require("dotenv").config();
import pg = require("pg");
const Pool = pg.Pool;
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PW,
  port: parseInt(process.env.PG_PORT),
});

import express = require("express");
var app = express();

app.use(express.json());

function queryDB(
  query: string,
  values: any[] = [],
  successFunc: Function = () => {}
): void {
  pool.connect((err, client, done) => {
    if (err) {
      throw err;
    } else {
      client.query(query, values, (err, response) => {
        if (err) {
          throw err.stack;
        } else {
          successFunc(response);
        }
      });
    }
    done();
  });
}

function queryAll(query: string, values, res) {
  queryDB(query, values, (response) => {
    res.status(200).send(response.rows);
  });
}

interface InsertField {
  name: string;
  value?: any;
  required?: boolean;
}

interface UpdateField {
  name: string;
  value?: any;
}

class UserInputError {
  message: string;
  constructor(message) {
    this.message = message;
  }
}

function Update(
  table: string,
  fields: UpdateField[],
  filter: string,
  filterValues: any[],
  body,
  successFunc: Function
): void {
  var query = `update ${table} set `;
  var values = [];
  for (var i = 0; i < fields.length; i++) {
    var { name, value } = fields[i];
    if (!name) throw "No field name provided in update statement";
    if (!value) value = body[name];
    if (value) {
      values.push(value);
      if (values.length > 1) query += ", ";
      query += `${name} = $${values.length}`;
    }
  }
  if (values.length == 0)
    throw new UserInputError("No values passed to update");
  var splitFilter = filter.split("$");
  if (splitFilter.length > 0) {
    i = values.length;
    for (var spl of splitFilter) {
      if (spl == "") continue;
      i++;
      query += ` ${spl}$${i}`;
    }
    values = values.concat(filterValues);
  }
  queryDB(query, values, successFunc);
}

function Insert(
  table: string,
  fields: InsertField[],
  body,
  successFunc: Function
): void {
  var query = `insert into ${table} (`;
  var values = [];
  for (var i = 0; i < fields.length; i++) {
    var { name, value, required } = fields[i];
    if (!name) throw "No field name provided in insert statement";
    if (!value) value = body[name];
    if (value) {
      values.push(value);
      if (values.length > 1) query += ", ";
      query += name;
    } else if (required) {
      throw new UserInputError(`Required field ${name} not provided!`);
    }
  }
  if (values.length == 0) throw "Nothing to insert!";
  query += ") values (";
  for (var i = 0; i < values.length; i++) {
    if (i != 0) query += ", ";
    query += `$${i + 1}`;
  }
  query += ")";
  queryDB(query, values, successFunc);
}

function catchUserError(res, queryFunc: Function) {
  try {
    queryFunc();
  } catch (e) {
    if (e instanceof UserInputError) {
      res.status(400).send(e.message);
    } else throw e;
  }
}

const TODO = "todo";

const ID = "id";
const SHORT_DESC = "short_desc";
const USER_ID = "user_id";
const LONG_DESC = "long_desc";
const DATE_CREATED = "date_created";
const DATE_COMPLETED = "date_completed";
const DUE_DATE = "due_date";

const USERS = "users";
const FIRST_NAME = "first_name";
const LAST_NAME = "last_name";
const EMAIL = "email";

queryDB(
  `CREATE TABLE IF NOT EXISTS ${USERS} ( \
    ${ID} SERIAL PRIMARY KEY, \
    ${FIRST_NAME} VARCHAR(255), \
    ${LAST_NAME} VARCHAR(255), \
    ${EMAIL} VARCHAR(255), \
    ${DATE_CREATED} TIMESTAMP \
    )`
);

queryDB(
  `CREATE TABLE IF NOT EXISTS ${TODO} ( \
    ${ID} SERIAL PRIMARY KEY, \
    ${USER_ID} INT, \
    ${SHORT_DESC} VARCHAR(255), \
    ${LONG_DESC} VARCHAR(1000), \
    ${DATE_CREATED} TIMESTAMP, \
    ${DATE_COMPLETED} TIMESTAMP, \
    ${DUE_DATE} TIMESTAMP, \
    CONSTRAINT fk_user \
      FOREIGN KEY(USER_ID) \
      REFERENCES USERS(ID) \
    )`
);

//TODO TABLE
app.get("/items", (req, res) => {
  const query = `SELECT * FROM ${TODO}`;
  queryAll(query, null, res);
});

app.get("/items/:id", (req, res) => {
  var values = [req.params.id];
  const query = `SELECT * FROM ${TODO} WHERE ${ID} = $1`;
  queryAll(query, values, res);
});

app.post("/items", (req, res) => {
  catchUserError(res, () => {
    Insert(
      TODO,
      [
        { name: SHORT_DESC, required: true },
        { name: USER_ID, required: true },
        { name: DATE_CREATED, value: new Date().toISOString() },
        { name: LONG_DESC },
        { name: DUE_DATE },
      ],
      req.body,
      () =>
        res
          .status(200)
          .send(`Successfully added todo item ${req.body.short_desc}`)
    );
  });
});

app.patch("/items/:id", (req, res) => {
  catchUserError(res, () => {
    const { id } = req.params;
    Update(
      TODO,
      [
        { name: SHORT_DESC },
        { name: DATE_COMPLETED },
        { name: LONG_DESC },
        { name: DUE_DATE },
      ],
      `WHERE ${ID} = $`,
      [id],
      req.body,
      () => res.status(200).send(`Successfully updated item with id ${id}`)
    );
  });
});

app.delete("/items/:id", (req, res) => {
  var values = [req.params.id];
  queryDB(`DELETE FROM ${TODO} WHERE ${ID} = $1`, values, () => {
    res.status(200).send(`Successfully deleted item with id ${values}`);
  });
});

//USER TABLE
app.get("/users", (req, res) => {
  const query = `SELECT * FROM ${USERS}`;
  queryAll(query, null, res);
});

app.get("/users/:id", (req, res) => {
  var values = [req.params.id];
  const query = `SELECT * FROM ${USERS} WHERE ${ID} = $1`;
  queryAll(query, values, res);
});

app.post("/users", (req, res) => {
  catchUserError(res, () => {
    Insert(
      USERS,
      [
        { name: EMAIL, required: true },
        { name: DATE_CREATED, value: new Date().toISOString() },
        { name: FIRST_NAME },
        { name: LAST_NAME },
      ],
      req.body,
      () =>
        res
          .status(200)
          .send(`Successfully added user with email ${req.body.email}`)
    );
  });
});

app.patch("/users/:id", (req, res) => {
  catchUserError(res, () => {
    const { id } = req.params;
    Update(
      USERS,
      [{ name: EMAIL }, { name: FIRST_NAME }, { name: LAST_NAME }],
      `WHERE ${ID} = $`,
      [id],
      req.body,
      () => res.status(200).send(`Successfully updated user with id ${id}`)
    );
  });
});

//Listen
app.listen(process.env.SERVER_PORT, () => {
  console.log("Server On");
});

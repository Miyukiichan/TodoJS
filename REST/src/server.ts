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

function queryDB(query: string, values: any[], successFunc: Function): void {
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

function Update(
  table: string,
  fields: UpdateField[],
  filters: string[],
  body,
  successFunc: Function
): void {}

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
      if (i != 0) query += ", ";
      query += name;
    } else if (required) {
      throw `Required field ${name} not provided!`;
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

queryDB(
  "create table if not exists todo (id serial primary key,\
  short_desc VARCHAR(255),\
  long_desc VARCHAR(1000),\
  date_created timestamp,\
  date_completed timestamp,\
  due_date timestamp)",
  [],
  () => {}
);

//All Items
app.get("/items", (req, res) => {
  const query = "select * from todo";
  queryAll(query, null, res);
});

//Per ID
app.get("/items/:id", (req, res) => {
  var values = [req.params.id];
  const query = "select * from todo where id = $1";
  queryAll(query, values, res);
});

app.post("/items", (req, res) => {
  Insert(
    "todo",
    [
      { name: "short_desc", required: true },
      { name: "date_created", value: new Date().toISOString() },
      { name: "long_desc" },
      { name: "due_date" },
    ],
    req.body,
    () => res.status(200).send("Successfully added " + req.body.short_desc)
  );
});

app.patch("/items/:id", (req, res) => {
  const { id } = req.params;
  Update(
    "todo",
    [
      { name: "short_desc" },
      { name: "date_created" },
      { name: "long_desc" },
      { name: "due_date" },
    ],
    [`id = ${id}`],
    req.body,
    () => res.status(200).send(`Successfully updated item id ${id}`)
  );
});

//Listen
app.listen(process.env.SERVER_PORT, () => {
  console.log("Server On");
});

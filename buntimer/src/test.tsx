import  prqljs from "prql-js";
import { DB } from "./db";

const prql = (string: TemplateStringsArray) => {
    const sql = prqljs.compile(string[0] || "");
    if (!sql) { throw new Error('PRQL compiler returned falsey value'); }
    return sql;
}

const sql = prql`
  s"WITH RECURSIVE dates(date) AS (
    VALUES('2015-10-03')
    UNION ALL
    SELECT date(date, '+1 day')
    FROM dates
    WHERE date < '2015-11-01'
  )
  SELECT date FROM dates"
`;


console.log(sql);

const db = new DB("test.db");
const res = db.query(sql).get();
console.log(res);
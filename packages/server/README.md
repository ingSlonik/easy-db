# REST API server based on Easy DB

Lite&easy database REST server based on `easy-db-node` without any necessary configuration.

Include types for TypeScript.

## Features

- The same interface in Node, Web, Mobile, Server or your own environment.
- Handling saving and removing files directly in easy-db.
- Easy reading and updating database without any special tool.
- MongoDB like queries for GET collection.

## CLI

### Install and start server in current folder

```
$ npx easy-db-server
```

### Help and configurations

```
Usage: easy-db-server --port <port> -html ./index.html

Options:
      --help           Show help                                       [boolean]
      --version        Show version number                             [boolean]
  -p, --port           PORT                                             [number]
  -h, --html           Index HTML file                                  [string]
  -t, --easy-db-token  Security token                                   [string]
  -v, --verbose        0 - no, 1 - yes                     [number] [default: 1]
  -c, --cors           Use CORS                        [boolean] [default: true]
  -s, --size           Request size limit             [string] [default: "15MB"]
```

## Code

`app` variable is the `express` instance.

```js
import { express, useCors, useToken, useEasyDB } from "easy-db-server";
// or
const { express, useEasyDB } = require("easy-db-server");

const PORT = 80;

const app = express();

useEasyDB(app, {
  verbose: 1,
  requestSizeLimit: "15MB",
  cors: true,
  token: "takenHash",
});

app.listen(PORT, () =>
  console.log(`Easy DB server is running at http://localhost:${PORT}.`)
);
```

## REST API

- `GET /api/:collection`: return whole collection optionally with `query`, `sort`, `skip` and `limit` 
- `GET /api/:collection/:id`: return one row from collection by id
- `POST /api/:collection`: create row with random id `string` and return id
- `PUT /api/:collection/:id`: replace row from collection by id
- `PATCH /api/:collection/:id`: update row (shallow merge) from collection by id
- `DELETE /api/:collection/:id`: remove whole row from collection by id

### Token

Use header `Easy-DB-Token` for your token.

### Upload files by REST API

Just sent to POST or PUT anywhere in the body `{ "type": "EASY_DB_FILE", "url": "data:image/png;base64,iVB...YI=" }`.
With GET you will receive `{ "type": "EASY_DB_FILE", "url": "/easy-db-files/j9pSCplbMx7U.png" }`

### Query, sort, skip and limit

Easy-db-server use [mingo](https://github.com/kofrasa/mingo) library that allow you to use MongoDB like query, sort, skip and limit.
For documentation on using query operators see [MongoDB](https://docs.mongodb.com/manual/reference/operator/query/).

```
GET http://localhost:80/api/user?query={"age":{"$gt":18}}&sort={"name":1,"age":-1}&skip=20&limit=10
```

## Files

- easy-db/
  - collection1.json
  - collection1-wrong-20180912.json
- easy-db-files/
  - j9pSCplbMx7U.png

### Update DB without code

Only open file and edit them.

#### `collection1.json`

```json
{
  "LnldbDWRXe8r": { "myRow": 1, "update": 1 },
  "UXnuhpl5RvVp": { "myRow": 2, "update": 36 }
}
```

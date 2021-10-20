# Easy DB

![Easy DB logo](logo.svg "Easy DB logo")

Lite&easy database for the same interface all JavaScript environments.
The same interface can be used in Node, Web, Mobile, Cloud, Server and Develop applications.

This database is NoSQL intended for developing and for less complex structures.

1. Not create any database structure, just use it. With the first called line in code the db is create itself.
2. Whole content is easy **readable** and **editable** in JSON structure.
3. Handling files directly in easy-db.

| Name                                                                                   | npm                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [Core](https://ingslonik.github.io/easy-db/packages/core)                 | `npm install easy-db-core`                               |
| [Node](https://ingslonik.github.io/easy-db/packages/node)                 | `npm install easy-db-node`                               |
| [Browser](https://ingslonik.github.io/easy-db/packages/browser)           | `npm install easy-db-browser`                            |
| [React native](https://ingslonik.github.io/easy-db/packages/react-native) | `npm install easy-db-react-native`                       |
| [Client](https://ingslonik.github.io/easy-db/packages/client)             | `npm install easy-db-client`                             |
| [Server](https://ingslonik.github.io/easy-db/packages/server)             | `npm install easy-db-server` or run `npx easy-db-server` |
| [Google Cloud](https://ingslonik.github.io/easy-db/packages/google-cloud) | `npm install easy-db-google-cloud`                       |

Include types for TypeScript.

## API interface

```js
import easyDB from "easy-db-*";
const { insert, select, update, remove, file } = easyDB(conf);

// INSERT
const idOfRow = await insert("collection1", { myRow: 1 });
const idOfRow = await insert("collection1", (id) => ({ id, myRow: 1 }));

// SELECT
const allCollection1 = await select("collection1");
const myRow1 = await select("collection1", idOfRow);

// UPDATE
await update("collection1", idOfRow, { ...myRow1, update: 1 });

// REMOVE
await remove("collection1", idOfRow); // only one row

// INSERT FILE
const idOfRow = await insert("collection1", { photo: file("data:base64...") });
// saved { photo: { url: "http://..." } }
```

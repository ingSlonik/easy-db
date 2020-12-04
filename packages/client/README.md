# Easy DB client

Lite&easy client for `easy-db-server` or other full REST server.
The same API as using the `easy-db` directly.
The same package for `browser`, `node` and `react-native`.
Not create any database structure, just use it.
MongoDB like queries for GET collection.

Include types for TypeScript.

## API

```js
import { insert, select, update, remove, file, configure } from "easy-db-client";

configure({ server: "https://example.com/api/" });

// INSERT
const idOfRow = await insert("collection1", { myRow: 1 });
const idOfRow = await insert("collection1", id => ({ id, myRow: 1 }));

// SELECT
const allCollection1 = await select("collection1");
const userRows = await select("user", { age: { $gt : 18 } });
const myRow1 = await select("collection1", idOfRow);

// UPDATE
await update("collection1", idOfRow, { ...myRow1, update: 1 });

// REMOVE
await remove("collection1", idOfRow); // only one row

// INSERT FILE
const idOfRow = await insert("collection1", { photo: file("data:base64...") });
// saved { photo: { url: "http://example.com/files/....png" } }
```

## Example of use

```js
import { select, update } from "easy-db-browser";

// Save nickname 
await update("myAppName", "nickname", nickname);

// Load nickname
const nickname = await select("myAppName", "nickname");
```

## Support

### Browser

Support for all [browsers](https://caniuse.com/?search=fetch) supported `fetch`.

#### IE <= 11

Use any `fetch polyfill`, for example [whatwg-fetch](https://www.npmjs.com/package/whatwg-fetch). 

### react-native

Full support without condition.

### node

Supported with `node-fetch`.

```js
import fetch from "node-fetch";
global.fetch = fetch;
```

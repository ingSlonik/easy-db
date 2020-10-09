# Easy DB client

Lite&easy client for `easy-db-server` or other full REST server.
The same API as using the `easy-db` directly.
The same package for browser and react-native.
Not create any database structure, just use it.

Include types for TypeScript.

## API

```js
import { insert, select, update, remove, configure } from "easy-db-client";

configure({ server: "https://example.com/api/" });

// INSERT
const idOfRow = await insert("collection1", { myRow: 1 });

// SELECT
const allCollection1 = await select("collection1");
const myRow1 = await select("collection1", idOfRow);

// UPDATE
await update("collection1", idOfRow, { ...myRow1, update: 1 });

// REMOVE
await remove("collection1", idOfRow); // only one row
```

## Example of use

```js
import { select, update } from "easy-db-browser";

// Save nickname 
await update("myAppName", "nickname", nickname);

// Load nickname
const nickname = await select("myAppName", "nickname");
```

## IE support

Use any `fetch polyfill`, for example [whatwg-fetch](https://www.npmjs.com/package/whatwg-fetch). 
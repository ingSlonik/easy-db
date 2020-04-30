# Easy DB for browser

Lite&easy database for browsers based on localStorage, powered by `easy-db-code`.
Not create any database structure, just use it.

Include types for TypeScript.

## API

```js
import { insert, select, update, remove } from "easy-db-browser";

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

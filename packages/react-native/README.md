# Easy DB for react-native

Lite&easy database for react-native, powered by `easy-db-code`.
Not create any database structure, just use it.

Include types for TypeScript.

## API

```js
import easyDB from "easy-db-react-native";
const { insert, select, update, remove } = easyDB();

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

import easyDB from "easy-db-react-native";
const { select, update } = easyDB();

// Save nickname 
await update("myAppName", "nickname", nickname);

// Load nickname
const nickname = await select("myAppName", "nickname");
```

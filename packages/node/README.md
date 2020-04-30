# Easy DB for Node.js

Lite&easy database for Node.js, based on `easy-db-code`.
Not create any database structure, just use it.

> I recommend use this tool exclusively for developing.

Include types for TypeScript.

## API

```js
import { insert, select, update, remove } from "easy-db-node";

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
import { select, update } from "easy-db-react-native";

// Save nickname 
await update("myAppName", "nickname", nickname);

// Load nickname
const nickname = await select("myAppName", "nickname");
```

## Files

* easy-db/
  * easy-db-configuration.json
  * collection1.json
  * collection1-wrong-20180912.json

### Update DB without code

Only open file and edit them.

#### `collection1.json`

```json
{
    "1" : { "myRow": 1, "update": 1 },
    "3" : { "myRow": 2, "update": 36 }
}
```

#### `easy-db-configuration.json`

```json
{
    "collection1" : {
        "lastId": 3
    }
}
```

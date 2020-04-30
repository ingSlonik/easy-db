# Easy DB Core

Core of Lite&easy database for the same interface of any implementation.
The same interface can be used in Node, Web, Mobile, Server and Develop applications.
Not create any database structure, just use it.

> I recommend use this tool exclusively for developing.

Include types for TypeScript.

## API interface

```js
import { insert, select, update, remove } from "easy-db-*";

// INSERT
const idOfRow = await insert("collection1", { myRow: 1 });

// SELECT
const allCollection1 = await select("collection1");
const myRow1 = await select("collection1", idOfRow);

// UPDATE
await update("collection1", idOfRow, { ...myRow1, update: 1 });

// DELETE
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

## Your implementation for this interface

```js
import easyDB from "easy-db-core";

type Data = { [id: string]: any };

export const { insert, select, update, remove } = easyDB({
    async saveCollection(name: string, data: Data) {
        // code for save collection
    },
    async loadCollection(name: string): Promise<null | Data> {
        // code for load collection
    },
});
```

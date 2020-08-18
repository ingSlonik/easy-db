# Easy DB Core

Core of Lite&easy database for the same interface of any implementation.
The same interface can be used in Node, Web, Mobile, Server and Develop applications.

> I recommend use this tool exclusively for developing or small projects.

Include types for TypeScript.

## Features

- The same interface in Node, Web, Mobile, Server or your own environment.
- Easy reading and updating database without any special tool.
- Handling files directly in easy-db.

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

### Save user information in browser
```js
import { select, update } from "easy-db-browser";

// Save nickname 
await update("myAppName", "nickname", nickname);

// Load nickname
const nickname = await select("myAppName", "nickname");
```

### File saving as url
```js
import { select, update, configure } from "easy-db-node";

configure({ fileFolder: "./files", fileUrl: "/files" });

// Save user with picture 
await update("myAppName", "user", {
    name: "Example User",
    // any file in base64
    photo: "data:image/png;base64,iVB...YI=",
});

// Load with picture
const user = await select("myAppName", "user");
// user = { name: "Example User", photo: "/files/1f6bef21.png" }
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

### Add your file handling 

```js

export const { insert, select, update, remove } = easyDB({
    ...
    async saveFile(base64: string): string {
        // code replace file
        return "replaced text for file";
    },
    async removeFile(filePath: string) {
        // code for remove file
    },
});
```
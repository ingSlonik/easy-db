# Easy DB for Google Cloud Storage

Lite&easy database for Node.js, based on `easy-db-code`.

> I recommend use this tool exclusively for developing or small projects.

Include types for TypeScript.

## Features

- The same interface in Node, Web, Mobile, Cloud, Server or your own environment.
- Easy reading and updating database without any special tool.
- Handling files directly in easy-db.

## API

```js
import easyDBGoogleCloud from "easy-db-google-cloud";

const { insert, select, update, remove, file } = easyDBGoogleCloud({
  bucketName: "easy-db-test",
  bucketNameFiles: "easy-db-files", // optional
  keyFilename: "keyFile.json", // for remote development
});

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
```

## Example of use

```js
// Save nickname
await update("myAppName", "nickname", nickname);

// Load nickname
const nickname = await select("myAppName", "nickname");
```

### File saving as url

```js
// Save user with picture
await update("myAppName", "user", {
  name: "Example User",
  // any file in base64
  photo: file("data:image/png;base64,iVB...YI="),
  // or
  photo: {
    type: "EASY_DB_FILE",
    url: "data:image/png;base64,iVB...YI=",
  },
});

// Load with picture
const user = await select("myAppName", "user");
// user = { name: "Example User", photo: { url: "https://.../1f6bef21.png" } }
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
  "j9pSCplbMx7U": { "myRow": 1, "update": 1 },
  "ukAK0wN8xvwK": { "myRow": 2, "update": 36 }
}
```
# REST API server based on Easy DB

Lite&easy database REST server based on `easy-db-node` without any necessary configuration.

> I recommend use this tool exclusively for developing.

Include types for TypeScript.

## Features

- The same interface in Node, Web, Mobile, Server or your own environment.
- Automatic saving files to dictionary.
- Easy reading and updating database without any special tool.
- Handling files directly in easy-db.

## CLI

### Install and start server in current folder

```
$ npx easy-db-server
```

## Files

* easy-db/
  * files/
  * collection1.json
  * collection1-wrong-20180912.json

### Update DB without code

Only open file and edit them.

#### `collection1.json`

```json
{
    "LnldbDWRXe8r" : { "myRow": 1, "update": 1 },
    "UXnuhpl5RvVp" : { "myRow": 2, "update": 36 }
}
```

import queue from "./queue";
import { getFile, replaceFileData, removeUpdatedFiles, File } from "./file";

export type Id = string;
export type Row = any;
export type Data = { [id: string]: Row };

export type Backend = {
    saveCollection: (name: string, data: Data) => Promise<void>,
    loadCollection: (name: string) => Promise<null | Data>,
    saveFile?: (base46: string) => Promise<string>,
    removeFile?: (path: string) => Promise<void>,
};

export { File } from "./file";
export type Insert = (collection: string, row: Row | ((id: Id) => Row)) => Promise<string>;
export type Select = (collection: string, id?: Id) => Promise<Data | Row>;
export type Update = (collection: string, id: Id, row: Row) => Promise<void>;
export type Remove = (collection: string, id: Id) => Promise<void>;

// queue for locking reading and writing configuration and data in the same time
let easyDBQueue = null;


// helpers

async function getData(backend: Backend, collectionName: string): Promise<Data> {
    const data = await backend.loadCollection(collectionName);

    if (data === null) {
        return {};
    } else {
        return data;
    }
}

async function setData(backend: Backend, collectionName: string, data: Data): Promise<void> {
    await backend.saveCollection(collectionName, data);
}

// API

async function insert(backend: Backend, collection: string, row: Row | ((id: Id) => Row)): Promise<Id> {
    const wholeCollection = await getData(backend, collection);

    let newId = getRandomId();
    while (newId in wholeCollection) {
        newId = getRandomId();
    }

    row = typeof row === "function" ? row(newId) : row;

    if (typeof backend.saveFile === "function") {
        wholeCollection[newId] = await replaceFileData(
            row,
            collection,
            newId,
            backend.saveFile,
            async (collection, row) => await insert(backend, collection, row),
            async (collection, id) => await select(backend, collection, id),
            async (collection, id, row) => await update(backend, collection, id, row),
        );
    } else {
        wholeCollection[newId] = row;
    }
    await setData(backend, collection, wholeCollection);

    return newId;
}
async function queueInsert(backend: Backend, collection: string, row: Row | ((id: Id) => Row)): Promise<Id> {
    easyDBQueue = queue(easyDBQueue, async () => await insert(backend, collection, row));
    return await easyDBQueue;
}

async function select(backend: Backend, collection: string, id: null | Id): Promise<null | Row> {
    const wholeCollection = await getData(backend, collection);

    if (id === null) {
        return wholeCollection;
    } else {
        if (id in wholeCollection) {
            return wholeCollection[id];
        } else {
            return null;
        }
    }
}
async function queueSelect(backend: Backend, collection: string, id: null | Id): Promise<null | Row> {
    easyDBQueue = queue(easyDBQueue, async () => await select(backend, collection, id));
    return await easyDBQueue;
}

async function update(backend: Backend, collection: string, id: Id, row: Row) {
    const wholeCollection = await getData(backend, collection);
    if (typeof backend.saveFile === "function" && typeof backend.removeFile === "function") {
        const rowWithReplacedFileData = await replaceFileData(
            row,
            collection,
            id,
            backend.saveFile,
            async (collection, row) => await insert(backend, collection, row),
            async (collection, id) => await select(backend, collection, id),
            async (collection, id, row) => await update(backend, collection, id, row),
        );
        await removeUpdatedFiles(
            rowWithReplacedFileData, 
            wholeCollection[id], 
            collection,
            id,
            backend.removeFile,
            async (collection, id) => await select(backend, collection, id),
            async (collection, id, row) => await update(backend, collection, id, row),
            async (collection, id) => await remove(backend, collection, id),
        );
        wholeCollection[id] = rowWithReplacedFileData;
    } else {
        wholeCollection[id] = row;
    }
    await setData(backend, collection, wholeCollection);
}
async function queueUpdate(backend: Backend, collection: string, id: Id, row: Row) {
    easyDBQueue = queue(easyDBQueue, async () => await update(backend, collection, id, row));
    return await easyDBQueue;
}

async function remove(backend: Backend, collection: string, id: Id) {
    const wholeCollection = await getData(backend, collection);

    if (typeof backend.removeFile === "function") {
        await removeUpdatedFiles(
            null, 
            wholeCollection[id], 
            collection,
            id,
            backend.removeFile,
            async (collection, id) => await select(backend, collection, id),
            async (collection, id, row) => await update(backend, collection, id, row),
            async (collection, id) => await remove(backend, collection, id),
        );
    }

    delete wholeCollection[id];

    await setData(backend, collection, wholeCollection);
}
async function queueRemove(backend: Backend, collection: string, id: Id) {
    easyDBQueue = queue(easyDBQueue, async () => await remove(backend, collection, id));
    return await easyDBQueue;
}

// export easyDB core

export default (backend: Backend): {
    file: (base64: string) => File,
    insert: Insert,
    select: Select,
    update: Update,
    remove: Remove,
} => {
    return {
        file(base64: string): File {
            return getFile(base64);
        },
        async insert(collection: string, row: Row | ((id: Id) => Row)) {
            return await queueInsert(backend, collection, row);
        }, 
        async select(collection: string, id?: Id) {
            return await queueSelect(backend, collection, typeof id === "string" ? id : null);
        },
        async update(collection: string, id: Id, row: Row) {
            return await queueUpdate(backend, collection, id, row);
        },
        async remove(collection: string, id: Id) {
            return await queueRemove(backend, collection, id);
        }, 
    };
};

// this package check used ids, strong random is not necessary
const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const charactersLength = characters.length;
export function getRandomId(length: number = 12) {
    let result = '';
    for (let i = 0; i < length; i++) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

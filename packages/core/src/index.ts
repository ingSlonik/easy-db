import Cache from "./cache";
import { addToQueue } from "./queue";
import { getFile, replaceFileData, removeUpdatedFiles, File } from "./file";

export type Id = string;
export type Row<T = any> = { [key: string]: T };
export type Data<T extends Row = Row<any>> = { [id: string]: T };

export interface Backend {
    // null is not use cache and number is in [ms]
    cacheExpirationTime?: null | number,
    saveCollection: (name: string, data: Data) => Promise<void>;
    loadCollection: (name: string) => Promise<null | Data>;
    saveFile?: (base46: string) => Promise<string>;
    removeFile?: (path: string) => Promise<void>;
};

interface BackendInternal {
    // queue for locking reading and writing configuration and data in the same time
    queue: null | Promise<any>,
    cache: null | Cache<Data>,
    saveCollection: (name: string, data: Data) => Promise<void>;
    loadCollection: (name: string) => Promise<null | Data>;
    saveFile?: (base46: string) => Promise<string>;
    removeFile?: (path: string) => Promise<void>;
}
export interface API {
    file: (base64: string) => File;
    insert: Insert;
    select: Select;
    update: Update;
    remove: Remove;
};

export { File } from "./file";
export interface Insert {
    (collection: string, row: Row | ((id: Id) => Row)): Promise<string>; 
};
export interface Select {
    <T extends Row>(collection: string): Promise<Data<T>>;
    <T extends Row>(collection: string, id: string): Promise<null | T>;
};
export interface Update {
    (collection: string, id: Id, row: Row): Promise<void>;
};
export interface Remove {
    (collection: string, id: Id): Promise<void>;
};


// helpers

async function getData(backend: BackendInternal, collectionName: string): Promise<Data> {
    const data = backend.cache ? 
        await backend.cache.get(backend.loadCollection, collectionName) :
        await backend.loadCollection(collectionName);

    if (data === null) {
        return {};
    } else {
        return data;
    }
}

async function setData(backend: BackendInternal, collectionName: string, data: Data): Promise<void> {
    await backend.saveCollection(collectionName, data);
    if (backend.cache)
        backend.cache.set(collectionName, data);
}

// API

async function insert(backend: BackendInternal, collection: string, row: Row | ((id: Id) => Row)): Promise<Id> {
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
async function queueInsert(backend: BackendInternal, collection: string, row: Row | ((id: Id) => Row)): Promise<Id> {
    backend.queue = addToQueue(backend.queue, async () => await insert(backend, collection, row));
    return await backend.queue;
}

async function select(backend: BackendInternal, collection: string, id: null | Id): Promise<null | Row | Data> {
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
async function queueSelect(backend: BackendInternal, collection: string, id: null | Id): Promise<null | Row> {
    backend.queue = addToQueue(backend.queue, async () => await select(backend, collection, id));
    return await backend.queue;
}

async function update(backend: BackendInternal, collection: string, id: Id, row: Row) {
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
async function queueUpdate(backend: BackendInternal, collection: string, id: Id, row: Row) {
    backend.queue = addToQueue(backend.queue, async () => await update(backend, collection, id, row));
    return await backend.queue;
}

async function remove(backend: BackendInternal, collection: string, id: Id) {
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
async function queueRemove(backend: BackendInternal, collection: string, id: Id) {
    backend.queue = addToQueue(backend.queue, async () => await remove(backend, collection, id));
    return await backend.queue;
}

// export easyDB core
export { addToQueue } from "./queue";
export { getFile as file } from "./file";

export default (backend: Backend): API => {
    const { cacheExpirationTime, ...intersection } = backend;
    
    const backendInternal: BackendInternal = {
        ...intersection,
        cache: cacheExpirationTime === null ? null : new Cache<Data>(cacheExpirationTime),
        queue: null,
    };

    return {
        file(base64: string): File {
            return getFile(base64);
        },
        async insert(collection: string, row: Row | ((id: Id) => Row)) {
            return await queueInsert(backendInternal, collection, row);
        }, 
        async select(collection: string, id?: Id) {
            return await queueSelect(backendInternal, collection, typeof id === "string" ? id : null);
        },
        async update(collection: string, id: Id, row: Row) {
            return await queueUpdate(backendInternal, collection, id, row);
        },
        async remove(collection: string, id: Id) {
            return await queueRemove(backendInternal, collection, id);
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

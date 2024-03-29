import Cache from "./cache";
import { addToQueue } from "./queue";
import { getRandomId } from "./common";
import { getFile, replaceFileData, removeUpdatedFiles, File, FileData, FILE_COLLECTION } from "./file";

export type Id = string;
export type Row<T = any> = Record<string, T>;
export type Data<T extends Row = Row<any>> = Record<string, T>;

export interface Backend {
    /**
     * Cache data for load and save.
     * If set, it is necessary to have only one process running with easy-db to function properly!
     */
    cacheExpirationTime?: null | number,
    saveCollection: (name: string, data: Data) => Promise<void>;
    loadCollection: (name: string) => Promise<null | Data>;
    saveFile?: (base46: string) => Promise<string>;
    removeFile?: (path: string) => Promise<void>;
};

interface BackendInternal {
    // queue for locking reading and writing configuration and data in the same time
    queue: null | Promise<any>,
    cache: null | Cache,
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
        await backend.cache.get(collectionName) :
        await backend.loadCollection(collectionName);

    if (data === null) {
        return {};
    } else {
        return data;
    }
}

async function setData(backend: BackendInternal, collectionName: string, data: Data): Promise<void> {
    if (backend.cache) {
        await backend.cache.set(collectionName, data);
    } else {
        await backend.saveCollection(collectionName, data);
    }
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
        const fileData = await getData(backend, FILE_COLLECTION) as FileData;

        const isFileDataChanged = await replaceFileData(
            row,
            collection,
            newId,
            fileData,
            backend.saveFile,
        );
        if (isFileDataChanged) {
            await setData(backend, FILE_COLLECTION, fileData);
        }
    }
    wholeCollection[newId] = row;
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
        const fileData = await getData(backend, FILE_COLLECTION) as FileData;

        const isFileDataChangedWithReplace = await replaceFileData(
            row,
            collection,
            id,
            fileData,
            backend.saveFile,
        );
        const isFileDataChangedWithRemove = await removeUpdatedFiles(
            wholeCollection[id],
            row,
            id,
            collection,
            fileData,
            backend.removeFile,
        );
        if (isFileDataChangedWithReplace || isFileDataChangedWithRemove) {
            await setData(backend, FILE_COLLECTION, fileData);
        }
    }
    wholeCollection[id] = row;
    await setData(backend, collection, wholeCollection);
}
async function queueUpdate(backend: BackendInternal, collection: string, id: Id, row: Row) {
    backend.queue = addToQueue(backend.queue, async () => await update(backend, collection, id, row));
    return await backend.queue;
}

async function remove(backend: BackendInternal, collection: string, id: Id) {
    const wholeCollection = await getData(backend, collection);

    if (typeof backend.removeFile === "function") {
        const fileData = await getData(backend, FILE_COLLECTION) as FileData;

        const isFileDataChanged = await removeUpdatedFiles(
            wholeCollection[id],
            null,
            id,
            collection,
            fileData,
            backend.removeFile,
        );
        if (isFileDataChanged) {
            await setData(backend, FILE_COLLECTION, fileData);
        }
    }

    delete wholeCollection[id];

    await setData(backend, collection, wholeCollection);
}
async function queueRemove(backend: BackendInternal, collection: string, id: Id) {
    backend.queue = addToQueue(backend.queue, async () => await remove(backend, collection, id));
    return await backend.queue;
}

// export easyDB core
export { getRandomId, isBase64 } from "./common";
export { addToQueue } from "./queue";
export { getFile as file } from "./file";

export default (backend: Backend): API => {
    const { cacheExpirationTime, ...intersection } = backend;
    const backendInternal: BackendInternal = {
        ...intersection,
        cache: typeof cacheExpirationTime === "number" && cacheExpirationTime > 0 ?
            new Cache(cacheExpirationTime, backend.loadCollection, backend.saveCollection) :
            null,
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

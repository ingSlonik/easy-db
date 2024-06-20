import Cache from "./cache";
import { addToQueue } from "./queue";
import { getFreeId } from "./common";
import { getFile, replaceFileData, removeUpdatedFiles, File, FileData, FILE_COLLECTION } from "./file";

export type Id = string;
export type Row<T = any> = Record<string, T>;
export type Data<T extends Row = Row<any>> = Record<Id, T>;

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
export type DBTypes = { [collection: string]: Row };
export interface API<T extends DBTypes> {
    file: (base64: string) => File;
    insert: Insert<T>;
    select: Select<T>;
    selectArray: SelectArray<T>;
    update: Update<T>;
    remove: Remove<T>;
};

export { File } from "./file";
export interface Insert<T extends DBTypes> {
    <C extends keyof T>(collection: C, row: T[C] | ((id: Id) => T[C])): Promise<string>;
};
export interface Select<T extends DBTypes> {
    <C extends keyof T>(collection: C): Promise<Record<Id, T[C]>>;
    <C extends keyof T>(collection: C, id: string): Promise<null | T[C] & { _id: Id }>;
};
export interface SelectArray<T extends DBTypes> {
    <C extends keyof T>(collection: C): Promise<Array<T[C] & { _id: Id }>>;
};
export interface Update<T extends DBTypes> {
    <C extends keyof T>(collection: C, id: Id, row: T[C]): Promise<void>;
};
export interface Remove<T extends DBTypes> {
    <C extends keyof T>(collection: C, id: Id): Promise<void>;
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

    const newId = getFreeId(wholeCollection);

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
    backend.queue = addToQueue(backend.queue, async () => await insert(backend, collection as string, row));
    return await backend.queue;
}

async function select(backend: BackendInternal, collection: string, id: null | Id): Promise<null | Row | Data> {
    const wholeCollection = await getData(backend, collection);

    if (id === null) {
        return wholeCollection;
    } else {
        if (id in wholeCollection) {
            return { ...wholeCollection[id], _id: id };
        } else {
            return null;
        }
    }
}
async function queueSelect<T>(backend: BackendInternal, collection: string, id: null | Id): Promise<null | T> {
    backend.queue = addToQueue(backend.queue, async () => await select(backend, collection, id));
    return await backend.queue;
}

async function update(backend: BackendInternal, collection: string, id: Id, row: Row) {
    const { _id, ...rowWithoutId } = row;

    const wholeCollection = await getData(backend, collection);
    if (typeof backend.saveFile === "function" && typeof backend.removeFile === "function") {
        const fileData = await getData(backend, FILE_COLLECTION) as FileData;

        const isFileDataChangedWithReplace = await replaceFileData(
            rowWithoutId,
            collection,
            id,
            fileData,
            backend.saveFile,
        );
        const isFileDataChangedWithRemove = await removeUpdatedFiles(
            wholeCollection[id],
            rowWithoutId,
            id,
            collection,
            fileData,
            backend.removeFile,
        );
        if (isFileDataChangedWithReplace || isFileDataChangedWithRemove) {
            await setData(backend, FILE_COLLECTION, fileData);
        }
    }
    wholeCollection[id] = rowWithoutId;
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

export default <T extends DBTypes>(backend: Backend): API<T> => {
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
        async insert(collection, row) {
            return await queueInsert(backendInternal, collection as string, row);
        },
        async select(collection, id?: string) {
            return await queueSelect(backendInternal, collection as string, typeof id === "string" ? id : null) as any;
        },
        async selectArray(collection) {
            const data = await queueSelect(backendInternal, collection as string, null);
            if (!data) return [];
            return Object.entries(data).map(([_id, row]) => ({ ...row, _id })) as any[];
        },
        async update(collection, id, row) {
            return await queueUpdate(backendInternal, collection as string, id, row);
        },
        async remove(collection, id) {
            return await queueRemove(backendInternal, collection as string, id);
        },
    };
};

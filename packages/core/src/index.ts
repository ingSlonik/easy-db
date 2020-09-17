import queue from "./queue";
import { getDataWithReplacedFiles, replaceFileData, removeUpdatedFiles } from "./file";

export type Id = string;
export type Row = any;
export type Data = { [id: string]: Row };

export type Backend = {
    saveCollection: (name: string, data: Data) => Promise<void>,
    loadCollection: (name: string) => Promise<null | Data>,
    saveFile?: (base46: string) => Promise<string>,
    removeFile?: (path: string) => Promise<void>,
};

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

async function insert(backend: Backend, collection: string, row: Row): Promise<Id> {
    easyDBQueue = queue(easyDBQueue, async () => {
        const wholeCollection = await getData(backend, collection);

        const newId = getRandomId();
        while (newId in wholeCollection) {}

        if (typeof backend.saveFile === "function") {
            wholeCollection[newId] = await replaceFileData(row, backend.saveFile);
        } else {
            wholeCollection[newId] = row;
        }
        await setData(backend, collection, wholeCollection);

        return newId;
    });

    return await easyDBQueue;
}

async function select(backend: Backend, collection: string, id: null | Id): Promise<null | Row> {
    easyDBQueue = queue(easyDBQueue, async () => {
        const wholeCollection = await getData(backend, collection);

        if (id === null) {
            if (typeof backend.saveFile === "function") {
                return getDataWithReplacedFiles(wholeCollection);
            } else {
                return wholeCollection;
            }
        } else {
            if (id in wholeCollection) {
                if (typeof backend.saveFile === "function") {
                    return getDataWithReplacedFiles(wholeCollection[id]);
                } else {
                    return wholeCollection[id];
                }
            } else {
                return null;
            }
        }
    });

    return await easyDBQueue;
}

async function update(backend: Backend, collection: string, id: Id, row: Row) {
    easyDBQueue = queue(easyDBQueue, async () => {
        const wholeCollection = await getData(backend, collection);
        if (typeof backend.saveFile === "function" && typeof backend.removeFile === "function") {
            const rowWithReplacedFileData = await replaceFileData(row, backend.saveFile);
            await removeUpdatedFiles(rowWithReplacedFileData, wholeCollection[id], backend.removeFile);
            wholeCollection[id] = rowWithReplacedFileData;
        } else {
            wholeCollection[id] = row;
        }
        await setData(backend, collection, wholeCollection);
    });

    return await easyDBQueue;
}

async function remove(backend: Backend, collection: string, id: Id) {
    easyDBQueue = queue(easyDBQueue, async () => {
        const wholeCollection = await getData(backend, collection);

        if (typeof backend.removeFile === "function") {
            await removeUpdatedFiles(null, wholeCollection[id], backend.removeFile);
        }

        delete wholeCollection[id];

        await setData(backend, collection, wholeCollection);
    });

    return await easyDBQueue;
}

// export easyDB core

export default (backend: Backend) => {
    return {
        async insert(collection: string, row: Row) {
            return await insert(backend, collection, row);
        }, 
        async select(collection: string, id?: Id) {
            return await select(backend, collection, typeof id === "string" ? id : null);
        },
        async update(collection: string, id: Id, row: Row) {
            return await update(backend, collection, id, row);
        },
        async remove(collection: string, id: Id) {
            return await remove(backend, collection, id);
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

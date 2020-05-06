import queue from "./queue";

type CollectionConfiguration = {
    lastId: number,
};

export type Id = string;
export type Row = any;
export type Data = { [id: string]: Row };

export type Backend = {
    saveCollection: (name: string, data: Data) => Promise<void>,
    loadCollection: (name: string) => Promise<null | Data>,
};

// globals for easyDB
const configurationCollection = "easy-db-configuration";

// queue for locking reading and writing configuration and data in the same time
let easyDBQueue = null;


// helpers

async function getConfiguration(backend: Backend, collectionName: string): Promise<CollectionConfiguration> {
    const configuration = await backend.loadCollection(configurationCollection);

    if (
        configuration !== null && 
        typeof configuration[collectionName] === "object" && 
        configuration[collectionName] !== null && 
        typeof configuration[collectionName].lastId === "number"
    ) {
        return { lastId: configuration[collectionName].lastId };
    } else {
        return { lastId: 0 };
    }
}

async function setConfiguration(backend: Backend, collectionName: string, newConfiguration: CollectionConfiguration): Promise<void> {
    const configuration = await backend.loadCollection(configurationCollection);

    if (configuration === null) {
        await backend.saveCollection(configurationCollection, { [collectionName]: newConfiguration });
    } else {
        configuration[collectionName] = newConfiguration;
        await backend.saveCollection(configurationCollection, configuration);
    }
}

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
        const configuration = await getConfiguration(backend, collection);
        const wholeCollection = await getData(backend, collection);

        const newId = configuration.lastId + 1;
        wholeCollection[String(newId)] = row;
        await setConfiguration(backend, collection, { ...configuration, lastId: newId });
        await setData(backend, collection, wholeCollection);

        return newId;
    });

    return await easyDBQueue;
}

async function select(backend: Backend, collection: string, id: null | Id): Promise<any> {
    easyDBQueue = queue(easyDBQueue, async () => {
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
    });

    return await easyDBQueue;
}

async function update(backend: Backend, collection: string, id: Id, row: Row) {
    easyDBQueue = queue(easyDBQueue, async () => {
        const wholeCollection = await getData(backend, collection);
        wholeCollection[id] = row;
        await setData(backend, collection, wholeCollection);
    });

    return await easyDBQueue;
}

async function remove(backend: Backend, collection: string, id: Id) {
    easyDBQueue = queue(easyDBQueue, async () => {
        const wholeCollection = await getData(backend, collection);

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

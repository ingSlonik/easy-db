// The same API as easy-db-core
export type Id = string;
export type Row = any;
export type Data = { [id: string]: Row };

export type File = {
    id?: string,
    type: "EASY_DB_FILE",
    url: string,
};

export type Insert = (collection: string, row: Row | ((id: Id) => Row)) => Promise<string>;
export type Select = (collection: string, id?: Id) => Promise<Data | Row>;
export type Update = (collection: string, id: Id, row: Row) => Promise<void>;
export type Remove = (collection: string, id: Id) => Promise<void>;

const configuration = {
    server: "http://localhost:80/api/"
};

export function configure({ server }: { server: string }) {
    configuration.server = server;
}

export function file(url: string): File {
    return {
        id: null,
        type: "EASY_DB_FILE",
        url,
    };
}

export const insert: Insert = async (collection, row) => {
    if (typeof row === "function") {
        const id = await insert(collection, {});
        await update(collection, id, row(id));

        return id;
    } else {
        const url = `${configuration.server}${collection}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row),
        });
        const id = await response.json();

        if (typeof id === "string") {
            return id;
        } else {
            throw new Error(JSON.stringify(id));
        }
    }
}

export const select: Select = async (collection, id) => {
    const url = `${configuration.server}${collection}${typeof id === "string" ? `/${id}` : "?easy-db-client=true"}`;
    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();

    return data;
}

export const update: Update = async (collection, id, row) => {
    const url = `${configuration.server}${collection}/${id}`;
    const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
    });
}

export const remove: Remove = async (collection, id) => {
    const url = `${configuration.server}${collection}/${id}`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
    });
}

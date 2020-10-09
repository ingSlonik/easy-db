// The same API as easy-db-core
export type Id = string;
export type Row = any;
export type Data = { [id: string]: Row };

// small change in insert, there cannot be function as row
export type Insert = (collection: string, row: Row) => Promise<string>;
export type Select = (collection: string, id?: Id) => Promise<Data | Row>;
export type Update = (collection: string, id: Id, row: Row) => Promise<void>;
export type Remove = (collection: string, id: Id) => Promise<void>;

const configuration = {
    server: "http://localhost:80/api/"
};

export function configure({ server }: { server: string }) {
    configuration.server = server;
}


export const insert: Insert = async (collection, row) => {
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
        throw new Error(id);
    }
}

export const select: Select = async (collection, id) => {
    const url = `${configuration.server}${collection}${typeof id === "string" ? `/${id}` : ""}`;
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

// The same API as easy-db-core
export type Id = string;
export type Row<T = any> = { [key: string]: T };
export type Data<T extends Row = Row<any>> = { [id: string]: T };

export type File = {
    id?: string,
    type: "EASY_DB_FILE",
    url: string,
};

export interface Insert {
    (collection: string, row: Row | ((id: Id) => Row)): Promise<string>; 
};
export interface Select {
    <T extends Row, Q extends { [key: string]: any }>(collection: string, query?: Q): Promise<Data<T>>;
    <T extends Row>(collection: string, id: string): Promise<null | T>;
};
export interface Update {
    (collection: string, id: Id, row: Row): Promise<void>;
};
export interface Remove {
    (collection: string, id: Id): Promise<void>;
};

type Configuration = {
    server: string,
    token: null | string,
};

const configuration: Configuration = {
    server: "http://localhost:80/api/",
    token: null,
};

function getHeaders(): { [header: string]: string } {
    if (typeof configuration.token === "string") {
        return {
            "Content-Type": "application/json",
            "Easy-DB-Token": configuration.token,
        };
    } else {
        return { "Content-Type": "application/json" };
    }
}

export function configure({ server, token }: { server: string, token?: string }) {
    configuration.server = server;
    configuration.token = token || null;
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
            headers: getHeaders(),
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

export const select: Select = async (collection, idOrQuery) => {
    let url = `${configuration.server}${collection}`;
    if (typeof idOrQuery === "string") {
        // SelectRow
        url += `/${idOrQuery}`;
    } else if (typeof idOrQuery === "undefined") {
        // Select whole Data
        url += "?easy-db-client=true";
    } else if (typeof idOrQuery === "object") {
        url += `?easy-db-client=true&query=${encodeURIComponent(JSON.stringify(idOrQuery))}`;
    }

    const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
    });
    const data = await response.json();

    return data;
}


export const update: Update = async (collection, id, row) => {
    const url = `${configuration.server}${collection}/${id}`;
    const response = await fetch(url, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(row),
    });
}

export const remove: Remove = async (collection, id) => {
    const url = `${configuration.server}${collection}/${id}`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: getHeaders(),
    });
}

// The same API as easy-db-core
export type Id = string;
export type Row<T = any> = { [key: string]: T };
export type Data<T extends Row = Row<any>> = { [id: string]: T };

export type File = {
    id?: string,
    type: "EASY_DB_FILE",
    url: string,
};

export type Query = {
    query?: Record<string, any>,
    projection?: Record<string, any>,
    sort?: Record<string, any>,
    skip?: number,
    limit?: number,
};

export interface Insert<T extends DBTypes> {
    <C extends keyof T>(collection: C, row: T[C] | ((id: Id) => T[C])): Promise<string>;
};
export interface Select<T extends DBTypes> {
    <C extends keyof T>(collection: C): Promise<Record<Id, T[C]>>;
    <C extends keyof T>(collection: C, idOrQuery: Query): Promise<Record<Id, T[C]>>;
    <C extends keyof T>(collection: C, idOrQuery: string): Promise<null | T[C] & { _id: Id }>;
};
export interface SelectArray<T extends DBTypes> {
    <C extends keyof T>(collection: C): Promise<Array<T[C] & { _id: Id }>>;
    <C extends keyof T>(collection: C, query: Query): Promise<Array<T[C] & { _id: Id }>>;
};
export interface Update<T extends DBTypes> {
    <C extends keyof T>(collection: C, id: Id, row: T[C]): Promise<void>;
};
export interface Remove<T extends DBTypes> {
    <C extends keyof T>(collection: C, id: Id): Promise<void>;
};

export type DBTypes = { [collection: string]: Row };
export interface API<T extends DBTypes> {
    file: (base64: string) => File;
    insert: Insert<T>;
    select: Select<T>;
    selectArray: SelectArray<T>;
    update: Update<T>;
    remove: Remove<T>;
};


type Configuration = {
    server: string,
    token: null | string,
};

export default function easyDBClient<T extends DBTypes>(configuration: Partial<Configuration>): API<T> {
    const conf: Configuration = {
        server: "http://localhost:80/",
        token: null,
        ...configuration,
    };

    const insert: Insert<T> = async (collection, row) => {
        if (typeof row === "function") {
            const id = await insert(collection, {} as any);
            await update(collection, id, row(id));

            return id;
        } else {
            const url = `${conf.server}api/${collection.toString()}`;
            const response = await fetch(url, {
                method: "POST",
                headers: getHeaders(conf),
                body: JSON.stringify(row),
            });
            const id = await response.json();

            if (typeof id === "string") {
                return id;
            } else {
                throw new Error(JSON.stringify(id));
            }
        }
    };

    const select: Select<T> = async (collection: string, idOrQuery?: string | Query) => {
        let url = `${conf.server}api/${collection}`;
        if (typeof idOrQuery === "string") {
            // SelectRow
            url += `/${idOrQuery}`;
        } else if (typeof idOrQuery === "undefined") {
            // Select whole Data
            url += "?easy-db-client=true";
        } else if (typeof idOrQuery === "object") {
            if (
                typeof idOrQuery.query === "object"
                || typeof idOrQuery.projection === "object"
                || typeof idOrQuery.sort === "object"
                || typeof idOrQuery.skip === "number"
                || typeof idOrQuery.limit === "number"
            ) {
                url += `?easy-db-client=true`;
                if (typeof idOrQuery.query === "object")
                    url += `&query=${encodeURIComponent(JSON.stringify(idOrQuery.query))}`;
                if (typeof idOrQuery.projection === "object")
                    url += `&projection=${encodeURIComponent(JSON.stringify(idOrQuery.projection))}`;
                if (typeof idOrQuery.sort === "object")
                    url += `&sort=${encodeURIComponent(JSON.stringify(idOrQuery.sort))}`;
                if (typeof idOrQuery.skip === "number")
                    url += `&skip=${encodeURIComponent(idOrQuery.skip)}`;
                if (typeof idOrQuery.limit === "number")
                    url += `&limit=${encodeURIComponent(idOrQuery.limit)}`;

            } else {
                // back compatibility
                url += `?easy-db-client=true&query=${encodeURIComponent(JSON.stringify(idOrQuery))}`;
            }
        }

        const response = await fetch(url, {
            method: "GET",
            headers: getHeaders(conf),
        });
        const data = await response.json();

        return data;
    };

    const selectArray: SelectArray<T> = async (collection: string, query?: Query) => {
        const data = await select(collection, query);

        return Object.entries(data).map(([id, row]) => ({ ...row, _id: id }));
    };

    const update: Update<T> = async (collection, id, row) => {
        const url = `${conf.server}api/${collection.toString()}/${id}`;
        const response = await fetch(url, {
            method: "PUT",
            headers: getHeaders(conf),
            body: JSON.stringify(row),
        });
    };

    const remove: Remove<T> = async (collection, id) => {
        const url = `${conf.server}api/${collection.toString()}/${id}`;
        const response = await fetch(url, {
            method: "DELETE",
            headers: getHeaders(conf),
        });
    };

    return {
        file,
        insert,
        select,
        selectArray,
        update,
        remove
    };
}

export function file(url: string): File {
    return {
        id: null,
        type: "EASY_DB_FILE",
        url,
    };
}

function getHeaders(configuration: Configuration): { [header: string]: string } {
    if (typeof configuration.token === "string") {
        return {
            "Content-Type": "application/json",
            "Easy-DB-Token": configuration.token,
        };
    } else {
        return { "Content-Type": "application/json" };
    }
}

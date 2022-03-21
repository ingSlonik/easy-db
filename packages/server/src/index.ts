import express, { Express } from "express";
import cors from "cors";

import { Query } from "mingo";
import easyDBNode, { API, Configuration as ConfigurationNode } from "easy-db-node";

export { default as express } from "express";

export type Configuration = {
    /** 0 - no verbose, 1 - one request one line */
    verbose: number,
    /**
     * Controls the maximum request body size. If this is a number, then the value specifies the number of bytes;
     * if it is a string, the value is passed to the bytes library for parsing. Defaults to '15MB'.
     */
    requestSizeLimit: number | string,
    /** Allow requests form other domains. Default is true! */
    cors: boolean,
    /** Security token for client-server connection */
    token: null | string,
} & Partial<ConfigurationNode>;

export function useEasyDB(app: Express, configuration: Partial<Configuration>, easyDB?: API) {
    const conf: Configuration = {
        verbose: 1,
        cacheExpirationTime: 15000,
        requestSizeLimit: "15MB",
        cors: true,
        token: null,
        ...configuration,
    };

    const { select, insert, update, remove } = easyDB ? easyDB : easyDBNode(conf);

    const { verbose } = conf;

    app.use(express.json({ limit: conf.requestSizeLimit }));

    if (conf.cors) {
        app.use(cors({
            methods: [ "GET", "PUT", "POST", "PATCH", "POST", "DELETE", "OPTIONS" ],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "Easy-DB-Token"
            ],
        }));
    }

    if (conf.token !== null) {
        app.use((req, res, next) => {
            const tokenFromHeader = req.headers["easy-db-token"];
    
            if (
                req.method === "OPTIONS" ||
                (typeof tokenFromHeader === "string" && tokenFromHeader === conf.token)
            ) {
                next();
            } else {
                res.status(401);
                res.send("Not authorized request.");
            }
        });
    }

    app.get("/api/:collection", async (req, res) => {
        const { collection } = req.params;

        verbose && console.log(new Date(), "GET", `/api/${collection}`);

        const data = await select(collection);

        let query = null;
        try {
            query = getJSON(req.query["query"]);
        } catch (e) {
            res.status(400);
            res.send(`Parameter query is not valid: ${e.message}`);
            return;
        }

        let projection = null;
        try {
            projection = getJSON(req.query["projection"]);
        } catch (e) {
            res.status(400);
            res.send(`Parameter projection is not valid: ${e.message}`);
            return;
        }

        let sort = null;
        try {
            sort = getJSON(req.query["sort"]);
        } catch (e) {
            res.status(400);
            res.send(`Parameter sort is not valid: ${e.message}`);
            return;
        }

        let skip = null;
        try {
            skip = getNumber(req.query["skip"]);
        } catch (e) {
            res.status(400);
            res.send(`Parameter skip is not valid: ${e.message}`);
            return;
        }

        let limit = null;
        try {
            limit = getNumber(req.query["limit"]);
        } catch (e) {
            res.status(400);
            res.send(`Parameter limit is not valid: ${e.message}`);
            return;
        }

        if (query !== null || projection !== null || sort !== null || skip !== null || limit !== null) {

            const dataForQuery = Object.keys(data).map(_id => ({ ...data[_id], _id }));
    
            const cursor = new Query(query || {}).find(dataForQuery, projection);
    
            if (sort !== null)
                cursor.sort(sort);
            
            if (skip !== null)
                cursor.skip(skip);
            
            if (limit !== null)
                cursor.limit(limit);

            const filteredData = cursor.all();

            if (req.query["easy-db-client"] === "true") {
                const easyDbData = {};
                filteredData.forEach(({ _id, ...row }) => easyDbData[_id] = row);
    
                res.type("json");
                res.send(easyDbData);
            } else {
                res.type("json");
                res.send(filteredData);
            }
        } else {
            if (req.query["easy-db-client"] === "true") {
                res.type("json");
                res.send(data);
            } else {
                const rows = Object.keys(data).map(_id => ({ ...data[_id], _id }));
    
                res.type("json");
                res.send(rows);
            }
        }
    });
    
    app.get("/api/:collection/:id", async (req, res) => {
        const { collection, id } = req.params;

        verbose && console.log(new Date(), "GET", `/api/${collection}/${id}`);

        const row = await select(collection, id);

        res.type("json");
        res.send(row !== null ? row : JSON.stringify(null));
    });
    
    app.post("/api/:collection", async (req, res) => {
        const { collection } = req.params;

        verbose && console.log(new Date(), "POST", `/api/${collection}`);

        const id = await insert(collection, req.body);

        res.type("json");
        res.send(JSON.stringify(id));
    });
    
    app.put("/api/:collection/:id", async (req, res) => {
        const { collection, id } = req.params;

        verbose && console.log(new Date(), "PUT", `/api/${collection}/${id}`);

        await update(collection, id, req.body);

        res.type("json");
        res.send(JSON.stringify(null));
    });
    
    app.patch("/api/:collection/:id", async (req, res) => {
        const { collection, id } = req.params;
        
        verbose && console.log(new Date(), "PATCH", `/api/${collection}/${id}`);

        const row = await select(collection, id);

        await update(collection, id, { ...row, ...req.body });
        res.type("json");
        res.send(JSON.stringify(null));
    });
    
    app.delete("/api/:collection/:id", async (req, res) => {
        const { collection, id } = req.params;

        verbose && console.log(new Date(), "DELETE", `/api/${collection}/${id}`);

        await remove(collection, id);
    
        res.type("json");
        res.send(JSON.stringify(null));
    });
    
    app.use("/easy-db-files", express.static("easy-db-files"));    
}

function getJSON(data: any): null | Record<string, unknown> {
    if (data) {
        const json = JSON.parse(data);
        if (json !== null && typeof json === "object" && !Array.isArray(json)) {
            return json;
        } else {
            throw new Error(`Value '${data}' is not a valid json.`);
        }
    } else {
        return null;
    }
}

function getNumber(data: any): null | number {
    if (data) {
        if (typeof data !== "string")
            throw new Error(`Value '${data}' is not a number.`);

        if (String(Number(data)) === data) {
            return Number(data);
        } else {
            throw new Error(`Value '${data}' is not a number.`);
        }
    } else {
        return null;
    }
}

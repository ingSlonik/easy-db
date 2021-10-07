import express, { Express } from "express";
import cors from "cors";

import { Query } from "mingo";
import easyDB, { Configuration as ConfigurationNode } from "easy-db-node";

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

export function useEasyDB(app: Express, configuration: Partial<Configuration>) {
    const conf: Configuration = {
        verbose: 1,
        cacheExpirationTime: 15000,
        requestSizeLimit: "15MB",
        cors: true,
        token: null,
        ...configuration,
    };

    const { select, insert, update, remove } = easyDB(conf);

    const verbose = conf.verbose;

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

        if (typeof req.query["query"] === "string") {
            let query = {};
            try {
                query = JSON.parse(req.query["query"]);
            } catch (e) {
                res.status(400);
                res.send(e.message);
                return;
            }
    
            const dataForQuery = Object.keys(data).map(_id => ({ ...data[_id], _id }));
    
            const filteredData = new Query(query).find(dataForQuery).all();
    
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

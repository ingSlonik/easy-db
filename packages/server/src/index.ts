import express from "express";
import cors from "cors";

import { Query } from 'mingo';
import { select, insert, update, remove } from "easy-db-node";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/:collection", async (req, res) => {
    const { collection } = req.params;
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
    const row = await select(collection, id);

    res.type("json");
    res.send(row !== null ? row : JSON.stringify(null));
});

app.post("/api/:collection", async (req, res) => {
    const { collection } = req.params;
    const id = await insert(collection, req.body);

    res.type("json");
    res.send(JSON.stringify(id));
});

app.put("/api/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    await update(collection, id, req.body);

    res.type("json");
    res.send(JSON.stringify(null));
});

app.delete("/api/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    await remove(collection, id);

    res.type("json");
    res.send(JSON.stringify(null));
});

app.use("/easy-db-files", express.static("easy-db-files"));

export { app };

// back compatibility
export default app;

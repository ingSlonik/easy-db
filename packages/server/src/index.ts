import express from "express";

import { select, insert, update, remove } from "easy-db-node";

const app = express();

app.use(express.json());

app.get("/api/:collection", async (req, res) => {
    const { collection } = req.params;
    const data = await select(collection);

    if (req.query["easy-db-client"] === "true") {
        res.send(JSON.stringify(data));
    } else {
        const rows = Object.values(data);
        res.send(JSON.stringify(rows));
    }
});

app.get("/api/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    const row = await select(collection, id);

    res.send(JSON.stringify(row));
});

app.post("/api/:collection", async (req, res) => {
    const { collection } = req.params;
    const id = await insert(collection, req.body);

    res.send(JSON.stringify(id));
});

app.put("/api/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    await update(collection, id, req.body);

    res.send("");
});

app.delete("/api/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    await remove(collection, id);

    res.send("");
});

app.use("/easy-db-files", express.static("easy-db-files"));

export { app };

// back compatibility
export default app;

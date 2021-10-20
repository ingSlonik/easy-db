#!/usr/bin/env node
import { resolve } from "path";
import yargs from "yargs";

import { express, useEasyDB } from "./";

const options = yargs
    .usage("Usage: easy-db-server --port <port> -html ./index.html")
    .option("p", { alias: "port", describe: "PORT", type: "number", demandOption: false })
    .option("h", { alias: "html", describe: "Index HTML file", type: "string", demandOption: false })
    .option("t", { alias: "easy-db-token", describe: "Security token", type: "string", demandOption: false })
    .argv;

const PORT = process.env.PORT || options.port || 80;
const INDEX = options.index || resolve(__dirname, "..", "serverIndex.html");
const TOKEN = process.env.EASY_DB_TOKEN || options.t || null;

const app = express();

if (typeof INDEX === "string") {
    app.get("/", function (req, res) {
        res.sendFile(INDEX);
    });
}

useEasyDB(app, {
    cors: true,
    token: typeof TOKEN === "string" ? TOKEN : null,
});

const server = app.listen(PORT, () => console.log(`Easy DB server is running at http://localhost:${PORT}.`));

export default server; // for testing

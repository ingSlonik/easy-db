#!/usr/bin/env node
import { resolve } from "path";
import { existsSync } from "fs";
import yargs from "yargs";

import { express, useEasyDB } from "./";

const options = yargs
    .usage("Usage: easy-db-server --port <port> -html ./index.html")
    .option("p", { alias: "port", describe: "PORT", type: "number", demandOption: false })
    .option("h", { alias: "html", describe: "Index HTML file", type: "string", demandOption: false })
    .option("t", { alias: "easy-db-token", describe: "Security token", type: "string", demandOption: false })
    .option("v", { alias: "verbose", describe: "0 - no, 1 - yes", type: "number", default: 1, demandOption: false })
    .option("c", { alias: "cors", describe: "Use CORS", type: "boolean", default: true, demandOption: false })
    .option("s", { alias: "size", describe: "Request size limit", type: "string", default: "15MB", demandOption: false })
    .argv;

const PORT = process.env.PORT || options.p || 80;
const TOKEN = process.env.EASY_DB_TOKEN || options.t || null;
const HTML = options.h || resolve(__dirname, "..", "serverIndex.html");

const app = express();

if (existsSync(HTML)) {
    app.get("/", function (req, res) {
        res.sendFile(HTML);
    });
} else {
    console.log(`There is not a file on "${HTML}".`);
    process.exit();
}

useEasyDB(app, {
    verbose: options.v,
    requestSizeLimit: options.s,
    cors: options.c,
    token: typeof TOKEN === "string" ? TOKEN : null,
});

const server = app.listen(PORT, () => console.log(`Easy DB server is running at http://localhost:${PORT}.`));

export default server; // for testing

#!/usr/bin/env node
import { resolve } from "path";
import yargs from "yargs";

import app from "./";

const options = yargs
    .usage("Usage: easy-db-server --port <post> -html ./index.html")
    .option("p", { alias: "port", describe: "PORT", type: "number", demandOption: false })
    .option("h", { alias: "html", describe: "Index HTML file", type: "string", demandOption: false })
    .argv;

const PORT = process.env.PORT || options.port || 80;
const INDEX = options.index || resolve(__dirname, "..", "index.html");

if (typeof INDEX === "string") {
    app.get("/", function (req, res) {
        res.sendFile(INDEX);
    });
}

const server = app.listen(PORT, () => console.log(`Easy DB server is running at http://localhost:${PORT}.`));

export default server; // for testing

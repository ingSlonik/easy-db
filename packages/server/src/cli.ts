#!/usr/bin/env node
import { resolve } from "path";
import yargs from "yargs";

import easyDBServer from "./";

const options = yargs
    .usage("Usage: easy-db-server --port <port> -html ./index.html")
    .option("c", { alias: "cors", describe: "Cross-origin resource sharing", type: "boolean", demandOption: false })
    .option("p", { alias: "port", describe: "PORT", type: "number", demandOption: false })
    .option("h", { alias: "html", describe: "Index HTML file", type: "string", demandOption: false })
    .argv;

const PORT = process.env.PORT || options.port || 80;
const INDEX = options.index || resolve(__dirname, "..", "index.html");

easyDBServer({ cors: options.cors }, app => {
    if (typeof INDEX === "string") {
        app.get("/", function (req, res) {
            res.sendFile(INDEX);
        });
    }
    
    const server = app.listen(PORT, () => console.log(`Easy DB server is running at http://localhost:${PORT}.`));    
});

// export default server; // for testing

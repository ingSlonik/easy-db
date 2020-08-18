import * as fs from "fs";
import { resolve } from "path";

import easyDB, { Data } from "easy-db-core";

const folderDB = "easy-db";

export const { insert, select, update, remove } = easyDB({
    async saveCollection(name: string, data: Data) {
        if (!fs.existsSync(folderDB)) {
            fs.mkdirSync(folderDB);
        }
        fs.writeFileSync(resolve(folderDB, `${name}.json`), JSON.stringify(data, null, "    "), "utf8");
    },
    async loadCollection(name: string): Promise<null | Data> {
        const file = resolve(folderDB, `${name}.json`);
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, "utf8");
            try {
                const data = JSON.parse(content);
                if (data !== null && typeof data === "object") {
                    return data;
                } else {
                    return null;
                }
            } catch (e) {
                // TODO: save inconsistent data
                return null;
            }
        } else {
            return null;
        }
    },
});

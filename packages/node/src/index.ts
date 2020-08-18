import { resolve, basename } from "path";
import { promises, existsSync } from "fs";
const { readFile, mkdir, writeFile, unlink } = promises;

import easyDB, { getRandomId, Data } from "easy-db-core";


type Partial<T> = {
    [P in keyof T]?: T[P];
};

type Configuration = {
    fileFolder: string,
    fileUrl: string,
    folderDB: string,
};

// One configuration for whole runtime
const configuration: Configuration = {
    fileFolder: "easy-db-files",
    fileUrl: "/easy-db-files",
    folderDB: "easy-db",
}

export function configure(config: Partial<Configuration>) {
    for (const key in config) {
        configuration[key] = config[key];
    }
}

export const { insert, select, update, remove } = easyDB({
    async saveCollection(name: string, data: Data) {
        if (!existsSync(configuration.folderDB)) {
            await mkdir(configuration.folderDB);
        }
        await writeFile(
            resolve(configuration.folderDB, `${name}.json`),
            JSON.stringify(data, null, "    "), "utf8"
        );
        return;
    },
    async loadCollection(name: string): Promise<null | Data> {
        const file = resolve(configuration.folderDB, `${name}.json`);
        if (existsSync(file)) {
            const content = await readFile(file, "utf8");
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
    async saveFile(base64: string) {
        if (!existsSync(configuration.fileFolder)) {
            await mkdir(configuration.fileFolder);
        }

        let extension = "bin";
        if (base64.startsWith("data:")) {
            const indexFrom = base64.indexOf('/');
            if (indexFrom > -1) {
                const indexTo = base64.indexOf(';base64');
                if (indexFrom < indexTo) {
                    extension = base64.substring(indexFrom + 1, indexTo);
                }
            }
        }

        const fileName = getFreeFileName(configuration.fileFolder, extension);
        await writeFile(
            resolve(configuration.fileFolder, fileName),
            Buffer.from(base64, "base64"),
        );

        return fileName;
    },
    async removeFile(path: string) {
        await unlink(resolve(configuration.fileFolder, basename(path)));
    }
});

function getFreeFileName(path: string, extension: string): string {
    const fileName = `${getRandomId()}.${extension}`;
    if (existsSync(resolve(path, fileName))) {
        return getFreeFileName(path, extension);
    } else {
        return fileName;
    }
}

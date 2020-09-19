import { resolve, basename } from "path";
import { promises, existsSync } from "fs";
const { readFile, mkdir, writeFile, unlink } = promises;

import easyDB, { getRandomId, Data } from "easy-db-core";
export * from "easy-db-core";

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

export const { insert, select, update, remove, file } = easyDB({
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

        const extension = getFileExtension(base64);
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

const regexFileExtension = new RegExp("^data:\w*\/(((\w*)\+\w*)|(\w*-(\w*))|((\w*)));base64,", "gi");
function getFileExtension(base64: string): string {
    const result = regexFileExtension.exec(base64);
    if (result && result[3] && result[3].length > 1) {
        return result[3];
    } else {
        return "bin";
    }
}

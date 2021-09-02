import { resolve, basename } from "path";
import { promises, existsSync } from "fs";
const { readFile, mkdir, writeFile, rename, unlink } = promises;

import mimeDB from "mime-db";
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
                // save inconsistent data
                const wrongFileName = `${name}-wrong-${new Date().toISOString()}.json`;
                await rename(file, resolve(configuration.folderDB, wrongFileName));
                console.error(`Collection "${name}" is not parsable. It is save to "${wrongFileName}".`);
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
            Buffer.from(getClearBase64(base64), "base64"),
        );

        return `${configuration.fileUrl}/${fileName}`;
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

// parser for most popular extensions
const regexMimeType = new RegExp("^data:(.*);base64,", "gi");
function getFileExtension(base64: string): string {
    regexMimeType.lastIndex = 0;
    const result = regexMimeType.exec(base64);
    if (result && result[1]) {
        return getExtension(result[1]);
    } else {
        return "bin";
    }
}

function getClearBase64(base64: string): string {
    const result = base64.split(';base64,');
    return result[1] || base64;
}

function getExtension(type: string): string {
    if (mimeDB[type]?.extensions) {
        return mimeDB[type]?.extensions[0];
    } else {
        return "bin";
    }
}

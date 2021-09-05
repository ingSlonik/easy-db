import { resolve, basename } from "path";
import { promises, existsSync, createReadStream, createWriteStream } from "fs";
const { mkdir, unlink } = promises;

import mimeDB from "mime-db";
import easyDB, { getRandomId, Data } from "easy-db-core";
export * from "easy-db-core";

export type Configuration = {
    /** easyDB can remember loaded data and not waste time to read files every select [ms] */
    cacheExpirationTime: null | number;
    fileFolder: string,
    fileUrl: string,
    folderDB: string,
};

export default function easyDBNode(conf: Partial<Configuration>) {
    const configuration: Configuration = {
        cacheExpirationTime: null,
        fileFolder: "easy-db-files",
        fileUrl: "/easy-db-files",
        folderDB: "easy-db",
        ...conf,
    };

    return easyDB({
        cacheExpirationTime: configuration.cacheExpirationTime,
        async saveCollection(name: string, data: Data) {
            if (!(await isDirectory(configuration.folderDB))) {
                await mkdir(configuration.folderDB);
            }
            await writeFile(
                resolve(configuration.folderDB, `${name}.json`),
                Buffer.from(JSON.stringify(data, null, "    "), "utf8")
            );
            return;
        },
        async loadCollection(name: string): Promise<null | Data> {
            const file = resolve(configuration.folderDB, `${name}.json`);
            if (await isFile(file)) {
                const content = await readFile(file);
                try {
                    const data = JSON.parse(content.toString());
                    if (data !== null && typeof data === "object") {
                        return data;
                    } else {
                        return null;
                    }
                } catch (e) {
                    // save inconsistent data
                    const wrongFileName = `${name}-wrong-${getDateFileName()}.json`;
                    // rename doesn't work when is problem
                    await writeFile(resolve(configuration.folderDB, wrongFileName), content);
                    // await copyFile(file, resolve(configuration.folderDB, wrongFileName));
                    console.error(`Collection "${name}" is not parsable. It is save to "${wrongFileName}".`);
                    return null;
                }
            } else {
                return null;
            }
        },
        async saveFile(base64: string) {
            if (!(await isDirectory(configuration.fileFolder))) {
                await mkdir(configuration.fileFolder);
            }
    
            const extension = getFileExtension(base64);
            const fileName = await getFreeFileName(configuration.fileFolder, extension);
            
            // not wait for it, it can take a log of time
            writeFile(
                resolve(configuration.fileFolder, fileName),
                Buffer.from(getClearBase64(base64), "base64"),
            );
    
            return `${configuration.fileUrl}/${fileName}`;
        },
        async removeFile(path: string) {
            await unlink(resolve(configuration.fileFolder, basename(path)));
        }
    });
}

async function getFreeFileName(path: string, extension: string): Promise<string> {
    const fileName = `${getRandomId()}.${extension}`;
    if (await isFile(resolve(path, fileName))) {
        return await getFreeFileName(path, extension);
    } else {
        return fileName;
    }
}

async function isFile(path: string): Promise<boolean> {
    return existsSync(path);
    // const stats = await stat(path);
    // return stats.isFile();
}
async function isDirectory(path: string): Promise<boolean> {
    return existsSync(path);
    // const stats = await stat(path);
    // return stats.isDirectory();  
}

// better performance
async function readFile(path: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const buffers = [];
        const stream = createReadStream(path, { flags: "r" });
        stream.on("error", err => reject(err));
        stream.on("data", chunk => buffers.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(buffers)));
    });
}
async function writeFile(path: string, buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
        const stream = createWriteStream(path, { flags: "w" });
        stream.on("error", err => reject(err));
        stream.write(buffer);
        stream.end(resolve);
    });
}

function getDateFileName(): string {
    // YYYY-MM-DDTTime
    const date = new Date();
    return `${date.getFullYear()}-${getTwoDigits(date.getMonth() + 1)}-${getTwoDigits(date.getDate())}T${date.getTime()}`;
}
function getTwoDigits(number: number): string {
    if (number < 10) {
        return `0${number}`;
    } else {
        return `${number}`;
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

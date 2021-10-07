import { resolve, basename, parse } from "path";
import { promises, existsSync, createReadStream, createWriteStream } from "fs";
const { mkdir, unlink, readdir } = promises;

import JSZip from "jszip";
import mimeDB from "mime-db";
import easyDB, { getRandomId, Data } from "easy-db-core";
export * from "easy-db-core";

type Backup = {
    folder: string,
    getActualName: () => string,
    keepName: (name: string) => boolean,
};

export type Configuration = {
    /** easyDB can remember loaded data and not waste time to read files every select [ms] */
    cacheExpirationTime: null | number;
    fileFolder: string,
    fileUrl: string,
    folderDB: string,
    // backup data. True is default settings.
    backup: boolean | Partial<Backup>,
};

export const defaultBackupConfiguration: Backup = {
    folder: "easy-db-backup",
    getActualName: () => getDayDate(new Date()),
    keepName: (name: string) => {
        const date = new Date(name);
        const now = new Date();
        const before30days = new Date();
        before30days.setDate(now.getDate() - 30);
        const before12months = new Date();
        before12months.setMonth(now.getMonth() - 12);

        return isNaN(date.getTime()) // keep not date names
            || date.getTime() > before30days.getTime() // keep every day for 30 days
            ||(date.getTime() > before12months.getTime() && date.getDate() === 1) // keep every month for 12 months
            ||(date.getDate() === 1 && date.getMonth() === 0); // keep every year forever
    },
}

export default function easyDBNode(conf: Partial<Configuration>) {
    const configuration: Configuration = {
        cacheExpirationTime: null,
        fileFolder: "easy-db-files",
        fileUrl: "/easy-db-files",
        folderDB: "easy-db",
        backup: true,
        ...conf,
    };

    return easyDB({
        cacheExpirationTime: configuration.cacheExpirationTime,
        async saveCollection(name: string, data: Data) {
            if (!(await isDirectory(configuration.folderDB))) {
                await mkdir(configuration.folderDB);
            }

            if (configuration.backup !== false) {
                const backup = configuration.backup === true ? 
                    defaultBackupConfiguration : 
                    { ...defaultBackupConfiguration , ...configuration.backup };
                
                if (!(await isDirectory(backup.folder))) {
                    await mkdir(backup.folder);
                }

                const backupName = `${backup.getActualName()}.zip`;
                const backupPath = resolve(backup.folder, backupName);
                if (!(await isFile(backupPath))) {
                    const files = await readdir(configuration.folderDB, "utf8");
                    if (files.length > 0) {
                        const zip = new JSZip();
                        
                        files.forEach(file => zip
                            .file(file, createReadStream(resolve(configuration.folderDB, file), { flags: "r" }))
                        );
                        await writeFile(backupPath, await zip.generateAsync({ type: "nodebuffer" }));
                    }

                    const backupFiles = await readdir(backup.folder, "utf8");
                    for (const backupFile of backupFiles) {
                        const { name, ext } = parse(backupFile);
                        if (ext === ".zip" && !backup.keepName(name)) {
                            await unlink(resolve(backup.folder, backupFile));
                        }
                    }
                }
            }

            await writeFile(
                resolve(configuration.folderDB, `${name}.json`),
                Buffer.from(JSON.stringify(data, null, "    "), "utf8")
            );
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
async function writeFile(path: string, file: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
        const stream = createWriteStream(path, { flags: "w" });
        stream.on("error", err => reject(err));
        stream.write(file);
        stream.end(resolve);
    });
}

function getDateFileName(): string {
    // YYYY-MM-DDTTime
    const date = new Date();
    return `${getDayDate(date)}T${date.getTime()}`;
}

/** Exported for testing */
export function getDayDate(date: Date): string {
    return `${date.getFullYear()}-${getTwoDigits(date.getMonth() + 1)}-${getTwoDigits(date.getDate())}`;
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
        return mimeDB[type].extensions[0];
    } else {
        return "bin";
    }
}

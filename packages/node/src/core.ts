import { parse } from "path";

import JSZip from "jszip";
import mimeDB from "mime-db";
import easyDB, { getRandomId, Data } from "easy-db-core";

export type FileType = "collection" | "file" | "backup";

export type Backup = {
    getActualName: () => string,
    keepName: (name: string) => boolean,
};

export type Configuration = {
    /** easyDB can remember loaded data and not waste time to read files every select [ms] */
    cacheExpirationTime: null | number;
    /** backup data. True is default settings. */
    backup: boolean | Partial<Backup>,
    saveFiles: boolean,

    isFile: (type: FileType, name: string) => Promise<boolean>,
    readFile: (type: FileType, name: string) => Promise<Buffer>,
    /** returns url of files, important for type file */
    writeFile: (type: FileType, name: string, file: Buffer) => Promise<string>,
    unlinkFile: (type: FileType, path: string) => Promise<void>,
    getFileNames: (type: FileType) => Promise<string[]>,
};

export const defaultBackupConfiguration: Backup = {
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
            || (date.getTime() > before12months.getTime() && date.getDate() === 1) // keep every month for 12 months
            || (date.getDate() === 1 && date.getMonth() === 0); // keep every year forever
    },
}

export default function easyDBNodeCore({ cacheExpirationTime, backup, saveFiles, isFile, readFile, writeFile, unlinkFile, getFileNames }: Configuration) {

    return easyDB({
        cacheExpirationTime,
        async saveCollection(name: string, data: Data) {
            // backup
            if (backup !== false) {
                const { keepName, getActualName } = backup === true ?
                    defaultBackupConfiguration :
                    { ...defaultBackupConfiguration, ...backup };

                const backupName = `${getActualName()}.zip`;
                if (!(await isFile("backup", backupName))) {
                    const files = await getFileNames("collection");
                    if (files.length > 0) {
                        const zip = new JSZip();

                        files.forEach(file => zip.file(file, readFile("collection", file)));
                        await writeFile("backup", backupName, await zip.generateAsync({ type: "nodebuffer" }));
                    }

                    const backupFiles = await getFileNames("backup");
                    for (const backupFile of backupFiles) {
                        const { name, ext } = parse(backupFile);
                        if (ext === ".zip" && !keepName(name)) {
                            await unlinkFile("backup", backupFile);
                        }
                    }
                }
            }

            // save collection
            await writeFile("collection", `${name}.json`, Buffer.from(JSON.stringify(data, null, "\t"), "utf8"));
        },
        async loadCollection(name: string): Promise<null | Data> {
            const file = `${name}.json`;
            if (await isFile("collection", file)) {
                const content = await readFile("collection", file);
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
                    await writeFile("collection", wrongFileName, content);
                    // await copyFile(file, resolve(configuration.folderDB, wrongFileName));
                    console.error(`Collection "${name}" is not parsable. It is save to "${wrongFileName}".`);
                    return null;
                }
            } else {
                return null;
            }
        },
        saveFile: !saveFiles ? undefined : async (base64: string) => {
            const extension = getFileExtension(base64);
            const name = await getFreeName("file", extension, isFile);

            return await writeFile("file", name, Buffer.from(getClearBase64(base64), "base64"));
        },
        removeFile: !saveFiles ? undefined : async (path: string) => {
            if (await isFile("file", path)) {
                await unlinkFile("file", path);
            }
        }
    });
}

async function getFreeName(type: FileType, extension: string, isFile: (type: FileType, name: string) => Promise<boolean>): Promise<string> {
    const name = `${getRandomId()}.${extension}`;
    if (await isFile(type, name)) {
        return await getFreeName(type, extension, isFile);
    } else {
        return name;
    }
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

export function getExtension(type: string): string {
    if (mimeDB[type]?.extensions) {
        // @ts-ignore
        return mimeDB[type].extensions[0];
    } else {
        return "bin";
    }
}

// TODO: improve performance
export function getType(extension: string): string {
    // .json -> json
    const ext = extension.replace(".", "");
    for (const type in mimeDB) {
        if (Array.isArray(mimeDB[type].extensions) && (mimeDB[type].extensions as string[]).includes(ext)) {
            return type;
        }
    }

    return "application/binary";
}

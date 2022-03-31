import { promises, existsSync, createReadStream, createWriteStream } from "fs";
import { resolve, basename } from "path";
const { mkdir, unlink, readdir } = promises;

import easyDBNodeCore, { FileType, Backup, Configuration as ConfigurationCore } from "./core";

export * from "easy-db-core";
export { default as easyDBNodeCore, defaultBackupConfiguration, getDayDate, getExtension, getType, Backup, FileType } from "./core";

export type Configuration = Pick<ConfigurationCore, "cacheExpirationTime"> & {
    fileFolder: null | string,
    fileUrl: string,
    folderDB: string,
    /** back compatibility */
    backupFolder?: string,
    backup: boolean | (Backup & {
        /** OBSOLETE - back compatibility */
        folder?: string,
    });
};

export default function easyDBNode(conf: Partial<Configuration>) {
    const configuration: Configuration = {
        cacheExpirationTime: 1000,
        fileFolder: "easy-db-files",
        fileUrl: "/easy-db-files",
        folderDB: "easy-db",
        backupFolder: typeof conf.backup === "object" && conf.backup.folder ? conf.backup.folder : "easy-db-backup",
        backup: true,
        ...conf,
    };

    const { cacheExpirationTime, fileFolder, fileUrl, folderDB, backupFolder, backup } = configuration;

    function resolveFolder(type: FileType, ...paths: string[]): string {
        switch (type) {
            case "collection": return resolve(folderDB, ...paths);
            case "file":
                if (fileFolder) {
                    return resolve(fileFolder, ...paths);
                } else {
                    throw new Error("Not set folder for files.");
                }
            case "backup":
                if (backupFolder) {
                    return resolve(backupFolder, ...paths);
                } else {
                    throw new Error("Not set folder for backup.");
                }
        }
    }

    return easyDBNodeCore({
        saveFiles: fileFolder !== null,
        cacheExpirationTime,
        backup,
        async isFile(type, name) {
            if (name.length === 0) {
                console.warn("File name is not specified.");
                return false;
            }
            return existsSync(resolveFolder(type, name));
        },
        async getFileNames(type) {
            const folder = resolveFolder(type);
            if (await isDirectory(folder)) {
                return readdir(resolveFolder(type), "utf-8");
            } else {
                return [];
            }
        },
        async readFile(type, name) {
            return readFile(resolveFolder(type, name));
        },
        async writeFile(type, name, file) {
            const folder = resolveFolder(type);
            if (!(await isDirectory(folder))) {
                await mkdir(folder);
            }

            const path = resolveFolder(type, name);
            if (type === "file") {
                // not wait for it, it can take a log of time
                writeFile(path, file);
                return `${fileUrl}/${name}`;
            } else {
                await writeFile(path, file);
                return path
            }
        },
        async unlinkFile(type, name) {
            const path = resolveFolder(type, basename(name));
            if (existsSync(path)) {
                await unlink(path);
            }
        },
    });
}

// better performance
async function readFile(path: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const buffers: Buffer[] = [];
        const stream = createReadStream(path, { flags: "r" });
        stream.on("error", err => reject(err));
        stream.on("data", chunk => buffers.push(chunk as Buffer));
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

async function isDirectory(path: string): Promise<boolean> {
    return existsSync(path);
    // const stats = await stat(path);
    // return stats.isDirectory();  
}

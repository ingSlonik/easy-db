import { promises, existsSync } from "fs";
import { resolve, basename } from "path";
const { mkdir, unlink, readdir, readFile: fsReadFile, writeFile: fsWriteFile, rename, stat } = promises;

import easyDBNodeCore, { FileType, Backup, Configuration as ConfigurationCore } from "./core";

import { DBTypes } from "easy-db-core";

export * from "easy-db-core";
export { default as easyDBNodeCore, defaultBackupConfiguration, getDayDate, getExtension, getType, NodeAPI, Backup, FileType } from "./core";

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

export default function easyDBNode<T extends DBTypes>(conf: Partial<Configuration>) {
    const configuration: Configuration = {
        cacheExpirationTime: null,
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

    return easyDBNodeCore<T>({
        saveFiles: fileFolder !== null,
        cacheExpirationTime,
        backup,
        async isFile(type, name) {
            if (name.length === 0) {
                console.warn("File name is not specified.");
                return false;
            }
            if (type === "file")
                name = basename(name);

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
            return fsReadFile(resolveFolder(type, name));
        },
        async writeFile(type, name, file) {
            const folder = resolveFolder(type);
            if (!(await isDirectory(folder))) {
                await mkdir(folder, { recursive: true });
            }

            const path = resolveFolder(type, name);
            await atomicWriteFile(path, file);

            if (type === "file") {
                return `${fileUrl}/${name}`;
            } else {
                return path;
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

async function atomicWriteFile(path: string, file: Buffer): Promise<void> {
    const tmpPath = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fsWriteFile(tmpPath, file);
    await rename(tmpPath, path);
}

async function isDirectory(path: string): Promise<boolean> {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}


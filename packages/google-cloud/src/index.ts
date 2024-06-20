import { parse } from "path";

import { Storage, File, Bucket } from "@google-cloud/storage";

import { easyDBNodeCore, getType, Backup, Configuration as NodeConfiguration, FileType, DBTypes } from "easy-db-node";

export { file, DBTypes, File } from "easy-db-node";

export type Configuration = Pick<NodeConfiguration, "cacheExpirationTime"> & {
    bucketName: string,
    /**
     * If is not set, the files will not be convert to URL.
     * The bucketNameFiles should be public for `allUsers`.
     */
    bucketNameFiles?: string,
    bucketNameBackup?: string,
    projectId?: string,
    keyFilename?: string,
    backup?: Backup,
};

export default function easyDBGoogleCloud<T extends DBTypes>(configuration: Configuration) {
    const {
        bucketName, bucketNameFiles, bucketNameBackup, keyFilename, projectId,
        cacheExpirationTime, backup
    } = configuration;

    const storage = new Storage({ keyFilename, projectId });
    const bucketCollection = storage.bucket(bucketName);
    const bucketFiles = bucketNameFiles ? storage.bucket(bucketNameFiles) : null;
    const bucketBackup = bucketNameBackup ? storage.bucket(bucketNameBackup) : null;

    function getBucket(type: FileType): Bucket {
        switch (type) {
            case "collection": return bucketCollection;
            case "file":
                if (bucketFiles) {
                    return bucketFiles;
                } else {
                    throw new Error("Not set bucket for files.");
                }
            case "backup":
                if (bucketBackup) {
                    return bucketBackup;
                } else {
                    throw new Error("Not set bucket for backup.");
                }
        }
    }

    return easyDBNodeCore<T>({
        saveFiles: typeof bucketNameFiles === "string",
        cacheExpirationTime,
        backup: bucketNameBackup ? (backup || true) : false,
        async getFileNames(type) {
            const bucket = getBucket(type);
            const [files] = await bucket.getFiles();
            const nameFiles = files.map(file => file.name);
            return nameFiles;
        },
        async isFile(type, name) {
            if (name.length === 0) {
                console.warn("File name is not specified!");
                return false;
            } else {
                let exists = false;
                try {
                    const bucket = getBucket(type);
                    const file = bucket.file(name);
                    const [fileExists] = await file.exists();
                    exists = fileExists;
                } catch (e) {
                    if (e instanceof Error) {
                        console.error(e);
                    } else {
                        console.error(JSON.stringify(e));
                    }
                    return false;
                }
                return exists;
            }
        },
        async readFile(type, name) {
            const bucket = getBucket(type);
            const file = bucket.file(name);
            return readFile(file);
        },
        async writeFile(type, name, fileContent) {
            const bucket = getBucket(type);
            const file = bucket.file(name);

            const { ext } = parse(name);
            await writeFile(file, fileContent, getType(ext));
            return file.publicUrl();

        },
        async unlinkFile(type, name) {
            const bucket = getBucket(type);
            const file = bucket.file(name);
            await file.delete();
        },
    });
}

function writeFile(file: File, fileContent: Buffer, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
        file.createWriteStream({
            resumable: false,
            gzip: true,
            metadata: { contentType },
        })
            .on("error", err => reject(err))
            .on("finish", () => resolve())
            .end(fileContent);
    });
}

function readFile(file: File): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const buffers: Buffer[] = [];

        file.createReadStream()
            .on("error", err => reject(err))
            .on("data", chunk => buffers.push(chunk))
            .on("end", () => resolve(Buffer.concat(buffers)))
            .read();
    });
}

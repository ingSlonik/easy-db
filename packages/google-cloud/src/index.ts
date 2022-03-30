import { parse } from "path";

import { Storage, File, Bucket } from "@google-cloud/storage";

import { easyDBNodeCore, getType, addToQueue, Backup, Configuration as NodeConfiguration, FileType } from "easy-db-node";

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
    /** Write file once per [ms] */
    distanceWriteFileTime?: number,
    backup?: Backup,
};

export default function easyDBGoogleCloud(configuration: Configuration) {
    const {
        bucketName, bucketNameFiles, bucketNameBackup, keyFilename, projectId,
        cacheExpirationTime, backup, distanceWriteFileTime
    } = configuration;

    const storage = new Storage({ keyFilename, projectId });
    const bucketCollection = storage.bucket(bucketName);
    const bucketFiles = bucketNameFiles ? storage.bucket(bucketNameFiles) : null;
    const bucketBackup = bucketNameBackup ? storage.bucket(bucketNameBackup) : null;

    const distanceWriteFile = distanceWriteFileTime ? distance(distanceWriteFileTime) : writeFile;

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

    return easyDBNodeCore({
        saveFiles: typeof bucketNameFiles === "string",
        // cacheExpirationTime shouldn't be smaller than distanceWriteFileTime
        cacheExpirationTime: (distanceWriteFileTime || 0) > (cacheExpirationTime || 0) ? (distanceWriteFileTime || null) : cacheExpirationTime,
        backup: bucketNameBackup ? (backup || true) : false,
        async getFileNames(type) {
            const bucket = getBucket(type);
            const [files] = await bucket.getFiles();
            const nameFiles = files.map(file => file.name);
            return nameFiles;
        },
        async isFile(type, name) {
            const bucket = getBucket(type);
            const file = bucket.file(name);
            const [exists] = await file.exists();
            return exists;
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
            await distanceWriteFile(file, fileContent, getType(ext));
            return file.publicUrl();

        },
        async unlinkFile(type, name) {
            const bucket = getBucket(type);
            const file = bucket.file(name);
            const [exists] = await file.exists();
            if (exists) {
                await file.delete();
            }
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

function distance(delay: number): typeof writeFile {

    const fileQueues: {
        [fileName: string]: {
            queue: null | Promise<any>,
            lastRef: () => Promise<void>,
        },
    } = {};

    // Save data in queue with SIGINT
    process.on("SIGINT", async () => {
        await Promise.all(Object.keys(fileQueues)
            .filter(fileName => fileQueues[fileName].queue !== null)
            .map(fileName => {
                fileQueues[fileName].queue = null;
                return fileQueues[fileName].lastRef()
            })
        );

        process.exit();
    });

    const distanceWriteFile: typeof writeFile = async (file, ...arg) => {
        const lastRef = async () => await distanceWriteFile(file, ...arg);

        if (!(file.name in fileQueues) || fileQueues[file.name].queue === null) {
            const queue = addToQueue<void>(null, () => new Promise(async resolve => {
                await writeFile(file, ...arg);
                setTimeout(() => {
                    fileQueues[file.name].queue = null;
                    resolve();
                }, delay);
            }));

            fileQueues[file.name] = { queue, lastRef };
        } else {
            fileQueues[file.name].lastRef = lastRef;
            (async () => {
                await fileQueues[file.name].queue;

                if (fileQueues[file.name].lastRef === lastRef) {
                    // this is last called function
                    await distanceWriteFile(file, ...arg);
                } else {
                    // there is newer content
                }
            })();
        }
    };

    return distanceWriteFile;
}

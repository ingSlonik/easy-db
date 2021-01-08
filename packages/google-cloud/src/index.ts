import { basename } from "path";

import { Storage, File, Bucket } from "@google-cloud/storage";

import { getExtension, getType } from "mime";
import easyDB, { getRandomId, addToQueue, Data } from "easy-db-core";
// export {} from "easy-db-core";

type Configuration = {
    bucketName: string,
    /**
     * If is not set, the files will not be convert to URL.
     * The bucketNameFiles should be public for `allUsers`.
     */
    bucketNameFiles?: string,
    projectId?: string,
    keyFilename?: string,
    cacheExpirationTime?: number,
    distanceWriteFileTime?: number,
    readable?: boolean,
};

export default function easyDBGoogleCloud(configuration: Configuration) {
    const {
        bucketName, bucketNameFiles, keyFilename, projectId,
        readable, cacheExpirationTime, distanceWriteFileTime
    } = configuration;

    const storage = new Storage({ keyFilename, projectId });
    const bucket = storage.bucket(bucketName);
    const bucketFiles = bucketNameFiles ? storage.bucket(bucketNameFiles) : null;

    const distanceWriteFile = distanceWriteFileTime ? distance(writeFile, distanceWriteFileTime) : writeFile;

    return easyDB({
        // cacheExpirationTime shouldn't be smaller than cacheExpirationTime
        cacheExpirationTime: distanceWriteFileTime > cacheExpirationTime ? distanceWriteFileTime : cacheExpirationTime,
        async saveCollection(name: string, data: Data) {
            const file = bucket.file(`${name}.json`);
            const fileContent = readable === true ? JSON.stringify(data, null, "    ") : JSON.stringify(data);
            const bufferContent = Buffer.from(fileContent, "utf8");

            await distanceWriteFile(file, bufferContent, "application/json", false);
            return;
        },
        async loadCollection(name: string): Promise<null | Data> {
            const file = bucket.file(`${name}.json`);

            const [exists] = await file.exists();            
            if (exists) {
                const content = await readFile(file);

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
                    const wrongFile = bucket.file(wrongFileName);
                    const wrongBufferContent = Buffer.from(content, "utf8");
                    await distanceWriteFile(wrongFile, wrongBufferContent, "application/json", false);
                    console.error(`Collection "${name}" is not parsable. It is save to "${wrongFileName}".`);
                    return null;
                }
            } else {
                return null;
            }
        },
        ...(bucketFiles ? {
            async saveFile(base64: string) {
                const extension = getFileExtension(base64);
                const fileName = await getFreeFileName(bucketFiles, extension);

                const file = bucketFiles.file(`${fileName}`);
                const fileContent = Buffer.from(getClearBase64(base64), "base64");

                await writeFile(file, fileContent, getType(extension), true);

                return file.publicUrl();
            },
            async removeFile(path: string) {
                const fileName = basename(path);
                const file = bucketFiles.file(fileName);
                await file.delete();
            }
        } : {}),
    });
}

function writeFile(file: File, fileContent: Buffer, contentType: string, dbFile: boolean): Promise<void> {
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

function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);

        file.createReadStream()
            .on("error", err => reject(err))
            .on("data", chunk => buffer = Buffer.concat([buffer, chunk]))
            .on("end", () => resolve(buffer.toString("utf8")))
            .read();
    });
}


async function getFreeFileName(bucket: Bucket, extension: string): Promise<string> {
    const [files] = await bucket.getFiles();
    const nameFiles = files.map(file => file.name);

    // TODO: throw after full dictionary
    while (true) {
        const fileName = `${getRandomId()}.${extension}`;
        if (!nameFiles.includes(fileName)) {
            return fileName;
        }
    }
}

// TODO: merge with easy-db-node
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

type WriteFile = typeof writeFile;
function distance(writeFile: WriteFile, delay: number): WriteFile {

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

    const distanceWriteFile: WriteFile = async (file, ...arg) => {
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

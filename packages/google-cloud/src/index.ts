import { basename } from "path";

import { Storage, File, Bucket } from "@google-cloud/storage";

import { getExtension, getType } from "mime";
import easyDB, { getRandomId, Data } from "easy-db-core";
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
    readable?: boolean,
};

export default function easyDBGoogleCloud(configuration: Configuration) {
    const { bucketName, bucketNameFiles, keyFilename, projectId, readable, cacheExpirationTime } = configuration;

    const storage = new Storage({ keyFilename, projectId });
    const bucket = storage.bucket(bucketName);
    const bucketFiles = bucketNameFiles ? storage.bucket(bucketNameFiles) : null;

    return easyDB({
        cacheExpirationTime,
        async saveCollection(name: string, data: Data) {
            const file = bucket.file(`${name}.json`);
            const fileContent = readable === true ? JSON.stringify(data, null, "    ") : JSON.stringify(data);

            await writeFile(file, fileContent, "application/json", false);
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
                    await writeFile(wrongFile, content, "application/json", false);
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

function writeFile(file: File, fileContent: string | Buffer, contentType: string, dbFile: boolean, repetition = 0): Promise<void> {
    return new Promise((resolve, reject) => {
        file.createWriteStream({
            resumable: false,
            gzip: true,
            metadata: { contentType },
        })
            .on("error", err => {
                // TODO: Reduce multiple queries in quick succession.
                if (err.message.includes("The rate of change requests to the object") && err.message.includes("exceeds the rate limit") && repetition < 10) {
                    setTimeout(() => {
                        writeFile(file, fileContent, contentType, dbFile, repetition + 1)
                            .then(resolve)
                            .catch(reject);
                    }, 100);
                } else {
                    reject(err);
                }
            })
            .on("finish", () => {
                resolve();
            })
            .end(fileContent);
    });
}

function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = "";

        file.createReadStream()
            .on("error", err => {
                reject(err);
            })
            .on("data", chunk => {
                data += chunk;
            })
            .on("end", () => {
                resolve(data);
            })
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

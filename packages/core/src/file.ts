/**
 * This module allow reduce any date with base64.
 * 
 * Idea:
 * String with base64 will be replaces by FileTag
 * With reading will be this FileTag replaced.
 * With updating or removing will take care to replacing this tag.
 */

import { Insert, Select, Update, Remove } from "./";

export type File = {
    id?: string,
    type: "EASY_DB_FILE",
    url: string,
};

type Data = any;
type FileRow = {
    id: string,
    url: string,
    use: Array<{
        collection: string,
        rowId: string,
    }>,
};

const FILE_COLLECTION = "easy-db-files";


function isFile(data: Data): boolean {
    if (
        typeof data === "object"
        && data !== null
        && data.type === "EASY_DB_FILE"
        && typeof data.url === "string"
    ) {
        return true;
    } else {
        return false;
    }
}

function isNewFile(file: File): boolean {
    // back compatibility
    return typeof file.id !== "string" && isBase64(file.url);
}

export function getFile(url: string): File { 
    return {
        id: null,
        type: "EASY_DB_FILE",
        url,
    };
}

export async function replaceFileData(
    data: Data, 
    collection: string,
    rowId: string,
    replaceFile: (base64: string) => Promise<string>, 
    insert: Insert,
    select: Select,
    update: Update,
): Promise<Data> {
    if (isFile(data)) {
        if (isNewFile(data)) {
            const url = await replaceFile(data.url);
            const use = [ { collection, rowId } ];
            const id = await insert(FILE_COLLECTION, (id: string): FileRow => ({ id, url, use }));
            const file: File = { id, type: "EASY_DB_FILE", url };
            return file;
        } else {
            if (typeof data.id === "string") {
                const fileRow: null | FileRow = await select(FILE_COLLECTION, data.id);
                if (fileRow) {
                    await update(FILE_COLLECTION, data.id, {
                        ...fileRow,
                        use: [
                            fileRow.use.filter(use => use.collection !== collection && use.rowId !== rowId),
                            { collection, rowId }
                        ],
                    });
                } else {
                    await update(FILE_COLLECTION, data.id, {
                        id: data.id,
                        url: data.url,
                        use: [ { collection, rowId } ],
                    });
                }
            }

            return data;
        }
    } else if (Array.isArray(data)) {
        const newData = [];
        for (const value of data) {
            newData.push(await replaceFileData(value, collection, rowId, replaceFile, insert, select, update));
        }
        return newData;
    } else if (typeof data === "object" && data !== null) {
        const newRow = {};
        for (const key in data) {
            newRow[key] = await replaceFileData(data[key], collection, rowId, replaceFile, insert, select, update);
        }
        return newRow;
    } else {
        return data;
    }
}

export async function removeUpdatedFiles(
    newData: Data,
    oldData: Data,
    collection: string,
    rowId: string,
    removeFile: (filePath: string) => Promise<void>,
    select: Select,
    update: Update,
    remove: Remove,
) {
    const newFiles = getFilesFromData(newData);
    const oldFiles = getFilesFromData(oldData);
    
    // now files are already in DB, not empty id
    const newFilesIds = newFiles.map(f => f.id);
    
    for (const oldFile of oldFiles) {
        const { id, url } = oldFile;
        if (newFilesIds.indexOf(id) < 0) {
            if (typeof id === "string") {
                const fileRow: null | FileRow = await select(FILE_COLLECTION, id);
                if (fileRow) {
                    const use = fileRow.use.filter(use => use.collection !== collection && use.rowId !== rowId);

                    if (use.length === 0) {
                        // remove file only when is not used
                        await remove(FILE_COLLECTION, id);
                        await removeFile(url);
                    } else {
                        await update(FILE_COLLECTION, id, { ...fileRow, use });
                    }
                } else {
                    // back compatibility
                    removeFile(url);
                }
            }
        }
    }
}

function getFilesFromData(data: Data, files: File[] = []): File[] {
    if (isFile(data)) {
        if (files.map(f => f.id).indexOf(data.id) < 0) {
            files = [ ...files, data ];
        }
    } else if (Array.isArray(data)) {
        data.forEach(value => files = getFilesFromData(value, files));
    } else if (typeof data === "object" && data !== null) {
        for (const key in data) {
            files = getFilesFromData(data[key], files);
        }
    }

    return files;
}

// Source: https://github.com/miguelmota/is-base64/blob/master/is-base64.js
const regexIsBase64 = new RegExp("^(data:\\w+\\/[a-zA-Z\\+\\-\\.]+;base64,)(?:[A-Za-z0-9+\\/]{4})*(?:[A-Za-z0-9+\\/]{2}==|[A-Za-z0-9+\/]{3}=)?$", "gi");
function isBase64(base64: string): boolean {
    return regexIsBase64.test(base64);
}

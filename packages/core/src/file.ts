/**
 * This module allow reduce any date with base64.
 * 
 * Idea:
 * String with base64 will be replaces by FileTag
 * With reading will be this FileTag replaced.
 * With updating or removing will take care to replacing this tag.
 */

import { Insert, Update, Remove } from "./";

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
    select: (collection: string, id: string) => Promise<null | FileRow>,
    update: Update,
): Promise<Data> {
    if (isFile(data)) {
        if (typeof data.id === "string") {
            // file is parsed
            const fileRow = await select(FILE_COLLECTION, data.id);
            if (fileRow) {
                // update FileRow for situation when is one file in more collections/rows
                await update(FILE_COLLECTION, data.id, {
                    ...fileRow,
                    use: [
                        fileRow.use.filter(use => use.collection !== collection && use.rowId !== rowId),
                        { collection, rowId }
                    ],
                });
            } else {
                // for situation that FileRow was lost
                await update(FILE_COLLECTION, data.id, {
                    id: data.id,
                    url: data.url,
                    use: [ { collection, rowId } ],
                });
            }

            return data;
        } else {
            // file is not parsed
            if (isBase64(data.url)) {
                // new file to save to server
                const url = await replaceFile(data.url);
                const use = [ { collection, rowId } ];
                const id = await insert(FILE_COLLECTION, (id: string): FileRow => ({ id, url, use }));
                const file: File = { id, type: "EASY_DB_FILE", url };
                return file;
            } else {
                // the url is defined by user
                return data;
            }
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

// this function has to be called after replaceFileData
// that means that here is not new file to save
export async function removeUpdatedFiles(
    newData: Data,
    oldData: Data,
    collection: string,
    rowId: string,
    removeFile: (filePath: string) => Promise<void>,
    select: (collection: string, id: string) => Promise<null | FileRow>,
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
            // these files was in ond row and is not in new row
            if (typeof id === "string" && !isBase64(url)) {
                // when was saved on this server
                const fileRow = await select(FILE_COLLECTION, id);
                if (fileRow) {
                    // remove this collection/worId from FileRow
                    const use = fileRow.use.filter(use => use.collection !== collection && use.rowId !== rowId);

                    if (use.length === 0) {
                        // remove file only when is not used
                        await remove(FILE_COLLECTION, id);
                        removeFile(url);
                    } else {
                        // if file is used in other collection/worId keep file
                        await update(FILE_COLLECTION, id, { ...fileRow, use });
                    }
                } else {
                    // remove file without FileRow
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
    regexIsBase64.lastIndex = 0;
    return regexIsBase64.test(base64);
}

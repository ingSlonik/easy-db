/**
 * This module allow reduce any date with base64.
 * 
 * Idea:
 * String with base64 will be replaces by FileTag
 * With reading will be this FileTag replaced.
 * With updating or removing will take care to replacing this tag.
 */

import { isBase64, getFreeId } from "./common";

export type File = {
    id?: string,
    type: "EASY_DB_FILE",
    url: string,
};

type UrlFile = {
    id: undefined,
    type: "EASY_DB_FILE",
    url: string,
}

type NewFile = {
    id: undefined,
    type: "EASY_DB_FILE",
    url: string, // base64
}

type SavedFile = {
    id: string,
    type: "EASY_DB_FILE",
    url: string,
}

type Data = any;
type FileRow = {
    id: string,
    url: string,
    use: Array<{
        collection: string,
        rowId: string,
    }>,
};

export type FileData = Record<string, FileRow>;

export const FILE_COLLECTION = "easy-db-files";

export function isFile(data: Data): data is File {
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

function isNewFile(file: File): file is NewFile {
    return isBase64(file.url);
}

function isUrlFile(file: File): file is UrlFile {
    // compatibility...
    return (typeof file.id !== "string" || file.id.length === 0) && !isBase64(file.url);
}

function isSavedFile(file: File): file is SavedFile {
    return typeof file.id === "string" && file.id.length > 0 && !isBase64(file.url);
}

function isFileRow(row: any): row is FileRow {
    if (
        row
        && row !== null
        && typeof row === "object"
        && typeof row.id === "string"
        && typeof row.url === "string"
        && Array.isArray(row.use)
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
    fileData: FileData,
    saveFile: (base64: string) => Promise<string>,
): Promise<[ Data, FileData ]> {
    let newFileData = { ...fileData };

    if (isFile(data)) {
        if (isSavedFile(data)) {
            // file is parsed
            const fileRow = newFileData[data.id];
            if (isFileRow(fileRow)) {
                // update FileRow for situation when is one file in more collections/rows
                newFileData[data.id] = {
                    ...fileRow,
                    use: [
                        ...fileRow.use.filter(use => use.collection !== collection && use.rowId !== rowId),
                        { collection, rowId }
                    ],
                };
            } else {
                // for situation that FileRow was lost
                newFileData[data.id] = {
                    id: data.id,
                    url: data.url,
                    use: [ { collection, rowId } ],
                };
            }

            return [ data, newFileData ];
        } else {
            // file is not parsed
            if (isNewFile(data)) {
                // new file to save to server
                const url = await saveFile(data.url);
                const use = [ { collection, rowId } ];
                const id = getFreeId(fileData);
                const file: File = { id, type: "EASY_DB_FILE", url };

                newFileData[id] = { id, url, use };
                return [ file, newFileData ];
            } else {
                // the url is defined by user
                return [ data, newFileData ];
            }
        }
    } else if (Array.isArray(data)) {
        const newData = [];
        for (const value of data) {
            const [ newValueData, newValueFileData ] = await replaceFileData(
                value, collection, rowId, newFileData, saveFile
            );
            newData.push(newValueData);
            newFileData = newValueFileData;
        }
        return [ newData, newFileData ];
    } else if (typeof data === "object" && data !== null) {
        const newRow = {};
        for (const key in data) {
            newRow[key] = await replaceFileData(data[key], collection, rowId, fileData, saveFile);
            const [ newValueData, newValueFileData ] = await replaceFileData(
                data[key], collection, rowId, newFileData, saveFile
            );
            newRow[key] = newValueData;
            newFileData = newValueFileData;
        }
        return [ newRow, newFileData ];
    } else {
        return [ data, fileData ];
    }
}

// this function has to be called after replaceFileData
// that means that here is not new file to save
export async function removeUpdatedFiles(
    oldData: Data,
    newData: Data,
    rowId: string,
    collection: string,
    fileData: FileData,
    removeFile: (filePath: string) => Promise<void>,
): Promise<FileData> {
    const newFileData = { ...fileData };

    const newFiles = getFilesFromData(newData);
    const oldFiles = getFilesFromData(oldData);

    // now files are already in DB, not empty id
    const newFilesIds = newFiles.map(f => f.id);

    for (const oldFile of oldFiles) {
        const { id, url } = oldFile;
        if (newFilesIds.indexOf(id) < 0) {
            // these files was in ond row and is not in new row
            if (isSavedFile(oldFile)) {
                // when was saved on this server
                const fileRow = newFileData[id];
                if (isFileRow(fileRow)) {
                    // remove this collection/worId from FileRow
                    const use = fileRow.use.filter(use => use.collection !== collection && use.rowId !== rowId);

                    if (use.length === 0) {
                        // remove file only when is not used
                        delete newFileData[id];
                        removeFile(url);
                    } else {
                        // if file is used in other collection/worId keep file
                        newFileData[id] = { ...fileRow, use };
                    }
                } else {
                    // remove file without FileRow
                    removeFile(url);
                }
            }
        }
    }

    return newFileData;
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

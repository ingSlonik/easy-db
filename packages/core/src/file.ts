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
        type: "EASY_DB_FILE",
        url,
    };
}

/**
 * Due to performance issue up to 100MB collection are sending reference of data.
 * @param dataRef Reference of the data. The variable content can be changed!
 * @param collection 
 * @param rowId 
 * @param fileDataRef Reference of the file data. The variable content can be changed!
 * @param saveFile 
 * @returns is fileDataRef changed
 */
export async function replaceFileData(
    dataRef: Data,
    collection: string,
    rowId: string,
    fileDataRef: FileData,
    saveFile: (base64: string) => Promise<string>,
): Promise<boolean> {
    let isFileDataRefChanged = false;

    if (isFile(dataRef)) {
        if (isSavedFile(dataRef)) {
            // file is parsed
            const fileRow = fileDataRef[dataRef.id];
            if (isFileRow(fileRow)) {
                // update FileRow for situation when is one file in more collections/rows

                const contains = fileRow.use.reduce((contains, use) => contains || (use.collection === collection && use.rowId === rowId), false);
                if (contains) {
                    // this file is already in use in fileRow
                } else {
                    isFileDataRefChanged = true;
                    fileDataRef[dataRef.id] = {
                        ...fileRow,
                        use: [
                            ...fileRow.use,
                            { collection, rowId }
                        ],
                    };
                }
            } else {
                // for situation that FileRow was lost
                isFileDataRefChanged = true;
                fileDataRef[dataRef.id] = {
                    id: dataRef.id,
                    url: dataRef.url,
                    use: [{ collection, rowId }],
                };
            }

        } else {
            // file is not parsed
            if (isNewFile(dataRef)) {
                // new file to save to server
                const url = await saveFile(dataRef.url);
                const use = [{ collection, rowId }];
                const id = getFreeId(fileDataRef);
                const file: File = { id, type: "EASY_DB_FILE", url };

                (dataRef as File).id = id;
                dataRef.type = "EASY_DB_FILE";
                dataRef.url = url;

                isFileDataRefChanged = true;
                fileDataRef[id] = { id, url, use };
            } else {
                // the url is defined by user
            }
        }
    } else if (Array.isArray(dataRef)) {
        for (const valueRef of dataRef) {
            const isChanged = await replaceFileData(valueRef, collection, rowId, fileDataRef, saveFile);
            isFileDataRefChanged = isFileDataRefChanged || isChanged;
        }
    } else if (typeof dataRef === "object" && dataRef !== null) {
        for (const key in dataRef) {
            const isChanged = await replaceFileData(dataRef[key], collection, rowId, fileDataRef, saveFile);
            isFileDataRefChanged = isFileDataRefChanged || isChanged;
        }
    }

    return isFileDataRefChanged;
}

/**
 * this function has to be called after replaceFileData
 * that means that here is not new file to save
 * @param oldData 
 * @param newData 
 * @param rowId 
 * @param collection 
 * @param fileDataRef Reference of the file data. The variable content can be changed!
 * @param removeFile 
 * @returns is fileDataRef changed
 */
export async function removeUpdatedFiles(
    oldData: Data,
    newData: Data,
    rowId: string,
    collection: string,
    fileDataRef: FileData,
    removeFile: (filePath: string) => Promise<void>,
): Promise<boolean> {
    let isFileDataRefChanged = false;

    const newFiles = getFilesFromData(newData);
    const oldFiles = getFilesFromData(oldData);

    // now files are already in DB, not empty id
    const newFilesIds = newFiles.map(f => f.id);

    for (const oldFile of oldFiles) {
        // these files was in ond row and is not in new row
        if (isSavedFile(oldFile)) {
            const { id, url } = oldFile;

            if (newFilesIds.indexOf(id) < 0) {
                // when was saved on this server
                const fileRow = fileDataRef[id];
                if (isFileRow(fileRow)) {
                    // remove this collection/worId from FileRow
                    const use = fileRow.use.filter(use => use.collection !== collection && use.rowId !== rowId);

                    if (use.length === 0) {
                        // remove file only when is not used
                        isFileDataRefChanged = true;
                        delete fileDataRef[id];
                        removeFile(url);
                    } else {
                        // if file is used in other collection/worId keep file
                        isFileDataRefChanged = true;
                        fileDataRef[id] = { ...fileRow, use };
                    }
                } else {
                    // remove file without FileRow
                    removeFile(url);
                }
            }
        }
    }

    return isFileDataRefChanged;
}

function getFilesFromData(data: Data, files: File[] = []): File[] {
    if (isFile(data)) {
        if (files.map(f => f.id).indexOf(data.id) < 0) {
            files = [...files, data];
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

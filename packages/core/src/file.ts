/**
 * This module allow reduce any date with base64.
 * 
 * Idea:
 * String with base64 will be replaces by FileTag
 * With reading will be this FileTag replaced.
 * With updating or removing will take care to replacing this tag.
 */

const isBase64 = require("is-base64");

type Data = any;
type FileTag = {
    type: "EASY_DB_FILE_TAG",
    replaced: string,
};

function isFileTag(data: Data): boolean {
    if (
        typeof data === "object"
        && data !== null
        && "type" in data
        && "replaced" in data
        && data.type === "EASY_DB_FILE_TAG"
    ) {
        return true;
    } else {
        return false;
    }
}

export function getDataWithReplacedFiles(data: Data): Data {
    if (typeof data === "object" && data !== null) {
        if (isFileTag(data)) {
            return data.replaced;
        } else {
            const newRow = {};
            for (const key in data) {
                newRow[key] = getDataWithReplacedFiles(data[key]);
            }
            return newRow;
        }
    } else if (Array.isArray(data)) {
        return data.map(value => getDataWithReplacedFiles(value));
    } else {
        return data;
    }
}

export async function replaceFileData(data: Data, replace: (base64: string) => Promise<string>): Promise<Data> {
    if (typeof data === "string") {
        if (isBase64(data)) {
            return {
                type: "EASY_DB_FILE_TAG",
                replaced: await replace(data)
            };
        } else {
            return data;
        }
    } else if (typeof data === "object" && data !== null) {
        const newRow = {};
        for (const key in data) {
            newRow[key] = await replaceFileData(data[key], replace);
        }
        return newRow;
    } else if (Array.isArray(data)) {
        return data.map(async value => await replaceFileData(value, replace));
    } else {
        return data;
    }
}

export async function removeUpdatedFiles(newData: Data, oldData: Data, remove: (filePath: string) => Promise<void>) {
    if (typeof oldData === "object" && oldData !== null) {
        if (isFileTag(oldData)) {
            if (isFileTag(newData)) {
                if (oldData.replaced !== newData.replaced) {
                    remove(oldData.replaced);
                }
            } else {
                remove(oldData.replaced);
            }
        } else {
            if (typeof newData === "object" && newData !== null) {
                for (const key in oldData) {
                    await removeUpdatedFiles(oldData[key], newData[key], remove);
                }
            } else {
                for (const key in oldData) {
                    await removeUpdatedFiles(oldData[key], null, remove);
                }
            }
        }
    } else if (Array.isArray(oldData)) {
        if (Array.isArray(newData)) {
            oldData.forEach(async (value, i) => await removeUpdatedFiles(value, newData[i], remove));
        } else {
            oldData.forEach(async (value, i) => await removeUpdatedFiles(value, null, remove));
        }
    }
}

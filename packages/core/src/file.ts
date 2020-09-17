/**
 * This module allow reduce any date with base64.
 * 
 * Idea:
 * String with base64 will be replaces by FileTag
 * With reading will be this FileTag replaced.
 * With updating or removing will take care to replacing this tag.
 */

type Data = any;
type FileTag = {
    type: "EASY_DB_FILE_TAG",
    replaced: string,
};

function isFileTag(data: Data): boolean {
    if (
        typeof data === "object"
        && data !== null
        && data.type === "EASY_DB_FILE_TAG"
        && typeof data.replaced === "string"
    ) {
        return true;
    } else {
        return false;
    }
}

export function getDataWithReplacedFiles(data: Data): Data {
    if (Array.isArray(data)) {
        return data.map(value => getDataWithReplacedFiles(value));
    } else if (typeof data === "object" && data !== null) {
        if (isFileTag(data)) {
            return data.replaced;
        } else {
            const newRow = {};
            for (const key in data) {
                newRow[key] = getDataWithReplacedFiles(data[key]);
            }
            return newRow;
        }
    } else  {
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
    } else if (Array.isArray(data)) {
        return data.map(async value => await replaceFileData(value, replace));
    } else if (typeof data === "object" && data !== null) {
        const newRow = {};
        for (const key in data) {
            newRow[key] = await replaceFileData(data[key], replace);
        }
        return newRow;
    } else {
        return data;
    }
}

export async function removeUpdatedFiles(newData: Data, oldData: Data, remove: (filePath: string) => Promise<void>) {
    if (Array.isArray(oldData)) {
        if (Array.isArray(newData)) {
            oldData.forEach(async (value, i) => await removeUpdatedFiles(newData[i], value, remove));
        } else {
            oldData.forEach(async (value, i) => await removeUpdatedFiles(null, value, remove));
        }
    } else if (typeof oldData === "object" && oldData !== null) {
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
                    await removeUpdatedFiles(newData[key], oldData[key], remove);
                }
            } else {
                for (const key in oldData) {
                    await removeUpdatedFiles(null, oldData[key], remove);
                }
            }
        }
    }
}

// Source: https://github.com/miguelmota/is-base64/blob/master/is-base64.js
const regexIsBase64 = new RegExp("^(data:\\w+\\/[a-zA-Z\\+\\-\\.]+;base64,)(?:[A-Za-z0-9+\\/]{4})*(?:[A-Za-z0-9+\\/]{2}==|[A-Za-z0-9+\/]{3}=)?$", "gi");
function isBase64(base64: string): boolean {
    return regexIsBase64.test(base64);
}

// this package check used ids, strong random is not necessary
const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const charactersLength = characters.length;
export function getRandomId(length: number = 12) {
    let result = '';
    for (let i = 0; i < length; i++) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// TODO: add string length after n cycles
export function getFreeId(data: Record<string, any>): string {
    let id = getRandomId();
    while (id in data) {
        id = getRandomId();
    }
    return id;
}

// Source: https://github.com/miguelmota/is-base64/blob/master/is-base64.js
const regexFullIsBase64 = new RegExp("^(data:\\w+\\/[a-zA-Z\\+\\-\\.]+;base64,)(?:[A-Za-z0-9+\\/]{4})*(?:[A-Za-z0-9+\\/]{2}==|[A-Za-z0-9+\/]{3}=)?$", "gi");
// Source: https://github.com/MrRio/jsPDF/issues/1795
const regexLightIsBase64 = new RegExp("data:([\\w]+?\/([\\w]+?));base64,(.+)$", "gi");
export function isBase64(base64: string): boolean {
    if (base64.length < 10e5) {
        regexFullIsBase64.lastIndex = 0;
        return regexFullIsBase64.test(base64);
    } else {
        // The regexFullIsBase64 has O(n) = n², that cause `RangeError: Maximum call stack size exceeded` for big base64
        regexLightIsBase64.lastIndex = 0;
        return regexLightIsBase64.test(base64);
    }
}

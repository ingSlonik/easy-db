import easyDB, { Data, DBTypes } from "easy-db-core";

const prefix = "easy-db-";

type Configuration = {};

export default function easyDBBrowser<T extends DBTypes>(configuration?: Configuration) {
    return easyDB<T>({
        async saveCollection(name: string, data: Data) {
            localStorage.setItem(`${prefix}${name}`, JSON.stringify(data));
        },
        async loadCollection(name: string): Promise<null | Data> {
            const content = localStorage.getItem(`${prefix}${name}`);
            try {
                const data = JSON.parse(content);
                if (data !== null && typeof data === "object") {
                    return data;
                } else {
                    return null;
                }
            } catch (e) {
                // TODO: write inconsistent data
                return null;
            }
        },
    });
}

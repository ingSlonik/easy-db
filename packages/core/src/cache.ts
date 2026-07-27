import type { Data, Backend } from ".";

type KeyCache = {
    data: Data;
    inNotSavedData: boolean;
    timer: ReturnType<typeof setTimeout>;
};

export default class Cache {
    private expirationTime: number;
    private loadData: Backend["loadCollection"];
    private saveData: Backend["saveCollection"];

    private keys: Record<string, KeyCache>;

    constructor(expirationTime: number, loadData: Backend["loadCollection"], saveData: Backend["saveCollection"]) {
        this.expirationTime = expirationTime;
        this.loadData = loadData;
        this.saveData = saveData;

        this.keys = {};

        this.preventLosingCache();
    }

    private preventLosingCache() {
        const flush = async () => {
            await this.saveAllDataInCache();
        };

        if (typeof process !== "undefined" && typeof process.on === "function") {
            // Node.js environment
            process.on("beforeExit", () => {
                void flush();
            });
            process.on("SIGINT", () => {
                flush().finally(() => process.exit(0));
            });
            process.on("SIGTERM", () => {
                flush().finally(() => process.exit(0));
            });
        }

        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            // Browser environment
            window.addEventListener("beforeunload", () => {
                void flush();
            });
            window.addEventListener("pagehide", () => {
                void flush();
            });
        }
    }

    public async saveAllDataInCache() {
        for (const key of Object.keys(this.keys)) {
            const keyCache = this.keys[key];
            if (keyCache && keyCache.inNotSavedData) {
                await this.flushKey(key);
            }
        }
    }

    private getCachedData(key: string): null | Data {
        if (key in this.keys) {
            const keyCache = this.keys[key];
            // Refresh timer on read access
            this.resetTimer(key);
            return keyCache.data;
        } else {
            return null;
        }
    }

    private resetTimer(key: string) {
        if (key in this.keys) {
            clearTimeout(this.keys[key].timer);
            this.keys[key].timer = setTimeout(() => {
                this.removeCache(key).catch(err => {
                    console.error(`Easy-db: Failed to flush expired cache for "${key}":`, err);
                });
            }, this.expirationTime);
        }
    }

    private setCachedData(key: string, data: Data, inNotSavedData: boolean) {
        if (key in this.keys) {
            clearTimeout(this.keys[key].timer);
        }
        const timer = setTimeout(() => {
            this.removeCache(key).catch(err => {
                console.error(`Easy-db: Failed to flush expired cache for "${key}":`, err);
            });
        }, this.expirationTime);

        this.keys[key] = { data, inNotSavedData, timer };
    }

    private removeKeyCache(key: string) {
        if (key in this.keys) {
            clearTimeout(this.keys[key].timer);
            delete this.keys[key];
        }
    }

    async get(key: string): Promise<null | Data> {
        const cachedData = this.getCachedData(key);
        if (cachedData !== null) {
            return cachedData;
        } else {
            const data = await this.loadData(key);
            if (data !== null) {
                this.setCachedData(key, data, false);
            }
            return data;
        }
    }

    async set(key: string, data: any) {
        this.setCachedData(key, data, true);
    }

    private async flushKey(key: string) {
        const keyCache = this.keys[key];
        if (keyCache && keyCache.inNotSavedData) {
            const dataToSave = keyCache.data;
            keyCache.inNotSavedData = false;
            await this.saveData(key, dataToSave);
        }
    }

    async removeCache(key: string) {
        if (key in this.keys) {
            const keyCache = this.keys[key];
            if (keyCache.inNotSavedData) {
                await this.flushKey(key);
            }
            // Always remove key from memory upon expiration so GC can reclaim RAM
            this.removeKeyCache(key);
        }
    }
}


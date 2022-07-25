import type { Data, Backend } from "./";

type KeyCache = {
    ref: {},
    inNotSavedData: boolean,
    timer: NodeJS.Timeout,
};

export default class Cache {
    private expirationTime: number;
    private loadData: Backend["loadCollection"];
    private saveData: Backend["saveCollection"];

    private weakMap: WeakMap<{}, Data>;
    private keys: Record<string, KeyCache>;

    constructor(expirationTime: number, loadData: Backend["loadCollection"], saveData: Backend["saveCollection"]) {
        this.expirationTime = expirationTime;
        this.loadData = loadData;
        this.saveData = saveData;

        this.weakMap = new WeakMap();
        this.keys = {};

        this.preventLosingCache();
    }

    private preventLosingCache() {
        if (process && typeof process.on === "function") {
            // Nodejs
            process.on("beforeExit", async (code) => {
                console.log("Easy-db: Saving all cached data with exit code:", code);
                await this.saveAllDataInCache();
            });
        }
    }

    private async saveAllDataInCache() {
        for (const key in this.keys) {
            const keyCache = this.keys[key];
            if (keyCache.inNotSavedData)
                await this.removeCache(key);
        }
    }

    private getCachedData(key: string): null | Data {
        if (key in this.keys) {
            return this.weakMap.get(this.keys[key].ref) || null;
        } else {
            return null;
        }
    }

    private setCachedData(key: string, data: Data, inNotSavedData: boolean) {
        if (key in this.keys) {
            const keyCache = this.keys[key];
            keyCache.inNotSavedData = inNotSavedData;
            this.weakMap.set(keyCache.ref, data);
        } else {
            const ref = {};
            const timer = setTimeout(() => this.removeCache(key), this.expirationTime);
            this.keys[key] = { ref, inNotSavedData, timer };
            this.weakMap.set(ref, data);
        }
    }

    private removeKeyCache(key: string) {
        if (key in this.keys) {
            this.weakMap.delete(this.keys[key].ref);
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

    async removeCache(key: string) {
        if (key in this.keys) {
            const keyCache = this.keys[key];
            if (keyCache.inNotSavedData) {
                const cachedData = this.weakMap.get(keyCache.ref) || null;
                if (cachedData) {
                    this.removeKeyCache(key);
                    await this.saveData(key, cachedData);
                    // cachedData are current set them for next period
                    this.setCachedData(key, cachedData, false);
                } else {
                    throw new Error("Unreachable.");
                }
            } else {
                this.removeKeyCache(key);
            }
        }
    }
}

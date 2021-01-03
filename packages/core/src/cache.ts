export default class Cache<Data> {
    private expirationTime: number;
    private weakMap: WeakMap<{}, Data>;
    private keys: {
        [key: string]: {
            ref: {},
            timer: NodeJS.Timeout,
        }
    };

    constructor(expirationTime: number) {
        this.expirationTime = expirationTime;
        this.weakMap = new WeakMap();
        this.keys = {};
    }

    async get(getData: (key: string) => Promise<Data>, key: string): Promise<Data> {
        if (key in this.keys) {
            return this.weakMap.get(this.keys[key].ref);
        } else {
            const data = await getData(key);
            this.set(key, data);
            return data;
        }
    }

    set(key: string, data: any) {
        if (key in this.keys)
            this.delete(key);

        const ref = {};
        const timer = setTimeout(() => this.delete(key), this.expirationTime);

        this.keys[key] = { ref, timer };
        this.weakMap.set(ref, data);
    }

    delete(key: string) {
        if (key in this.keys) {
            this.weakMap.delete(this.keys[key].ref);
            clearTimeout(this.keys[key].timer);
            delete this.keys[key];
        }
    }
}

export function addToQueue<T>(queue: null | Promise<any>, fn: () => Promise<T>): Promise<T> {
    const promise = queue !== null ? queue : Promise.resolve();

    return new Promise((resolve, reject) => {
        promise.then(() => {
            fn()
                .then(resolve)
                .catch(reject);
        });
    });
}

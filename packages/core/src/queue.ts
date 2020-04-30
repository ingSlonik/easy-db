export default function addToQueue<T>(queue: null | Promise<any>, fn: () => Promise<T>): Promise<T> {
    const promise = queue !== null ? queue : Promise.resolve();

    return new Promise((resolve, reject) => {
        promise.then((r) => {
            fn().then(result => {
                resolve(result);
            });
        });
    });
}

// mock AsyncStorage
const Module = require('module');

const storage = {};
const AsyncStorage = {
    setItem(key, value) {
        return new Promise((resolve) => {
            setTimeout(() => {
                storage[key] = value;
                resolve();
            }, 10);
        });
    },
    getItem(key) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(storage[key]);
            }, 10);
        });
    }
};

// mock require for "@react-native-async-storage/async-storage"
Module.prototype.require = function (name) {
    if (name === "@react-native-async-storage/async-storage") {
        return { default: AsyncStorage };
    } else {
        const nameToLoad = Module._resolveFilename(name, this);
        return Module._load(nameToLoad, this);
    }
}

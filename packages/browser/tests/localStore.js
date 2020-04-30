// mock localStorage
const storage = {};
localStorage = {
    setItem(key, value) {
        storage[key] = value;
    },
    getItem(key) {
        return storage[key];
    }
};

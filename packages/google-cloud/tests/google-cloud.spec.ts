import { resolve } from "path";

import { assert } from "chai";

import easyDB from "../src/index";

const { insert, select, update, remove, file } = easyDB({
    keyFilename: resolve(__dirname, "keyFile.json"),
    bucketName: "easy-db-test",
    bucketNameFiles: "easy-db-files",
    cacheExpirationTime: 1000,
    distanceWriteFileTime: 200,
});

const DUMMY_FILE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const DUMMY_FILE_TXT = "data:text/plain;base64,ZHVtbXk=";

describe("Easy DB", () => {
    it("db API", () => {
        assert.equal(typeof insert, "function", "EasyDB doesn't set 'insert' method.");
        assert.equal(typeof select, "function", "EasyDB doesn't set 'select' method.");
        assert.equal(typeof update, "function", "EasyDB doesn't set 'update' method.");
        assert.equal(typeof remove, "function", "EasyDB doesn't set 'remove' method.");
    });

    it("insert", async () => {
        const id = await insert("test", { myFirst: 1 });
        assert.equal(typeof id, "string");
    });

    it("select all", async () => {
        const data = await select("test");
        assert.equal(typeof data, "object");
    });

    it("select", async () => {
        const id = await insert("test", { myFirst: 2 });
        const data = await select("test", id);
        assert.deepEqual(data, { myFirst: 2 });
    });

    it("update", async () => {
        const id = await insert("test", { myFirst: 1 });
        await update("test", id, { myFirst: 25, second: 1 });
        const data = await select("test", id);
        assert.deepEqual(data, { myFirst: 25, second: 1 });
    });

    it("remove", async () => {
        const id = await insert("test", { myFirst: 1 });
        await remove("test", id);
        const data = await select("test", id);
        assert.deepEqual(data, null);
    });

    it("add txt file", async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE_TXT),
        });
        const data = await select("test", id);
        assert.isString(data.photo.url);
        assert.notEqual(data.photo.url, DUMMY_FILE_TXT);
        await remove("test", id);
    });

    it("add png file", async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE_PNG),
        });
        const data = await select("test", id);
        assert.isString(data.photo.url);
        assert.notEqual(data.photo.url, DUMMY_FILE_PNG);
        await remove("test", id);
    });
    
    it("add two files in one row", async () => {
        const id = await insert("test", {
            name: "Example User",
            picture: file(DUMMY_FILE_PNG),
            text: file(DUMMY_FILE_TXT),
        });
        const data = await select("test", id);
        assert.isString(data.picture.url);
        assert.notEqual(data.picture.url, DUMMY_FILE_TXT, "First file is not converted.");
        assert.isString(data.text.url);
        assert.notEqual(data.text.url, DUMMY_FILE_PNG, "Second file is not converted.");
        await remove("test", id);
    });

    it("update file", async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE_PNG),
        });
        await update("test", id, {
            name: "Example User",
            photo: "no picture",
        });
        const data = await select("test", id);
        assert.deepEqual(data, {
            name: "Example User",
            photo: "no picture",
        });
    });

    it("remove file", async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE_PNG),
        });
        await remove("test", id);
        const data = await select("test", id);
        assert.deepEqual(data, null);
    });

    it("multiple insert without cross the rate limit", async () => {
        await Promise.all(
            Array
                .from({ length: 10 })
                .map((v, i) => update("test", `crossLimit${i}`, { crossLimitTest: i }))
        );
        await Promise.all(
            Array
                .from({ length: 10 })
                .map((v, i) => remove("test", `crossLimit${i}`))
        );
    });
});

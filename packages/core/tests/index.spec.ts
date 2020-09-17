import { assert } from 'chai';

import easyDBCore, { Data } from "../src/index";

const DUMMY_FILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe('Easy DB Core', () => {
    it('create easy db', () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { },
            async loadCollection(name: string): Promise<null | Data> { return null; },
        });

        assert.equal(typeof easyDB, "object");
        assert.equal(typeof easyDB.insert, "function", "EasyDB doesn't set 'insert' method.");
        assert.equal(typeof easyDB.select, "function", "EasyDB doesn't set 'select' method.");
        assert.equal(typeof easyDB.update, "function", "EasyDB doesn't set 'update' method.");
        assert.equal(typeof easyDB.remove, "function", "EasyDB doesn't set 'remove' method.");
    });

    it('insert', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { },
            async loadCollection(name: string): Promise<null | Data> { return null; },
        });
        const id = await easyDB.insert("test", { myFirst: 1 });
        assert.equal(typeof id, "string");
    });

    it('select all', async () => {
        const testData = { [1]: "Hi" };
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { },
            async loadCollection(name: string): Promise<null | Data> { 
                if (name === "test") {
                    return testData;
                } else {
                    return null; 
                }   
            },
        });
        const data = await easyDB.select("test");
        assert.deepEqual(data, testData);
    });

    it('select', async () => {
        const testData = { [1]: "Hi" };
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { },
            async loadCollection(name: string): Promise<null | Data> { 
                if (name === "test") {
                    return testData;
                } else {
                    return null; 
                }   
            },
        });

        const data = await easyDB.select("test", "1");
        assert.equal(data, "Hi");
    });

    it('update', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { 
                assert.equal(name, "test");
                assert.deepEqual(data, { [1]: "Hi" });
            },
            async loadCollection(name: string): Promise<null | Data> { return null; },
        });
        const data = await easyDB.update("test", "1", "Hi");
    });

    it('remove', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { 
                assert.equal(name, "test");
                assert.deepEqual(data, {
                    [0]: "Hello",
                    [2]: "What?"
                });
            },
            async loadCollection(name: string): Promise<null | Data> { 
                if (name === "test") {
                    return {
                        [0]: "Hello",
                        [1]: "World",
                        [2]: "What?"
                    };
                } else {
                    return null; 
                }
            },
        });
        const data = await easyDB.remove("test", "1");
    });

    it('add file', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { },
            async loadCollection(name: string): Promise<null | Data> { return null; },
            async saveFile(base64: string) {
                assert.equal(base64, DUMMY_FILE);
                return "url/abc.png";
            },
            async removeFile(filePath: string) {
                return;
            },
        });
        await easyDB.insert("test", { picture: { url: DUMMY_FILE } });
    });

    it('update file', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {},
            async loadCollection(name: string): Promise<null | Data> {
                return {
                    "1": { picture: { url: "/url/abc.png" } }
                };
            },
            async saveFile(base64: string) {
                return "url/abc2.png";
            },
            async removeFile(filePath: string) {
                assert.equal(filePath, "/url/abc.png");
                return;
            },
        });
        await easyDB.update("test", "1", { picture: { url: DUMMY_FILE } });
    });

    it('remove file', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {},
            async loadCollection(name: string): Promise<null | Data> {
                return {
                    "1": { picture: { url: "/url/abc.png" } }
                };
            },
            async saveFile(base64: string) {
                return "url/abc2.png";
            },
            async removeFile(filePath: string) {
                assert.equal(filePath, "/url/abc.png");
                return;
            },
        });
        await easyDB.remove("test", "1");
    });

    it('keep types of rows', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {},
            async loadCollection(name: string): Promise<null | Data> {
                return {
                    "1": {
                        string: "String",
                        number: 21,
                        array: [1,2,3],
                        object: { a: "a" },
                    }
                };
            },
            async saveFile(base64: string) {
                return "url/abc2.png";
            },
            async removeFile(filePath: string) {
                return;
            },
        });
        const data = await easyDB.select("test", "1");
        
        assert.isString(data.string);
        assert.isNumber(data.number);
        assert.isArray(data.array);
        assert.isObject(data.object);
    });

});

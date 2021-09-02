import chai, { assert, expect } from 'chai';
import spies from 'chai-spies';
chai.use(spies);

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
        const testData = { "id": { "hello": "World" } };
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
        const testData = { "id": { "hello": "World" } };
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

        const data = await easyDB.select("test", "id");
        assert.deepEqual(data, testData.id);
    });

    it('update', async () => {
        const testData = { "id": { "hello": "World" } };
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { 
                assert.equal(name, "test");
                assert.deepEqual(data, testData);
            },
            async loadCollection(name: string): Promise<null | Data> { return null; },
        });
        const data = await easyDB.update("test", "id", testData.id);
    });

    it('remove', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) { 
                assert.equal(name, "test");
                assert.deepEqual(data, {
                    "0": { "value": "Hello" },
                    "2": { "value": "What?" },
                });
            },
            async loadCollection(name: string): Promise<null | Data> { 
                if (name === "test") {
                    return {
                        "0": { "value": "Hello" },
                        "1": { "value": "World" },
                        "2": { "value": "What?" },
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
        await easyDB.insert("test", { picture: easyDB.file(DUMMY_FILE) });
    });

    it('update file', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {},
            async loadCollection(name: string): Promise<null | Data> {
                return {
                    "1": { picture: { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" } }
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
        await easyDB.update("test", "1", { picture: easyDB.file(DUMMY_FILE) });
    });

    it('remove file', async () => {
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {},
            async loadCollection(name: string): Promise<null | Data> {
                return {
                    "1": { picture: { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" } }
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

    it('rewrite file db only one with more changes', async () => {
        const spy = chai.spy((name: string) => {
            console.log({ name });
        });
        const savedFile = { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" };
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {
                spy(name);
            },
            async loadCollection(name: string): Promise<null | Data> {
                spy(name);
                return {
                    "1": { file1: savedFile }
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
        await easyDB.update("test", "1", {
            file1: savedFile,
            file2: easyDB.file(DUMMY_FILE),
            file3: easyDB.file(DUMMY_FILE),
        });
        
        expect(spy).to.have.been.called.once;
    });

    it('keep types of rows', async () => {
        const row = {
            string: "String",
            number: 21,
            array: [1,2,3],
            object: { a: "a" },
        };

        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {},
            async loadCollection(name: string): Promise<null | Data> {
                return {
                    "1": row
                };
            },
            async saveFile(base64: string) {
                return "url/abc2.png";
            },
            async removeFile(filePath: string) {
                return;
            },
        });
        const data = await easyDB.select<typeof row>("test", "1");
        
        assert.isString(data.string);
        assert.isNumber(data.number);
        assert.isArray(data.array);
        assert.isObject(data.object);
    });

});

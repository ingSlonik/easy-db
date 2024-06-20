import { use } from 'chai';
import spies from 'chai-spies';

import easyDBCore, { File, Data } from "../src/index";

type TestDB = {
    test: { picture: File },
    notUse: { error: string }
}

const { spy, assert, expect } = use(spies);

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
        assert.equal(typeof easyDB.selectArray, "function", "EasyDB doesn't set 'selectArray' method.");
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
        const testData: any = { "id": { "hello": "World" } };
        const easyDB = easyDBCore<TestDB>({
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
        const testData: any = { "id": { "hello": "World" } };
        const easyDB = easyDBCore<TestDB>({
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
        assert.deepEqual(data, { _id: "id", ...testData.id });
    });

    it('selectArray', async () => {
        const testData: any = { "id": { "hello": "World" } };
        const easyDB = easyDBCore<TestDB>({
            async saveCollection(name: string, data: Data) { },
            async loadCollection(name: string): Promise<null | Data> {
                if (name === "test") {
                    return testData;
                } else {
                    return null;
                }
            },
        });

        const data = await easyDB.selectArray("test");
        assert.isArray(data);
        assert.deepEqual(data[0]._id, "id");
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
        const saveSpy = spy((base64: string) => { });

        let testCollection = {};
        let fileCollection = {};

        const easyDB = easyDBCore<TestDB>({
            async saveCollection(name: string, data: Data) {
                if (name === "test") {
                    testCollection = data;
                } else if (name === "easy-db-files") {
                    fileCollection = data;
                }
            },
            async loadCollection(name: string): Promise<null | Data> {
                if (name === "test") {
                    return testCollection;
                } else if (name === "easy-db-files") {
                    return fileCollection;
                } else {
                    return null;
                }
            },
            async saveFile(base64: string) {
                saveSpy(base64);
                return "url/abc.png";
            },
            async removeFile(filePath: string) {
                return;
            },
        });
        const id = await easyDB.insert("test", { picture: easyDB.file(DUMMY_FILE) });
        const row = await easyDB.select("test", id);

        expect(saveSpy).to.have.been.called.with(DUMMY_FILE);
        assert.equal(row?.picture.url, "url/abc.png");
    });

    it('update row with remove old file', async () => {
        const saveSpy = spy((base64: string) => { });
        const removeSpy = spy((filePath: string) => { });

        let testCollection: Data = {
            "1": { picture: { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" } }
        };
        let fileCollection: Data = {
            "a": {
                "url": "/url/abc.png",
                "use": [
                    { "collection": "test", "rowId": "1" }
                ]
            }
        };
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {
                if (name === "test") {
                    testCollection = data;
                } else if (name === "easy-db-files") {
                    fileCollection = data;
                }
            },
            async loadCollection(name: string): Promise<null | Data> {
                if (name === "test") {
                    return testCollection;
                } else if (name === "easy-db-files") {
                    return fileCollection;
                } else {
                    return null;
                }
            },
            async saveFile(base64: string) {
                saveSpy(base64);
                return "url/abc2.png";
            },
            async removeFile(filePath: string) {
                removeSpy(filePath);
                return;
            },
        });

        await easyDB.update("test", "1", { picture: easyDB.file(DUMMY_FILE) });

        expect(saveSpy).to.have.been.called.once;
        expect(saveSpy).to.have.been.called.with(DUMMY_FILE);
        expect(removeSpy).to.have.been.called.once;
        expect(removeSpy).to.have.been.called.with("/url/abc.png");
    });

    it('update row with not remove old file', async () => {
        const saveSpy = spy((base64: string) => { });
        const removeSpy = spy((filePath: string) => { });

        let testCollection: Data = {
            "1": { picture: { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" } },
            "2": { picture: { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" } },
        };
        let fileCollection: Data = {
            "a": {
                "url": "/url/abc.png",
                "use": [
                    { "collection": "test", "rowId": "1" },
                    { "collection": "test", "rowId": "2" },
                ]
            }
        };
        const easyDB = easyDBCore<TestDB>({
            async saveCollection(name: string, data: Data) {
                if (name === "test") {
                    testCollection = data;
                } else if (name === "easy-db-files") {
                    fileCollection = data;
                }
            },
            async loadCollection(name: string): Promise<null | Data> {
                if (name === "test") {
                    return testCollection;
                } else if (name === "easy-db-files") {
                    return fileCollection;
                } else {
                    return null;
                }
            },
            async saveFile(base64: string) {
                saveSpy(base64);
                return "url/abc2.png";
            },
            async removeFile(filePath: string) {
                removeSpy(filePath);
                return;
            },
        });

        await easyDB.update("test", "1", { picture: easyDB.file(DUMMY_FILE) });

        expect(saveSpy).to.have.been.called.once;
        expect(saveSpy).to.have.been.called.with(DUMMY_FILE);
        expect(removeSpy).to.have.been.called.exactly(0);
    });


    it('remove file', async () => {
        const removeSpy = spy((filePath: string) => { });

        let testCollection: Data = {
            "1": { picture: { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" } },
        };
        let fileCollection: Data = {
            "a": {
                "url": "/url/abc.png",
                "use": [
                    { "collection": "test", "rowId": "1" },
                ]
            }
        };
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {
                if (name === "test") {
                    testCollection = data;
                } else if (name === "easy-db-files") {
                    fileCollection = data;
                }
            },
            async loadCollection(name: string): Promise<null | Data> {
                if (name === "test") {
                    return testCollection;
                } else if (name === "easy-db-files") {
                    return fileCollection;
                } else {
                    return null;
                }
            },
            async saveFile(base64: string) {
                return "url/abc2.png";
            },
            async removeFile(filePath: string) {
                removeSpy(filePath);
                return;
            },
        });

        await easyDB.remove("test", "1");

        expect(removeSpy).to.have.been.called.once;
        expect(removeSpy).to.have.been.called.with("/url/abc.png");
    });

    it('rewrite file db only one with more changes', async () => {
        const saveSpy = spy(() => { });
        const loadSpy = spy(() => { });

        const savedFile = { id: "a", type: "EASY_DB_FILE", url: "/url/abc.png" };
        const easyDB = easyDBCore({
            async saveCollection(name: string, data: Data) {
                if (name === "easy-db-files") saveSpy();
            },
            async loadCollection(name: string): Promise<null | Data> {
                if (name === "easy-db-files") loadSpy();
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

        expect(saveSpy).to.have.been.called.once;
        expect(loadSpy).to.have.been.called.once;
    });

    it('keep types of rows', async () => {
        const row = {
            string: "String",
            number: 21,
            array: [1, 2, 3],
            object: { a: "a" },
        };

        const easyDB = easyDBCore<{ test: typeof row }>({
            async saveCollection(name: string, data: Data) { },
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
        const data = await easyDB.select("test", "1");

        if (data === null) {
            assert.fail("Selected row is null");
            return;
        }

        assert.isString(data.string);
        assert.isNumber(data.number);
        assert.isArray(data.array);
        assert.isObject(data.object);
    });

});

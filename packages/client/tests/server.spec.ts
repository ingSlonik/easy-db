process.env.NODE_ENV = "test";

import { assert } from "chai";
import { express, useEasyDB } from "easy-db-server";

import fetch from "node-fetch";
global.fetch = (fetch as any);

import easyDB from "../src";

const TOKEN = "secretToken";

const app = express();

useEasyDB(app, {
    token: TOKEN,
});

const server = app.listen(1234, () => console.log(`Easy DB server is running at http://localhost:1234.`));

type DB = {
    test: {
        id?: string;
        myFirst?: number;
        second?: number;
        query?: boolean;
        value?: number;
    };
};

const { getCollections, insert, select, selectArray, update, remove } = easyDB<DB>({ server: "http://localhost:1234/", token: TOKEN });

describe('Easy DB client', () => {

    it('wrong token', async () => {
        const { select } = easyDB({ server: "http://localhost:1234/api/", token: "wrongToken" });
        try {
            const data = await select("test");
            assert.fail("Token should be wrong.");
        } catch (e) {
            assert.instanceOf(e, Error);
        }
    });

    it('right token', async () => {
        const { insert, select } = easyDB({ server: "http://localhost:1234/", token: TOKEN });
        const id = await insert("test", { myFirst: "token" });
        const data = await select("test", id);
        assert.notEqual(data, null);
    });

    it('insert', async () => {
        const id = await insert("test", { myFirst: 1 });
        assert.isString(id);
    });

    it('insert with callback', async () => {
        const id = await insert("test", id => ({ id, myFirst: 1 }));
        assert.isString(id);
        const data = await select("test", id);
        assert.equal(id, data?.id);
    });

    it('get collections', async () => {
        const collections = await getCollections();
        assert.isArray(collections);
        for (const collection of collections) {
            assert.isString(collection);
        }
    });

    it('select all', async () => {
        const data = await select("test");
        assert.isObject(data);
        assert.isNotArray(data);
    });
    it('selectArray', async () => {
        const data = await selectArray("test");
        assert.isArray(data);
        assert.hasAnyKeys(data[0], ["_id"]);
    });

    it('select', async () => {
        const id = await insert("test", { myFirst: 2 });
        const data = await select("test", id);
        assert.deepEqual(data, { _id: id, myFirst: 2 });
    });

    it('update', async () => {
        const id = await insert("test", { myFirst: 1 });
        await update("test", id, { myFirst: 25, second: 1 });
        const data = await select("test", id);
        assert.deepEqual(data, { _id: id, myFirst: 25, second: 1 });
    });

    it('remove', async () => {
        const id = await insert("test", { myFirst: 1 });
        await remove("test", id);
        const data = await select("test", id);
        assert.deepEqual(data, null);
    });

    it('select with query', async () => {
        const query = { second: 1 };
        const data = await select("test", { query });
        assert.isObject(data);
        assert.isNotArray(data);
        Object.values(data).forEach(value => assert.deepNestedInclude(value, query));
    });

    it('select with query and projection', async () => {
        const query = { second: 1 };
        const projection = { myFirst: 1 };
        const data = await select("test", { query, projection });
        assert.isObject(data);
        assert.isNotArray(data);
        Object.values(data).forEach(row => {
            assert.isFalse(typeof row.myFirst === "undefined");
            assert.isTrue(typeof row.second === "undefined");
        });
    });

    it('select with query and sort', async () => {
        await insert("test", { query: true, value: Math.random() });
        await insert("test", { query: true, value: Math.random() });

        const data = await select("test", { query: { query: true }, sort: { value: - 1 } });

        let rowBefore: any = null;
        Object.values(data).forEach(row => {
            if (rowBefore !== null)
                assert.isTrue(
                    rowBefore.value >= (row?.value || 0),
                    `Result is not sorted (${rowBefore.value} >= ${row.value}).`
                );

            rowBefore = row;
        });
    });

    it('select with limit', async () => {
        const data = await select("test", { limit: 2 });

        assert.strictEqual(Object.keys(data).length, 2);
    });

    it('GET all with skip', async () => {
        const dataWithout = await select("test");
        const dataWith = await select("test", { skip: 2 });

        assert.strictEqual(Object.keys(dataWith).length, Object.keys(dataWithout).length - 2);
    });

    after(() => {
        server.close();
    });
});

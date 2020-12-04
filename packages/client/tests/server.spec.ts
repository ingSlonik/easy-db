process.env.NODE_ENV = "test";

import { assert } from "chai";
import { app } from "easy-db-server";

import fetch from "node-fetch";
global.fetch = (fetch as any);

import { insert, select, update, remove, configure } from "../src";

const server = app.listen(1234, () => console.log(`Easy DB server is running at http://localhost:1234.`));

configure({ server: "http://localhost:1234/api/" })

describe('Easy DB client', () => {
    
    it('insert', async () => {
        const id = await insert("test", { myFirst: 1 });
        assert.isString(id);
    });
    
    it('insert with callback', async () => {
        const id = await insert("test", id => ({ id, myFirst: 1 }));
        assert.isString(id);
        const data = await select("test", id);
        assert.equal(id, data.id);
    });

    it('select all', async () => {
        const data = await select("test");
        assert.isObject(data);
        assert.isNotArray(data);
    });

    it('select with query', async () => {
        const query = { second: 1 };
        const data = await select("test", query);
        assert.isObject(data);
        assert.isNotArray(data);
        Object.values(data).forEach(value => assert.deepNestedInclude(value, query));
    });

    it('select', async () => {
        const id = await insert("test", { myFirst: 2 });
        const data = await select("test", id);
        assert.deepEqual(data, { myFirst: 2 });
    });

    it('update', async () => {
        const id = await insert("test", { myFirst: 1 });
        await update("test", id, { myFirst: 25, second: 1 });
        const data = await select("test", id);
        assert.deepEqual(data, { myFirst: 25, second: 1 });
    });

    it('remove', async () => {
        const id = await insert("test", { myFirst: 1 });
        await remove("test", id);
        const data = await select("test", id);
        assert.deepEqual(data, null);
    });

    after(() => {
        server.close();
    });
});

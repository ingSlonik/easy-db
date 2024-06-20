import { readFileSync, existsSync, promises } from "fs";
import { resolve } from "path";

import { assert } from "chai";

import easyDB, { defaultBackupConfiguration, getDayDate, file, File } from "../src/index";

type TextDB = {
    test: {
        id?: string,
        name?: string,
        myFirst?: number,
        second?: number,
        photo?: File,
        picture?: File,
        backupTest?: number,
        text?: string,
        "async"?: boolean,
    },
    "test-damaged": {
        fixed: string,
    }
};

const { writeFile, readdir, unlink } = promises;

const DUMMY_FILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const DUMMY_FILE_2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjMPyg/R8ABO4CTAkxw14AAAAASUVORK5CYII=";

async function timeout(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

let backupName = "keep";

const { insert, select, update, remove } = easyDB<TextDB>({
    fileFolder: "./files",
    fileUrl: "./files",
    backupFolder: "backup",
    backup: {
        getActualName: () => backupName,
        keepName: name => name === "keep" || name === backupName,
    },
});

const cacheExpirationTime = 500;
const { insert: insertCache, select: selectCache, update: updateCache } = easyDB<TextDB>({ cacheExpirationTime, backup: false });

describe('Easy DB', () => {
    it('db API', () => {
        assert.equal(typeof insert, "function", "EasyDB doesn't set 'insert' method.");
        assert.equal(typeof select, "function", "EasyDB doesn't set 'select' method.");
        assert.equal(typeof update, "function", "EasyDB doesn't set 'update' method.");
        assert.equal(typeof remove, "function", "EasyDB doesn't set 'remove' method.");
    });

    it('insert', async () => {
        const id = await insert("test", { myFirst: 1 });
        assert.equal(typeof id, "string");
    });

    it('select all', async () => {
        const data = await select("test");
        assert.equal(typeof data, "object");
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


    it('add file', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        assert.isString(data?.photo?.url);
        assert.notEqual(data?.photo?.url, DUMMY_FILE);
        await remove("test", id);
    });

    it('add two files in one row', async () => {
        const id = await insert("test", {
            name: "Example User",
            picture: file(DUMMY_FILE),
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        assert.isString(data?.photo?.url);
        assert.notEqual(data?.photo?.url, DUMMY_FILE, "First file is not converted.");
        assert.isString(data?.picture?.url);
        assert.notEqual(data?.picture?.url, DUMMY_FILE, "Second file is not converted.");
        await remove("test", id);
    });

    it('is file saved', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        const filePath = resolve(data?.photo?.url || "")
        assert.isTrue(existsSync(filePath), "File is not it not in file system.");
        await remove("test", id);
    });

    it('keep file content', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        assert.notEqual(data?.photo?.url, DUMMY_FILE);
        const fileBase64 = readFileSync(resolve(data?.photo?.url || ""), "base64");
        assert.equal(fileBase64, DUMMY_FILE.substr(22));
        await remove("test", id);
    });

    it('update file to undefined', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const rowWithFile = await select("test", id);
        assert.isTrue(existsSync(resolve(rowWithFile?.photo?.url || "")), "File is not saved");

        await update("test", id, {
            name: "Example User",
            photo: undefined,
        });
        const rowWithoutFile = await select("test", id);
        assert.deepEqual(rowWithoutFile?.photo, undefined);
        assert.isFalse(existsSync(resolve(rowWithFile?.photo?.url || "")), "File is not removed after update");
        await remove("test", id);
    });

    it('update row with remove file', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        await update("test", id, {
            name: "Example User",
            photo: file(DUMMY_FILE_2),
        });
        assert.isFalse(existsSync(resolve(data?.photo?.url || "")), "File is not removed after update");
        await remove("test", id);
    });
    it('update row with keep file', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const row = await select("test", id);
        const id2 = await insert("test", {
            name: "Example User 2",
            photo: row?.photo,
        });
        await update("test", id, {
            name: "Example User",
            photo: file(DUMMY_FILE_2),
        });
        const data = await select("test", id);
        assert.isTrue(existsSync(resolve(row?.photo?.url || "")), "Old file is not keeped after update");
        assert.isTrue(existsSync(resolve(data?.photo?.url || "")), "New file is not keeped after update");
        await remove("test", id);
        await remove("test", id2);
    });

    it('remove file', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const row = await select("test", id);
        assert.isTrue(existsSync(resolve(row?.photo?.url || "")), "File is not saved");
        await remove("test", id);
        const data = await select("test", id);
        assert.deepEqual(data, null);
        assert.isFalse(existsSync(resolve(row?.photo?.url || "")), "File is not removed after remove row");
    });

    it('keep damaged db files', async () => {
        const dbFolder = resolve(__dirname, "..", "easy-db");
        // remove all test-damaged files
        for (const file of await readdir(dbFolder)) {
            if (file.includes("test-damaged"))
                await unlink(resolve(dbFolder, file));
        }

        // create damaged json file
        await writeFile(resolve(__dirname, "..", "easy-db", "test-damaged.json"), "{ Damaged JSON }", "utf8");
        await insert("test-damaged", { fixed: "collection" });

        // check files with test-damaged
        const files = await readdir(dbFolder);
        assert.lengthOf(files.filter(file => file.includes("test-damaged")), 2);
    });

    it('read and write data async', async () => {
        await Promise.all(Array.from({ length: 21 }).map((_, i) => {
            switch (i % 3) {
                case 0: return select("test");
                case 1: return insert("test", (id) => ({ id, async: true }));
                case 2: return update("test", "async-test", { async: true });
            }
        }));

        assert.ok(true, "TODO: projel jsem to.");
    });
    it('read and write data async with cache', async () => {
        await Promise.all(Array.from({ length: 21 }).map((_, i) => {
            switch (i % 3) {
                case 0: return selectCache("test");
                case 1: return insertCache("test", (id) => ({ id, async: true }));
                case 2: return updateCache("test", "async-test", { async: true });
            }
        }));

        assert.ok(true, "TODO: projel jsem to.");
    });

    it('create backup', async () => {
        backupName = "keep2";
        const backupPath = resolve(__dirname, "..", "backup");
        const backupFile = resolve(backupPath, "keep2.zip");

        if (existsSync(backupFile))
            await unlink(backupFile);

        await insert("test", { backupTest: 1 });

        assert.isTrue(existsSync(backupFile), "Backup is not created.");
        backupName = "keep";
    });

    it('remove old backup', async () => {
        const backupPath = resolve(__dirname, "..", "backup");
        const backupFile = resolve(backupPath, "keep.zip");
        const backupOldFile = resolve(backupPath, "old.zip");

        if (!existsSync(backupOldFile))
            await writeFile(backupOldFile, "Fake old backup file", "utf8");
        if (existsSync(backupFile))
            await unlink(backupFile);

        await insert("test", { backupTest: 2 });

        assert.isFalse(existsSync(backupOldFile), "Old backup is not removed.");
    });

    it('check default keep function', () => {
        const { keepName } = defaultBackupConfiguration;

        assert.isTrue(keepName("notDate"), "Keep users not date files");

        const date = new Date();
        assert.isTrue(keepName(getDayDate(date)), "Keep todays backup");

        date.setDate(date.getDate() - 1);
        assert.isTrue(keepName(getDayDate(date)), "Keep yesterdays backup");

        date.setDate(date.getDate() - 59);
        date.setDate(2);
        assert.isFalse(keepName(getDayDate(date)), "Not keep backup before 2 months 2th day");
    });

    it('cache data for load', async () => {
        const id = await insertCache("test", { text: "Cached" });
        await update("test", id, { text: "Changed" });
        const row = await selectCache("test", id);
        assert.equal(row?.text, "Cached", "Cache was not used.");
        await timeout(cacheExpirationTime * 2);
        await update("test", id, { text: "Changed" });
        const rowAfter = await selectCache("test", id);
        assert.equal(rowAfter?.text, "Changed", "Cache was not cleared.");
    });

    it('cache data for save', async () => {
        const id = await insertCache("test", { text: "Cached" });
        const row = await select("test", id);
        assert.equal(row, null, "Collection was saved before cacheExpirationTime.");
        await timeout(cacheExpirationTime * 2);
        const rowAfter = await select("test", id);
        assert.equal(rowAfter?.text, "Cached", "Collection was not saved after cacheExpirationTime.");
    });
});

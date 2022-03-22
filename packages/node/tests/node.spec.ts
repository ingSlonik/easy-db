import { readFileSync, existsSync, promises } from "fs";
import { resolve } from "path";

import { assert } from "chai";

import easyDB, { defaultBackupConfiguration, getDayDate } from "../src/index";

const { writeFile, readdir, unlink } = promises;

const DUMMY_FILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const { insert, select, update, remove, file } = easyDB({
    fileFolder: "./files",
    fileUrl: "./files",
    backupFolder: "backup",
    backup: {
        getActualName: () => "keep",
        keepName: name => name === "keep",
    },
});

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


    it('add file', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        assert.isString(data?.photo.url);
        assert.notEqual(data?.photo.url, DUMMY_FILE);
        await remove("test", id);
    });

    it('add two files in one row', async () => {
        const id = await insert("test", {
            name: "Example User",
            picture: file(DUMMY_FILE),
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        assert.isString(data?.photo.url);
        assert.notEqual(data?.photo.url, DUMMY_FILE, "First file is not converted.");
        assert.isString(data?.picture.url);
        assert.notEqual(data?.picture.url, DUMMY_FILE, "Second file is not converted.");
        await remove("test", id);
    });

    it('is file saved', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        const filePath = resolve(data?.photo.url)
        assert.isTrue(existsSync(filePath), "File is not it not in file system.");
        await remove("test", id);
    });

    it('keep file content', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        const data = await select("test", id);
        const fileBase64 = readFileSync(resolve(data?.photo.url), "base64");
        assert.equal(fileBase64, DUMMY_FILE.substr(22));
        await remove("test", id);
    });

    it('update file', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
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

    it('remove file', async () => {
        const id = await insert("test", {
            name: "Example User",
            photo: file(DUMMY_FILE),
        });
        await remove("test", id);
        const data = await select("test", id);
        assert.deepEqual(data, null);
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

    it('create backup', async () => {
        const backupPath = resolve(__dirname, "..", "backup");
        const backupFile = resolve(backupPath, "keep.zip");

        if (existsSync(backupFile))
            await unlink(backupFile);

        await insert("test", { backupTest: 1 });

        assert.isTrue(existsSync(backupFile), "Backup is not created.");
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
});

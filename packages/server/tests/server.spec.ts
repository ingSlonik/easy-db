process.env.NODE_ENV = "test";

import { assert, use, request } from "chai";
import chaiHttp from "chai-http";
import server from "../src/cli";

use(chaiHttp);

const DUMMY_FILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe('Easy DB server', () => {
    
    it('server is running', (done) => {
        request(server).get("/").end((err, res) => {
            assert.equal(res.status, 200);
            assert.include(res.text, "Easy DB");
            done();
        });
    });

    it('GET all', (done) => {
        request(server).get("/api/test").end((err, res) => {
            const body = JSON.parse(res.text);
            assert.equal(res.status, 200);
            assert.isArray(body);
            done();
        });
    });

    it('GET all as easy-db-client', (done) => {
        request(server).get("/api/test?easy-db-client=true").end((err, res) => {
            const body = JSON.parse(res.text);
            assert.equal(res.status, 200);
            assert.isNotArray(body);
            done();
        });
    });

    it('POST and GET one', (done) => {
        const item = { a: "Item1" };

        request(server).post("/api/test").send(item).end((err, res) => {
            const id = JSON.parse(res.text);
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).get(`/api/test/${id}`).end((err, res) => {
                const body = JSON.parse(res.text);
                assert.deepEqual(body, item);
                done();
            });
        });
    });

    it('PUT', (done) => {
        const item = { a: "Item1" };
        const putItem = { b: "Item2" };

        request(server).post("/api/test").send(item).end((err, res) => {
            const id = JSON.parse(res.text);
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).put(`/api/test/${id}`).send(putItem).end((err, res) => {
                request(server).get(`/api/test/${id}`).end((err, res) => {
                    const body = JSON.parse(res.text);
                    assert.deepEqual(body, putItem);
                    done();
                });
            });
        });
    });

    it('DELETE', (done) => {
        const item = { a: "Item DELETE" };

        request(server).post("/api/test").send(item).end((err, res) => {
            const id = JSON.parse(res.text);
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).delete(`/api/test/${id}`).end((err, res) => {
                request(server).get(`/api/test/${id}`).end((err, res) => {
                    const body = JSON.parse(res.text);
                    assert.deepEqual(body, null);
                    done();
                });
            });
        });
    });

    it('add file', (done) => {
        const item = { photo: { "type": "EASY_DB_FILE", "url": DUMMY_FILE } };

        request(server).post("/api/test").send(item).end((err, res) => {
            const id = JSON.parse(res.text);
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).get(`/api/test/${id}`).end((err, res) => {
                const body = JSON.parse(res.text);
                assert.isString(body.photo.url);
                assert.notEqual(body.photo.url, item.photo.url);
                done();
            });
        });
    });

    it('save file to different row', (done) => {
        const item = { photo: { "type": "EASY_DB_FILE", "url": DUMMY_FILE } };

        request(server).post("/api/test").send(item).end((err, res) => {
            const id = JSON.parse(res.text);

            request(server).get(`/api/test/${id}`).end((err, res) => {
                const body = JSON.parse(res.text);

                request(server).post("/api/test").send(body).end((err, res) => {
                    const id2 = JSON.parse(res.text);
        
                    request(server).get(`/api/test/${id2}`).end((err, res) => {
                        const body2 = JSON.parse(res.text);

                        assert.equal(body.photo.url, body2.photo.url);
                        
                        done();
                    });
                });
            });
        });
    });

    after(() => {
        server.close();
    });
});

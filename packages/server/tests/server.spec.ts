const TOKEN = "secretToken";

process.env.NODE_ENV = "test";
process.env.EASY_DB_TOKEN = TOKEN;

import { assert, use, request } from "chai";
import chaiHttp from "chai-http";
import server from "../src/cli";

use(chaiHttp);

const DUMMY_FILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function getRowWithoutId(row) {
    const { _id, ...rowWithoutId } = row;
    return rowWithoutId;
}

describe('Easy DB server', () => {
    
    it('server is running', (done) => {
        request(server).get("/").end((err, res) => {
            assert.equal(res.status, 200);
            assert.include(res.text, "Easy DB");
            done();
        });
    });

    it('easy-db token', (done) => {
        request(server).get("/api/test").set("Easy-DB-Token", TOKEN).end((err, res) => {
            assert.equal(res.status, 200);
            done();
        });
    });

    it('easy-db wrong token', (done) => {
        request(server).get("/api/test").set("Easy-DB-Token", "wrongToken").end((err, res) => {
            assert.equal(res.status, 401);
            done();
        });
    });

    it('GET all', (done) => {
        request(server).get("/api/test").set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isArray(body);
            done();
        });
    });

    it('GET all with MongoDB like query', (done) => {
        const query = { b: "Item2" };
        request(server).get(`/api/test?query=${JSON.stringify(query)}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isArray(body);
            body.forEach(value => assert.include(getRowWithoutId(value), query));
            done();
        });
    });

    it('GET all as easy-db-client', (done) => {
        request(server).get("/api/test?easy-db-client=true").set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isNotArray(body);
            done();
        });
    });

    it('POST and GET one', (done) => {
        const item = { a: "Item1" };

        request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                const body = res.body;
                assert.deepEqual(body, item);
                done();
            });
        });
    });

    it('PUT', (done) => {
        const item = { a: "Item1" };
        const putItem = { b: "Item2" };

        request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).put(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).send(putItem).end((err, res) => {
                request(server).get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                    const body = res.body;
                    assert.deepEqual(body, putItem);
                    done();
                });
            });
        });
    });

    it('PATCH', (done) => {
        const item = { a: "Item1" };
        const putItem = { b: "Item2" };

        request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).patch(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).send(putItem).end((err, res) => {
                request(server).get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                    const body = res.body;
                    assert.deepEqual(body, { ...item, ...putItem });
                    done();
                });
            });
        });
    });

    it('DELETE', (done) => {
        const item = { a: "Item DELETE" };

        request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).delete(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                request(server).get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                    const body = res.body;
                    assert.deepEqual(body, null);
                    done();
                });
            });
        });
    });

    
    it('GET all as easy-db-client with MongoDB like query', (done) => {
        const query = { b: "Item2" };
        request(server).get(`/api/test?easy-db-client=true&query=${JSON.stringify(query)}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isNotArray(body);
            Object.values(body).forEach(value => assert.include(value, query));
            done();
        });
    });

    it('GET all with wrong MongoDB like query', (done) => {
        request(server).get(`/api/test?easy-db-client=true&query=abc`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            assert.equal(res.status, 400);
            assert.include(res.text, "JSON");
            done();
        });
    });

    it('GET all with query and sort', (done) => {
        request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send({ query: true, value: Math.random() })
        .end((err, res) => {
            request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send({ query: true, value: Math.random() })
            .end((err, res) => {
                request(server)
                .get(`/api/test?&query=${JSON.stringify({ query: true })}&sort=${JSON.stringify({ value: -1 })}`)
                .set("Easy-DB-Token", TOKEN)
                .end((err, res) => {
                    const body = res.body;
                    assert.equal(res.status, 200);
                    assert.isArray(body);

                    let rowBefore = null;
                    body.forEach(row => {
                        if (rowBefore !== null)
                            assert.isTrue(
                                rowBefore.value >= row.value,
                                `Result is not sorted (${rowBefore.value} >= ${row.value}).`
                            );

                        rowBefore = row;
                    });
                    done();
                });
            });
        });
    });

    it('GET all with limit', (done) => {
        request(server).get(`/api/test?limit=2`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isArray(body);
            assert.strictEqual(body.length, 2);
            done();
        });
    });

    it('GET all with skip', (done) => {
        request(server).get(`/api/test`).set("Easy-DB-Token", TOKEN).end((err, resWithout) => {
            request(server).get(`/api/test?skip=2`).set("Easy-DB-Token", TOKEN).end((err, resWith) => {
                const bodyWithout = resWithout.body;
                assert.equal(resWithout.status, 200);
                assert.isArray(bodyWithout);
    
                const bodyWith = resWith.body;
                assert.equal(resWith.status, 200);
                assert.isArray(bodyWith);
     
                assert.strictEqual(bodyWith.length, bodyWithout.length - 2);
                    
                done();
            });
        });
    });

    it('add file', (done) => {
        const item = { photo: { "type": "EASY_DB_FILE", "url": DUMMY_FILE } };

        request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            request(server).get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                const body = res.body;
                assert.isString(body.photo.url);
                assert.notEqual(body.photo.url, item.photo.url);
                done();
            });
        });
    });

    it('save file to different row', (done) => {
        const item = { photo: { "type": "EASY_DB_FILE", "url": DUMMY_FILE } };

        request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;

            request(server).get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                const body = res.body;

                request(server).post("/api/test").set("Easy-DB-Token", TOKEN).send(body).end((err, res) => {
                    const id2 = res.body;
        
                    request(server).get(`/api/test/${id2}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                        const body2 = res.body;

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

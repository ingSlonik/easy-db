const TOKEN = "secretToken";

process.env.NODE_ENV = "test";
process.env.EASY_DB_TOKEN = TOKEN;

import { use } from "chai";
import chaiHttp from "chai-http";
import server from "../src/cli";

const { assert, request } = use(chaiHttp);

function http(): any {
    return request.execute(server);
}

const DUMMY_FILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function getRowWithoutId(row) {
    const { _id, ...rowWithoutId } = row;
    return rowWithoutId;
}

describe('Easy DB server', () => {

    it('server is running', (done) => {
        http().get("/").end((err, res) => {
            assert.equal(res.status, 200);
            assert.include(res.text, "Easy DB");
            done();
        });
    });

    it('easy-db token', (done) => {
        http().get("/api/test").set("Easy-DB-Token", TOKEN).end((err, res) => {
            assert.equal(res.status, 200);
            done();
        });
    });

    it('easy-db wrong token', (done) => {
        http().get("/api/test").set("Easy-DB-Token", "wrongToken").end((err, res) => {
            assert.equal(res.status, 401);
            done();
        });
    });

    it('GET all', (done) => {
        http().get("/api/test").set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isArray(body);
            done();
        });
    });

    it('GET all with MongoDB like query', (done) => {
        const query = { b: "Item2" };
        http().get(`/api/test?query=${JSON.stringify(query)}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isArray(body);
            body.forEach(value => assert.include(getRowWithoutId(value), query));
            done();
        });
    });

    it('GET all as easy-db-client', (done) => {
        http().get("/api/test?easy-db-client=true").set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isNotArray(body);
            done();
        });
    });

    it('POST and GET one', (done) => {
        const item = { a: "Item1" };

        http().post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            http().get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                const body = res.body;
                assert.deepEqual(body, { _id: id, ...item });
                done();
            });
        });
    });

    it('PUT', (done) => {
        const item = { a: "Item1" };
        const putItem = { b: "Item2" };

        http().post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            http().put(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).send(putItem).end((err, res) => {
                http().get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                    const body = res.body;
                    assert.deepEqual(body, { _id: id, ...putItem });
                    done();
                });
            });
        });
    });

    it('PATCH', (done) => {
        const item = { a: "Item1" };
        const putItem = { b: "Item2" };

        http().post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            http().patch(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).send(putItem).end((err, res) => {
                http().get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                    const body = res.body;
                    assert.deepEqual(body, { _id: id, ...item, ...putItem });
                    done();
                });
            });
        });
    });

    it('DELETE', (done) => {
        const item = { a: "Item DELETE" };

        http().post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            http().delete(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                http().get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                    const body = res.body;
                    assert.deepEqual(body, null);
                    done();
                });
            });
        });
    });


    it('GET all as easy-db-client with MongoDB like query', (done) => {
        const query = { b: "Item2" };
        http().get(`/api/test?easy-db-client=true&query=${JSON.stringify(query)}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isNotArray(body);
            Object.values(body).forEach(value => assert.include(value, query));
            done();
        });
    });

    it('GET all with projection', (done) => {
        const query = { b: "Item2" };
        const projection = { a: 1 };
        http().get(`/api/test?query=${JSON.stringify(query)}&projection=${JSON.stringify(projection)}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isArray(body);
            body.forEach(row => {
                assert.equal(typeof row._id, "string", "Row doesn't have id.");
                assert.equal(typeof row.b, "undefined", "The projection didn't filter 'b' field.");
            });
            done();
        });
    });

    it('GET all with wrong MongoDB like query', (done) => {
        http().get(`/api/test?easy-db-client=true&query=abc`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            assert.equal(res.status, 400);
            assert.include(res.text, "JSON");
            done();
        });
    });

    it('GET all with query and sort', (done) => {
        http().post("/api/test").set("Easy-DB-Token", TOKEN).send({ query: true, value: Math.random() })
            .end((err, res) => {
                http().post("/api/test").set("Easy-DB-Token", TOKEN).send({ query: true, value: Math.random() })
                    .end((err, res) => {
                        http()
                            .get(`/api/test?&query=${JSON.stringify({ query: true })}&sort=${JSON.stringify({ value: -1 })}`)
                            .set("Easy-DB-Token", TOKEN)
                            .end((err, res) => {
                                const body = res.body;
                                assert.equal(res.status, 200);
                                assert.isArray(body);

                                let rowBefore: any = null;
                                body.forEach(row => {
                                    if (rowBefore !== null) {
                                        // @ts-ignore
                                        assert.isTrue(
                                            rowBefore.value >= row.value,
                                            `Result is not sorted (${rowBefore.value} >= ${row.value}).`
                                        );
                                    }

                                    rowBefore = row;
                                });
                                done();
                            });
                    });
            });
    });

    it('GET all with limit', (done) => {
        http().get(`/api/test?limit=2`).set("Easy-DB-Token", TOKEN).end((err, res) => {
            const body = res.body;
            assert.equal(res.status, 200);
            assert.isArray(body);
            assert.strictEqual(body.length, 2);
            done();
        });
    });

    it('GET all with skip', (done) => {
        http().get(`/api/test`).set("Easy-DB-Token", TOKEN).end((err, resWithout) => {
            http().get(`/api/test?skip=2`).set("Easy-DB-Token", TOKEN).end((err, resWith) => {
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

        http().post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;
            assert.equal(res.status, 200);
            assert.isString(id);

            http().get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                const body = res.body;
                assert.isString(body.photo.url);
                assert.notEqual(body.photo.url, item.photo.url);
                done();
            });
        });
    });

    it('save file to different row', (done) => {
        const item = { photo: { "type": "EASY_DB_FILE", "url": DUMMY_FILE } };

        http().post("/api/test").set("Easy-DB-Token", TOKEN).send(item).end((err, res) => {
            const id = res.body;

            http().get(`/api/test/${id}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                const body = res.body;

                http().post("/api/test").set("Easy-DB-Token", TOKEN).send(body).end((err, res) => {
                    const id2 = res.body;

                    http().get(`/api/test/${id2}`).set("Easy-DB-Token", TOKEN).end((err, res) => {
                        const body2 = res.body;

                        assert.equal(body.photo.url, body2.photo.url);

                        done();
                    });
                });
            });
        });
    });

    it('get collections', (done) => {
        http().get("/api/easy-db-collections").set("Easy-DB-Token", TOKEN).end((err, res) => {
            const collections = res.body;
            assert.isArray(collections);
            assert.include(collections, "test");
            done();
        });
    });

    after(() => {
        server.close(() => {
            console.log("Server closed.");
        });
    });
});

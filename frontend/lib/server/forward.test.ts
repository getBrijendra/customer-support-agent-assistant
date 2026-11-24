import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBackendUrl,
  errorJson,
  pickRequestHeaders,
  pickResponseHeaders,
} from "./forward.ts";

describe("buildBackendUrl", () => {
  it("prefixes /api/v1 and keeps the query string", () => {
    assert.equal(
      buildBackendUrl("http://api:8000", ["chats", "abc"], "?limit=5"),
      "http://api:8000/api/v1/chats/abc?limit=5",
    );
  });

  it("re-encodes segments so they cannot add path levels", () => {
    assert.equal(
      buildBackendUrl("http://api", ["companies", "a/b", "x y"], ""),
      "http://api/api/v1/companies/a%2Fb/x%20y",
    );
  });

  it("rejects dot segments", () => {
    assert.throws(() => buildBackendUrl("http://api", ["..", "metrics"], ""));
    assert.throws(() => buildBackendUrl("http://api", ["."], ""));
  });
});

describe("pickRequestHeaders", () => {
  it("forwards only allowlisted headers and sets the API key from the session", () => {
    const h = pickRequestHeaders(
      new Headers({
        "content-type": "multipart/form-data; boundary=x",
        "x-request-id": "r1",
        cookie: "sa_key=secret",
        "x-api-key": "spoofed",
        authorization: "Bearer nope",
      }),
      "real-key",
    );
    assert.equal(h.get("content-type"), "multipart/form-data; boundary=x");
    assert.equal(h.get("x-request-id"), "r1");
    assert.equal(h.get("x-api-key"), "real-key");
    assert.equal(h.get("cookie"), null);
    assert.equal(h.get("authorization"), null);
  });
});

describe("pickResponseHeaders", () => {
  it("keeps useful headers and disables caching", () => {
    const h = pickResponseHeaders(
      new Headers({ "content-type": "application/json", "x-request-id": "r2", "set-cookie": "a=b" }),
    );
    assert.equal(h.get("content-type"), "application/json");
    assert.equal(h.get("x-request-id"), "r2");
    assert.equal(h.get("set-cookie"), null);
    assert.equal(h.get("cache-control"), "no-store");
  });
});

describe("errorJson", () => {
  it("uses the back end's error envelope", async () => {
    const res = errorJson(401, "UNAUTHORIZED", "Not signed in");
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), {
      error: { code: "UNAUTHORIZED", message: "Not signed in", request_id: null },
    });
  });
});

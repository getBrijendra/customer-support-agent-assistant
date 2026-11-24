import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, buildPath, errorMessage, parseError } from "./api.ts";

describe("parseError", () => {
  it("reads the back end's error envelope", () => {
    const e = parseError(409, {
      error: { code: "NO_ACTIVE_GUIDELINES", message: "No active version", request_id: "rq-1" },
    });
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 409);
    assert.equal(e.code, "NO_ACTIVE_GUIDELINES");
    assert.equal(e.message, "No active version");
    assert.equal(e.requestId, "rq-1");
  });

  it("keeps validation details", () => {
    const e = parseError(422, { error: { code: "VALIDATION_ERROR", message: "bad", details: [{ loc: ["x"] }] } });
    assert.deepEqual(e.details, [{ loc: ["x"] }]);
  });

  it("falls back for FastAPI detail bodies and unknown bodies", () => {
    assert.equal(parseError(404, { detail: "Not Found" }).message, "Not Found");
    const e = parseError(500, "<html>oops</html>", "Internal Server Error");
    assert.equal(e.code, "HTTP_500");
    assert.equal(e.message, "Internal Server Error");
  });
});

describe("buildPath", () => {
  it("drops empty query values", () => {
    assert.equal(
      buildPath("/chats", { company: "bookshop", status: "", cursor: undefined, limit: 20 }),
      "/api/proxy/chats?company=bookshop&limit=20",
    );
    assert.equal(buildPath("/companies"), "/api/proxy/companies");
  });
});

describe("errorMessage", () => {
  it("formats ApiError with its code", () => {
    assert.equal(errorMessage(new ApiError(429, "RATE_LIMITED", "Slow down")), "RATE_LIMITED: Slow down");
    assert.equal(errorMessage(new Error("x")), "x");
  });
});

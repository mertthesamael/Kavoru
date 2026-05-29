import { describe, expect, test } from "bun:test";
import {
  HttpStatusError,
  InternalServerError,
  InvalidBodyError,
  NotAuthorizedError,
} from "../src/models/errors/http-error";
import { httpErrorStatus } from "../src/models/errors/helpers";

describe("HTTP error helpers", () => {
  test("create typed status errors", () => {
    expect(NotAuthorizedError("bad token")).toBeInstanceOf(HttpStatusError);
    expect(InvalidBodyError("invalid body")).toBeInstanceOf(HttpStatusError);
    expect(InternalServerError("boom")).toBeInstanceOf(HttpStatusError);
  });

  test("preserve status code and message", () => {
    const unauthorized = NotAuthorizedError("bad token");
    const invalidBody = InvalidBodyError("invalid body");
    const serverError = InternalServerError("boom");

    expect(unauthorized.status).toBe(401);
    expect(invalidBody.status).toBe(400);
    expect(serverError.status).toBe(500);

    expect(unauthorized.message).toBe("bad token");
    expect(invalidBody.message).toBe("invalid body");
    expect(serverError.message).toBe("boom");
  });

  test("keep call-site stack for sentry", () => {
    const err = InternalServerError("Test Error");
    expect(err.stack).toContain("sentry.test.ts");
  });

  test("httpErrorStatus resolves common error shapes", () => {
    expect(httpErrorStatus(NotAuthorizedError())).toBe(401);
    expect(httpErrorStatus(InternalServerError())).toBe(500);

    const generic = new Error("bad request");
    Object.assign(generic, { status: 400 });
    expect(httpErrorStatus(generic)).toBe(400);
  });
});

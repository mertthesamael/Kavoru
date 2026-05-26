import Elysia from "elysia";
import { responseSchema } from "../models/schemas/response";

function isEnvelope(value: unknown): value is typeof responseSchema.static {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    "timestamp" in value &&
    "path" in value
  );
}

function errorMessageFrom(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return "Request failed";
}

export const responseMiddleware = new Elysia({ name: "response" })
  .onAfterHandle(({ responseValue, set, path }) => {
    if (responseValue instanceof Response) return;

    const statusCode = typeof set.status === "number" ? set.status : 200;
    const success = statusCode < 400;

    if (isEnvelope(responseValue)) {
      return {
        status: statusCode,
        ...responseValue,
        success: responseValue.success ?? success,
      };
    }

    if (success) {
      return {
        status: statusCode,
        ...createResponse(responseValue, path),
      };
    }

    return {
      status: statusCode,
      success: false,
      error: {
        code: String(statusCode),
        message: errorMessageFrom(responseValue),
      },
      timestamp: new Date().toISOString(),
      path,
    };
  })
  .as("scoped");

export const createResponse = <T>(
  data: T,
  path: string,
): typeof responseSchema.static => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
  path,
});

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

    return createResponse(responseValue, path, statusCode);
  })
  .as("scoped");

export function createResponse(
  value: unknown,
  path: string,
  statusCode: number,
): typeof responseSchema.static {
  const success = statusCode < 400;
  const timestamp = new Date().toISOString();

  if (isEnvelope(value)) {
    return {
      ...value,
      status: statusCode,
      success: value.success ?? success,
      timestamp: value.timestamp ?? timestamp,
      path: value.path ?? path,
    };
  }

  if (success) {
    return {
      status: statusCode,
      success: true,
      data: value,
      timestamp,
      path,
    };
  }

  return {
    status: statusCode,
    success: false,
    error: {
      code: String(statusCode),
      message: errorMessageFrom(value),
    },
    timestamp,
    path,
  };
}

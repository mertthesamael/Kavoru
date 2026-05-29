import { HttpStatusError, isElysiaStatusResponse } from "./http-error";

export function defaultMessage(statusCode: number): string {
  if (statusCode === 401) return "Unauthorized";
  if (statusCode === 400) return "Bad Request";
  if (statusCode >= 500) return "Internal Server Error";
  return "Request failed";
}

export function statusLabel(statusCode: number): string {
  if (statusCode === 401) return "UnauthorizedError";
  if (statusCode === 400) return "BadRequestError";
  if (statusCode >= 500) return "InternalServerError";
  return "HttpStatusError";
}

export function isHttpStatusError(error: unknown): error is HttpStatusError {
  return error instanceof HttpStatusError;
}

export function httpErrorStatus(error: unknown): number | undefined {
  if (isElysiaStatusResponse(error)) return error.code;
  if (isHttpStatusError(error)) return error.status;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

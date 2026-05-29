import { defaultMessage, statusLabel } from "./helpers";

export type ElysiaStatusResponse = {
  code: number;
  response: unknown;
};

export function isElysiaStatusResponse(
  error: unknown,
): error is ElysiaStatusResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    error.constructor.name === "ElysiaCustomStatusResponse" &&
    "code" in error &&
    typeof (error as ElysiaStatusResponse).code === "number"
  );
}

export class HttpStatusError extends Error {
  readonly status: number;

  constructor(statusCode: number, message?: string) {
    super(message ?? defaultMessage(statusCode));
    this.status = statusCode;
    this.name = statusLabel(statusCode);
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, HttpStatusError);
    }
  }
}

export const NotAuthorizedError = (message?: string) => {
  return new HttpStatusError(401, message);
};

export const InvalidBodyError = (message?: string) => {
  return new HttpStatusError(400, message);
};

export const InternalServerError = (message?: string) => {
  return new HttpStatusError(500, message);
};

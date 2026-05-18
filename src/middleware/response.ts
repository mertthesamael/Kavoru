import Elysia from "elysia";
import { responseSchema } from "../models/schemas/response";
import {
  PERF_START_HEADER,
  REQUEST_PHASE_ELAPSED_HEADER,
} from "../constants/headers";

function isEnvelope(value: unknown): value is typeof responseSchema.static {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    "timestamp" in value &&
    "path" in value
  );
}

export const responseMiddleware = new Elysia({ name: "response" })
  .onAfterHandle(({ responseValue, set, path }) => {
    if (responseValue instanceof Response) return;

    const statusCode = typeof set.status === "number" ? set.status : 200;

    const elapsedRaw = set.headers[REQUEST_PHASE_ELAPSED_HEADER];
    const startRaw = set.headers[PERF_START_HEADER];

    const timingChunk = {
      ...(typeof elapsedRaw === "string" ? { elapsedMs: elapsedRaw } : {}),
      ...(typeof startRaw === "string"
        ? {
            responseElapsedMs: (performance.now() - Number(startRaw)).toFixed(
              8,
            ),
          }
        : {}),
    };

    const body = isEnvelope(responseValue)
      ? { ...responseValue, ...timingChunk }
      : { ...createResponse(responseValue, path), ...timingChunk };

    return {
      status: statusCode,
      ...body,
    };
  })
  .onAfterResponse(({ set }) => {
    delete set.headers[REQUEST_PHASE_ELAPSED_HEADER];
    delete set.headers[PERF_START_HEADER];
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

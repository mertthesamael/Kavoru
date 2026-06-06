import * as Sentry from "@sentry/elysia";
import type { Elysia } from "elysia";
import { config } from "../../config";
import {
  isElysiaStatusResponse,
  type ElysiaStatusResponse,
} from "../../models/errors/http-error";
import { httpErrorStatus } from "../../models/errors/helpers";
import { SPOTLIGHT_PLACEHOLDER_DSN } from "../../constants/sentry";
import type { HttpErrorContext, ElysiaErrorContext } from "./types";

let initialized = false;

function isSentryEnabled() {
  return Boolean(
    config.env.server.sentryDsn || config.env.server.sentrySpotlight,
  );
}

function parseHttpStatus(status: unknown): number | undefined {
  if (status === undefined) return undefined;
  const code =
    typeof status === "number" ? status : Number.parseInt(String(status), 10);
  return Number.isNaN(code) ? undefined : code;
}

function statusResponseMessage(response: unknown, code: number): string {
  if (typeof response === "string" && response.length > 0) return response;
  if (response !== undefined && response !== null) {
    try {
      return JSON.stringify(response);
    } catch {
      return `HTTP ${code}`;
    }
  }
  return `HTTP ${code}`;
}

function statusResponseToError(statusResponse: ElysiaStatusResponse): Error {
  const err = new Error(
    statusResponseMessage(statusResponse.response, statusResponse.code),
  );
  err.name = "ElysiaStatusError";
  Object.assign(err, { statusCode: statusResponse.code });
  return err;
}

function shouldCaptureStatusResponse(context: HttpErrorContext): boolean {
  const { error } = context;
  if (!isElysiaStatusResponse(error)) return false;
  return error.code >= 500;
}

function shouldCaptureHttpError(context: HttpErrorContext): boolean {
  const { error, set } = context;

  if (isElysiaStatusResponse(error)) return false;

  const httpStatus = parseHttpStatus(set.status) ?? httpErrorStatus(error);

  if (httpStatus !== undefined && httpStatus < 500) return false;

  return error instanceof Error;
}

function captureStatusResponse(context: ElysiaErrorContext) {
  const { error, request, route, path } = context;
  if (!isElysiaStatusResponse(error) || !shouldCaptureStatusResponse(context)) {
    return;
  }

  const httpError = statusResponseToError(error);
  const transaction = `${request.method} ${route || path}`;

  Sentry.withScope((scope) => {
    scope.setTag("http.status_code", String(error.code));
    scope.setTransactionName(transaction);
    scope.setContext("elysia", {
      route,
      path,
      method: request.method,
      statusCode: error.code,
      response: error.response,
      kind: "ElysiaCustomStatusResponse",
    });
    Sentry.captureException(httpError, {
      mechanism: {
        type: "http.elysia.status",
        handled: false,
      },
    });
  });
}

export function initSentry() {
  if (!isSentryEnabled() || initialized) return;

  const spotlight = config.env.server.sentrySpotlight;
  const dsn = config.env.server.sentryDsn ?? SPOTLIGHT_PLACEHOLDER_DSN;

  const skipOpenTelemetrySetup = Boolean(
    config.env.server.otelExporterOtlpEndpoint,
  );

  Sentry.init({
    dsn,
    environment: config.env.env,
    release: config.version,
    tracesSampleRate: skipOpenTelemetrySetup
      ? 0
      : config.env.server.sentryTracesSampleRate,
    skipOpenTelemetrySetup,
    ...(spotlight ? { spotlight } : {}),
  });

  initialized = true;
}

function isOtelTracingEnabled() {
  return Boolean(config.env.server.otelExporterOtlpEndpoint);
}

function attachSentryErrorHandlers(app: Elysia) {
  return app.onError({ as: "global" }, (ctx) => {
    if (!("error" in ctx)) return;

    captureStatusResponse({
      error: (ctx as { error: unknown }).error,
      set: ctx.set,
      request: ctx.request,
      route: ctx.route,
      path: ctx.path,
    });

    const error = (ctx as { error: unknown }).error;
    if (isElysiaStatusResponse(error)) return;
    if (
      !shouldCaptureHttpError({
        error,
        set: ctx.set,
      })
    ) {
      return;
    }

    if (error instanceof Error) {
      Sentry.captureException(error, {
        mechanism: {
          type: "http.elysia.on_error",
          handled: false,
        },
      });
    }
  });
}

export function withSentry(app: Elysia) {
  if (!isSentryEnabled()) return app;

  // Sentry.withElysia creates duplicate OTEL spans (anonymous) that break otel-dev.
  // When exporting to otel-dev, keep Sentry for errors/Spotlight only.
  if (isOtelTracingEnabled()) {
    return attachSentryErrorHandlers(app);
  }

  const instrumented = Sentry.withElysia(app, {
    shouldHandleError: (ctx) => {
      if (!("error" in ctx)) return false;
      const error = (ctx as { error: unknown }).error;
      if (isElysiaStatusResponse(error)) return false;
      return shouldCaptureHttpError({
        error,
        set: ctx.set,
      });
    },
  });

  return instrumented.onError({ as: "global" }, (ctx) => {
    if (!("error" in ctx)) return;
    captureStatusResponse({
      error: (ctx as { error: unknown }).error,
      set: ctx.set,
      request: ctx.request,
      route: ctx.route,
      path: ctx.path,
    });
  });
}

export async function flushSentry(timeout = 2000) {
  if (!initialized) return;
  await Sentry.close(timeout);
}

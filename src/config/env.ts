import { t, getSchemaValidator } from "elysia";
import { AppError } from "../models/errors/app-error";

export type AppConfig = ReturnType<typeof loadEnv>;

const envSchema = t.Object({
  NODE_ENV: t.Union(
    [t.Literal("development"), t.Literal("test"), t.Literal("production")],
    { default: "development" },
  ),
  PORT: t.Numeric({ default: 3131 }),
  OTEL_EXPORTER_OTLP_ENDPOINT: t.Optional(t.String({ format: "uri" })),
  OTEL_SERVICE_NAME: t.String({ default: "elysia-template" }),
  DATABASE_URL: t.Optional(t.String()),
  JWT_SECRET: t.String({ default: "change-me-in-production" }),
});

const envValidator = getSchemaValidator(envSchema, {
  additionalProperties: true,
});

function buildEnvFromSchema(schema: {
  properties: Record<string, { default?: unknown }>;
}) {
  return Object.fromEntries(
    Object.entries(schema.properties).map(([key, prop]) => {
      const raw = process.env[key];
      const value = raw === "" ? undefined : (raw ?? prop.default);
      return [key, value];
    }),
  );
}

function formatEnvError(err: unknown) {
  if (!err || typeof err !== "object") return "Validation failed";
  const e = err as Record<string, unknown>;
  const path = Array.isArray(e.path) ? e.path[0] : e.path;
  const property =
    typeof path === "string" ? path.slice(1).replaceAll("/", ".") : "Value";

  const schema = e.schema as
    | {
        anyOf?: Array<{
          const?: unknown;
          enum?: unknown[];
          format?: string;
          type?: string;
        }>;
      }
    | undefined;
  const anyOf = schema?.anyOf;
  if (anyOf?.length) {
    const literalValues = anyOf
      .map((x) => (x.const !== undefined ? x.const : x.enum?.[0]))
      .filter((v) => v !== undefined);
    if (literalValues.length > 0) {
      return `Property '${property}' should be one of: ${literalValues.map((v) => `'${v}'`).join(", ")}`;
    }
    const hasNumeric =
      anyOf.some((x) => x.format === "numeric" || x.type === "number") &&
      literalValues.length === 0;
    if (hasNumeric) {
      return `Property '${property}' should be a number or numeric string`;
    }
  }
  return (e.summary ?? e.message ?? "Validation failed") as string;
}

export function loadEnv() {
  const parsed = envValidator.safeParse(
    buildEnvFromSchema(
      envSchema as { properties: Record<string, { default?: unknown }> },
    ),
  );

  if (!parsed.success) {
    const details =
      parsed.errors
        ?.map((e) => (e ? formatEnvError(e) : ""))
        .filter(Boolean)
        .join("\n") ??
      parsed.error ??
      "Validation failed";
    throw new AppError(
      "ENV_VALIDATION_FAILED",
      "Environment validation failed",
      details,
    );
  }

  const env = parsed.data;
  const otelExporterOtlpEndpoint =
    env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    (env.NODE_ENV === "development"
      ? "http://localhost:4318/v1/traces"
      : undefined);

  return {
    env: env.NODE_ENV,
    server: {
      port: env.PORT,
      otelExporterOtlpEndpoint,
      otelServiceName: env.OTEL_SERVICE_NAME,
    },
    database: {
      url: env.DATABASE_URL,
    },
    jwt: {
      secret: env.JWT_SECRET,
    },
  };
}

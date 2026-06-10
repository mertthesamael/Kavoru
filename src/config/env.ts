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
  OTEL_SERVICE_NAME: t.String({ default: "kavoru" }),
  SENTRY_DSN: t.Optional(t.String({ format: "uri" })),
  SENTRY_SPOTLIGHT: t.Optional(t.String()),
  SENTRY_TRACES_SAMPLE_RATE: t.Optional(
    t.Numeric({ minimum: 0, maximum: 1 }),
  ),
  DATABASE_URL: t.Optional(t.String()),
  JWT_SECRET: t.String({ default: "change-me-in-production" }),
  KAFKA_ENABLED: t.Optional(t.String()),
  KAFKA_BROKERS: t.Optional(t.String()),
  KAFKA_CLIENT_ID: t.String({ default: "kavoru" }),
  KAFKA_GROUP_ID: t.String({ default: "kavoru-consumer" }),
  KAFKA_TOPIC: t.String({ default: "elysia.events" }),
  REDIS_ENABLED: t.Optional(t.String()),
  REDIS_URL: t.Optional(t.String()),
  REDIS_USERNAME: t.Optional(t.String()),
  REDIS_PASSWORD: t.Optional(t.String()),
  RESEND_API_KEY: t.Optional(t.String()),
  RESEND_FROM: t.Optional(t.String()),
  RESEND_ENABLED: t.Optional(t.String()),
});

const envValidator = getSchemaValidator(envSchema, {
  additionalProperties: true,
});

function buildEnvFromSchema(schema: {
  properties: Record<string, { default?: unknown }>;
}) {
  return Object.fromEntries(
    Object.entries(schema.properties).map(([key, prop]) => {
      const raw = Bun.env[key];
      const value = raw === "" ? undefined : (raw ?? prop.default);
      return [key, value];
    }),
  );
}

function resolveKafkaEnabled(
  raw: string | undefined,
  nodeEnv: string,
): boolean {
  if (nodeEnv === "test") return false;
  if (raw === "false" || raw === "0" || raw === "") return false;
  if (raw === "true" || raw === "1") return true;
  return nodeEnv === "development";
}

function resolveRedisEnabled(
  raw: string | undefined,
  nodeEnv: string,
): boolean {
  if (nodeEnv === "test") return false;
  if (raw === "false" || raw === "0" || raw === "") return false;
  if (raw === "true" || raw === "1") return true;
  return nodeEnv === "development";
}

function resolveRedisUrl(raw: string | undefined, nodeEnv: string) {
  if (raw) return raw;
  if (nodeEnv === "development") return "redis://localhost:6379";
  return undefined;
}

function resolveResendEnabled(
  raw: string | undefined,
  apiKey: string | undefined,
  nodeEnv: string,
): boolean {
  if (nodeEnv === "test") return false;
  if (raw === "false" || raw === "0" || raw === "") return false;
  if (!apiKey) return false;
  if (raw === "true" || raw === "1") return true;
  return true;
}

function parseKafkaBrokers(raw: string | undefined, nodeEnv: string) {
  const value =
    raw ?? (nodeEnv === "development" ? "localhost:9092" : undefined);
  if (!value) return [];
  return value
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}

function resolveSentrySpotlight(
  raw: string | undefined,
  nodeEnv: string,
): boolean | string | false {
  if (nodeEnv === "test") return false;
  if (raw === "") return false;
  if (raw === "false" || raw === "0") return false;
  if (raw && raw !== "true" && raw !== "1") return raw;
  if (raw === "true" || raw === "1") return true;
  return nodeEnv === "development";
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

  const sentryTracesSampleRate =
    env.SENTRY_TRACES_SAMPLE_RATE ??
    (env.NODE_ENV === "production" ? 0.1 : 1.0);

  const sentrySpotlight = resolveSentrySpotlight(
    env.SENTRY_SPOTLIGHT,
    env.NODE_ENV,
  );

  const kafkaEnabled = resolveKafkaEnabled(env.KAFKA_ENABLED, env.NODE_ENV);
  const kafkaBrokers = parseKafkaBrokers(env.KAFKA_BROKERS, env.NODE_ENV);
  const redisEnabled = resolveRedisEnabled(env.REDIS_ENABLED, env.NODE_ENV);
  const redisUrl = resolveRedisUrl(env.REDIS_URL, env.NODE_ENV);

  const resendEnabled = resolveResendEnabled(
    env.RESEND_ENABLED,
    env.RESEND_API_KEY,
    env.NODE_ENV,
  );

  return {
    env: env.NODE_ENV,
    server: {
      port: env.PORT,
      otelExporterOtlpEndpoint,
      otelServiceName: env.OTEL_SERVICE_NAME,
      sentryDsn: env.SENTRY_DSN,
      sentrySpotlight,
      sentryTracesSampleRate,
    },
    database: {
      url: env.DATABASE_URL,
    },
    jwt: {
      secret: env.JWT_SECRET,
    },
    kafka: {
      enabled: kafkaEnabled && kafkaBrokers.length > 0,
      brokers: kafkaBrokers,
      clientId: env.KAFKA_CLIENT_ID,
      groupId: env.KAFKA_GROUP_ID,
      topic: env.KAFKA_TOPIC,
    },
    redis: {
      enabled: redisEnabled && Boolean(redisUrl),
      url: redisUrl,
      username: env.REDIS_USERNAME,
      password: env.REDIS_PASSWORD,
    },
    resend: {
      enabled: resendEnabled,
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM,
    },
  };
}

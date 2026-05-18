type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

const useColor =
  process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
const textColors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const ansi = {
  reset: textColors.white,
  dim: textColors.gray,
  debug: textColors.blue,
  info: textColors.green,
  warn: textColors.yellow,
  error: textColors.red,
} as const;

export function colorLevel(level: LogLevel, label: string): string {
  if (!useColor) return label;
  const code = ansi[level];
  return `${code}${label}${ansi.reset}`;
}

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= levelPriority[envLevel];
}

function format(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  const tsRaw = new Date().toISOString();
  const ts = useColor ? `${ansi.dim}${tsRaw}${ansi.reset}` : tsRaw;
  const levelLabel = `[${level.toUpperCase()}]`;
  const base = `[${ts}] ${colorLevel(level, levelLabel)} ${message}`;
  if (!meta || Object.keys(meta).length === 0) {
    return base;
  }
  const suffix = useColor
    ? `${ansi.dim}${JSON.stringify(meta)}${ansi.reset}`
    : JSON.stringify(meta);
  return `${base} ${suffix}`;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("debug")) {
      console.debug(format("debug", message, meta));
    }
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("info")) {
      console.info(format("info", message, meta));
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("warn")) {
      console.warn(format("warn", message, meta));
    }
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog("error")) {
      console.error(format("error", message, meta));
    }
  },
};

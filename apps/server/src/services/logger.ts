type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export function createLogger(
  options: { json?: boolean; level?: Level } = {},
): Logger {
  const min = ORDER[options.level ?? "info"];
  const write = (level: Level, msg: string, meta?: Record<string, unknown>) => {
    if (ORDER[level] < min) return;
    const out =
      level === "error" || level === "warn" ? console.error : console.log;
    if (options.json) {
      out(
        JSON.stringify({ time: new Date().toISOString(), level, msg, ...meta }),
      );
    } else {
      out(`[${level}] ${msg}${meta ? ` ${JSON.stringify(meta)}` : ""}`);
    }
  };
  return {
    debug: (m, meta) => write("debug", m, meta),
    info: (m, meta) => write("info", m, meta),
    warn: (m, meta) => write("warn", m, meta),
    error: (m, meta) => write("error", m, meta),
  };
}

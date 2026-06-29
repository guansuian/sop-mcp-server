/**
 * 简易日志工具
 * 输出到 stderr（避免干扰 stdio MCP 通信）
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = "INFO";

function getTimestamp(): string {
    return new Date().toISOString();
}

function log(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

    const timestamp = getTimestamp();
    const prefix = `[${timestamp}] [${level}] [MES-MCP]`;

    if (data !== undefined) {
        const dataStr =
            data instanceof Error
                ? `${data.message}\n${data.stack}`
                : typeof data === "object"
                    ? JSON.stringify(data, null, 2)
                    : String(data);
        process.stderr.write(`${prefix} ${message}\n${dataStr}\n`);
    } else {
        process.stderr.write(`${prefix} ${message}\n`);
    }
}

export const logger = {
    debug: (msg: string, data?: unknown) => log("DEBUG", msg, data),
    info: (msg: string, data?: unknown) => log("INFO", msg, data),
    warn: (msg: string, data?: unknown) => log("WARN", msg, data),
    error: (msg: string, data?: unknown) => log("ERROR", msg, data),
};

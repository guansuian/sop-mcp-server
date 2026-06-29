/**
 * MES @NoRepeatSubmit：同一 token + 同一请求 URI，2 秒内重复提交会被拒绝（code=7）。
 * 按 URL 串行排队，保证同路径写入间隔 ≥ intervalMs。
 */

import { logger } from "./logger.js";

const DEFAULT_INTERVAL_MS = 2100;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WriteThrottle {
    private readonly intervalMs: number;
    private readonly tail = new Map<string, Promise<void>>();
    private readonly lastEndAt = new Map<string, number>();

    constructor(intervalMs = DEFAULT_INTERVAL_MS) {
        this.intervalMs = intervalMs;
    }

    getIntervalMs(): number {
        return this.intervalMs;
    }

    /**
     * 对同一 url 的写入操作排队执行，自动插入间隔。
     */
    async schedule<T>(url: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.tail.get(url) ?? Promise.resolve();

        const resultPromise = prev.then(async () => {
            const lastEnd = this.lastEndAt.get(url) ?? 0;
            const wait = Math.max(0, this.intervalMs - (Date.now() - lastEnd));
            if (wait > 0) {
                logger.debug(`WriteThrottle: wait ${wait}ms before ${url}`);
                await sleep(wait);
            }
            try {
                return await fn();
            } finally {
                this.lastEndAt.set(url, Date.now());
            }
        });

        this.tail.set(
            url,
            resultPromise
                .then(() => undefined)
                .catch(() => undefined)
        );

        return resultPromise;
    }
}

export const DEFAULT_WRITE_INTERVAL_MS = DEFAULT_INTERVAL_MS;

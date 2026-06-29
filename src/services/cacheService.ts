/**
 * 简易内存缓存服务
 * 用于缓存 Token 和字段元数据，减少重复请求
 */

import { logger } from "../utils/logger.js";

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class CacheService {
    private store = new Map<string, CacheEntry<unknown>>();

    /**
     * 获取缓存值
     * @returns 缓存值，若不存在或已过期则返回 undefined
     */
    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            logger.debug(`Cache expired: ${key}`);
            return undefined;
        }

        logger.debug(`Cache hit: ${key}`);
        return entry.value as T;
    }

    /**
     * 设置缓存值
     * @param key 缓存键
     * @param value 缓存值
     * @param ttlMs 过期时间（毫秒），默认 5 分钟
     */
    set<T>(key: string, value: T, ttlMs = 5 * 60 * 1000): void {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
        logger.debug(`Cache set: ${key}, TTL: ${ttlMs}ms`);
    }

    /** 删除缓存 */
    delete(key: string): void {
        this.store.delete(key);
        logger.debug(`Cache deleted: ${key}`);
    }

    /** 清空所有缓存 */
    clear(): void {
        this.store.clear();
        logger.debug("Cache cleared");
    }

    /** 获取缓存大小 */
    get size(): number {
        return this.store.size;
    }
}

/** 全局缓存实例 */
export const cacheService = new CacheService();

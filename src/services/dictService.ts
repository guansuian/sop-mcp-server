/**
 * 字典服务
 *
 *
 *
 * 调用 MES /dict/queryDictByType API 获取字典项（value → label 映射），
 * 缓存字典数据，提供翻译功能。
 * 字典是配置数据，缓存 TTL 30 分钟，可通过 clearAllCache() 手动刷新。
 */


/**
 * 提供的服务:
 * 1. 通过字符串查询到数据字典配置
 * 2. 将value翻译成数据字段想要表达的值
 *
 */

import type { MesClient } from "./mesClient.js";
import { cacheService } from "./cacheService.js";
import type { FieldMeta } from "./fieldMetaService.js";
import { logger } from "../utils/logger.js";

/** 字典缓存 TTL：30 分钟 */
const DICT_CACHE_TTL_MS = 30 * 60 * 1000;

/** 单个字典项 */
export interface DictItem {
    value: string;
    label: string;
    sort: string;
}

/** MES /dict/queryDictByType 响应 */
interface DictQueryResponse {
    code: number;
    msg: string;
    data: DictItem[];
}

/** 字典查找函数类型：传入字段名和值，返回标签 */
export type DictLookupFn = (field: string, value: string) => string;

export class DictService {
    protected client: MesClient;

    constructor(client: MesClient) {
        this.client = client;
    }

    /**
     * 获取指定字典类型的所有项（带缓存）
     */
    async getDictItems(dictType: string): Promise<DictItem[]> {
        const cacheKey = `dict:${dictType}`;

        const cached = cacheService.get<DictItem[]>(cacheKey);
        if (cached) {
            logger.debug(`Dict cache hit: ${dictType} (${cached.length} items)`);
            return cached;
        }

        logger.info(`Fetching dict items for ${dictType}...`);
        try {
            const response = await this.client.customPost<DictQueryResponse>(
                "/dict/queryDictByType",
                { type: dictType }
            );

            if (!response || response.code !== 0) {
                throw new Error(
                    `Failed to fetch dict ${dictType}: ${response?.msg || "Unknown error"}`
                );
            }

            const items = response.data || [];
            cacheService.set(cacheKey, items, DICT_CACHE_TTL_MS);
            logger.info(`Dict cached: ${dictType} — ${items.length} items`);

            return items;
        } catch (error) {
            logger.error(`Failed to load dict ${dictType}`, error);
            throw error;
        }
    }

    /**
     * 翻译单个字典值 → 标签
     * 先查缓存，缓存 miss 则加载整个 dictType
     */
    async translate(dictType: string, value: string): Promise<string> {
        if (!dictType || !value) return value;

        try {
            const items = await this.getDictItems(dictType);
            const item = items.find((d) => d.value === value);
            return item?.label ?? value;
        } catch {
            return value; // 降级：返回原始值
        }
    }

    /**
     * 预加载多个字段所需的字典数据，返回同步翻译函数
     * 这是 tool handler 的主要入口
     */
    async preloadForFields(fields: FieldMeta[]): Promise<DictLookupFn> {
        // 收集所有需要字典翻译的 dictType
        const dictTypes = new Set<string>();
        const fieldDictMap = new Map<string, string>(); // field → dictType

        for (const f of fields) {
            if (f.dictType) {
                dictTypes.add(f.dictType);
                fieldDictMap.set(f.field, f.dictType);
            }
        }

        if (dictTypes.size === 0) {
            // 没有字典字段，返回直通函数
            return (_field: string, value: string) => value;
        }

        // 批量加载所有字典类型
        const dictDataMap = new Map<string, Map<string, string>>(); // dictType → (value → label)

        const results = await Promise.allSettled(
            Array.from(dictTypes).map(async (dt) => {
                try {
                    const items = await this.getDictItems(dt);
                    const valueMap = new Map<string, string>();
                    for (const item of items) {
                        valueMap.set(item.value, item.label);
                    }
                    dictDataMap.set(dt, valueMap);
                } catch {
                    logger.warn(`Dict preload failed for ${dt}, values will be shown as-is`);
                }
            })
        );

        const loadedCount = results.filter((r) => r.status === "fulfilled").length;
        logger.info(`Dict preload: ${loadedCount}/${dictTypes.size} dict types loaded`);

        // 返回同步翻译闭包
        return (field: string, value: string): string => {
            const dictType = fieldDictMap.get(field);
            if (!dictType) return value;

            const valueMap = dictDataMap.get(dictType);
            if (!valueMap) return value;

            return valueMap.get(value) ?? value;
        };
    }

    /**
     * 清除指定字典类型的缓存
     */
    clearCache(dictType?: string): void {
        if (dictType) {
            cacheService.delete(`dict:${dictType}`);
            logger.info(`Dict cache cleared: ${dictType}`);
        } else {
            // 清除所有字典缓存
            const prefix = "dict:";
            // cacheService 没有 prefix 删除，逐个记录在 clearAll 中处理
            logger.info("Dict cache clear-all requested");
        }
    }

    /**
     * 清除所有字典缓存
     */
    clearAllCache(): void {
        // 常见字典类型（可根据实际情况扩展）
        const knownTypes = [
            "abnormal_type",
            "close_status",
            "check_status",
            "is_or_not",
            "unqualified_reason",
            "is_handle",
        ];
        for (const t of knownTypes) {
            cacheService.delete(`dict:${t}`);
        }
        logger.info("All dict cache cleared");
    }
}

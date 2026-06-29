import type { MesClient } from "../mesClient.js";
import { cacheService } from "../cacheService.js";
import { DictService, type DictItem, type DictLookupFn } from "../dictService.js";
import type { FormSchemaField } from "./formSchemaService.js";
import { logger } from "../../utils/logger.js";

const DICT_CACHE_TTL_MS = 30 * 60 * 1000;

export type DictItemsByType = Record<string, DictItem[]>;
export type DictValueLabelMap = Record<string, Record<string, string>>;

interface BatchDictQueryResponse {
    code: number;
    msg?: string;
    message?: string;
    data?: Record<string, unknown>;
}


/**
 * FormPageQueryService的第二步
 *
 * getDictMapByFields
 * 通过先查询你from服务，将列表传入，就可以得到
 * Record<string, Record<string, string>>;类型的数据
 */

export class BatchDictService extends DictService {
    constructor(client: MesClient) {
        super(client);
    }


    async getDictItemsByTypes(dictTypes: string[] | string): Promise<DictItemsByType> {
        const types = normalizeDictTypes(dictTypes);
        if (types.length === 0) {
            return {};
        }

        const result: DictItemsByType = {};
        const missingTypes: string[] = [];

        for (const type of types) {
            const cached = cacheService.get<DictItem[]>(cacheKey(type));
            if (cached) {
                result[type] = cached;
            } else {
                missingTypes.push(type);
            }
        }

        if (missingTypes.length === 0) {
            return result;
        }

        logger.info(`Batch fetching dict items: ${missingTypes.join(",")}`);
        const response = await this.client.customPost<BatchDictQueryResponse>(
            "/dict/queryDictByTypes",
            { types: missingTypes.join(",") }
        );

        if (!response || Number(response.code) !== 0) {
            throw new Error(
                `Failed to fetch dict types ${missingTypes.join(",")}: ${getResponseMessage(response)}`
            );
        }

        const data = response.data ?? {};
        for (const type of missingTypes) {
            const items = normalizeDictItems(data[type]);
            result[type] = items;
            cacheService.set(cacheKey(type), items, DICT_CACHE_TTL_MS);
        }

        return result;
    }

    async getDictMapByTypes(dictTypes: string[] | string): Promise<DictValueLabelMap> {
        const itemsByType = await this.getDictItemsByTypes(dictTypes);
        return toValueLabelMap(itemsByType);
    }

    /**
     * getDictMapByFields -> getDictMapByTypes -> getDictItemsByTypes
     * @param fields
     */
    async getDictMapByFields(fields: FormSchemaField[]): Promise<DictValueLabelMap> {
        return this.getDictMapByTypes(collectDictTypesFromFields(fields));
    }

    async preloadForSchemaFields(fields: FormSchemaField[]): Promise<DictLookupFn> {
        const fieldDictMap = new Map<string, string>();
        for (const field of fields) {
            if (isDictField(field)) {
                fieldDictMap.set(field.field, field.dictType);
            }
        }

        const dictMap = await this.getDictMapByTypes(Array.from(fieldDictMap.values()));
        return (field: string, value: string): string => {
            const dictType = fieldDictMap.get(field);
            if (!dictType) {
                return value;
            }
            return dictMap[dictType]?.[String(value)] ?? value;
        };
    }
}

function collectDictTypesFromFields(fields: FormSchemaField[]): string[] {
    const dictTypes = new Set<string>();
    for (const field of fields) {
        if (isDictField(field)) {
            dictTypes.add(field.dictType);
        }
    }
    return Array.from(dictTypes);
}

function isDictField(field: FormSchemaField): boolean {
    return field.formType === "select" && field.dictType.trim().length > 0;
}

function normalizeDictTypes(dictTypes: string[] | string): string[] {
    const rawTypes = Array.isArray(dictTypes) ? dictTypes : dictTypes.split(",");
    return Array.from(
        new Set(rawTypes.map((type) => type.trim()).filter((type) => type.length > 0))
    );
}

function normalizeDictItems(value: unknown): DictItem[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is Record<string, unknown> => {
            return Boolean(item) && typeof item === "object" && !Array.isArray(item);
        })
        .map((item) => ({
            value: String(item.value ?? "").trim(),
            label: String(item.label ?? item.text ?? item.name ?? item.value ?? "").trim(),
            sort: String(item.sort ?? ""),
        }))
        .filter((item) => item.value.length > 0);
}

function toValueLabelMap(itemsByType: DictItemsByType): DictValueLabelMap {
    const result: DictValueLabelMap = {};

    for (const [type, items] of Object.entries(itemsByType)) {
        result[type] = {};
        for (const item of items) {
            result[type][item.value] = item.label;
        }
    }

    return result;
}

function cacheKey(dictType: string): string {
    return `dict:${dictType}`;
}

function getResponseMessage(response: BatchDictQueryResponse | null | undefined): string {
    const text = response?.msg ?? response?.message;
    if (text === undefined || text === null || String(text).trim() === "") {
        return "Unknown error";
    }
    return String(text);
}

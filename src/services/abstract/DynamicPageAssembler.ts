import type { MesPageResponse } from "../../types/api.js";
import type { FormSchema, FormSchemaField } from "./formSchemaService.js";
import type { DictValueLabelMap } from "./BatchDictService.js";

export interface DynamicColumn {
    title: string;
    field: string;
    width: number;
    formType: string;
    fieldType: string;
    dictType: string;
    sort: number;
    tableAlias: string;
    tableField: string;
}

export interface DynamicPageInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPrevPage: boolean;
    prevPage: number | null;
    hasNextPage: boolean;
    nextPage: number | null;
}

export interface DynamicPageResult {
    columns: DynamicColumn[];
    rawRecords: Record<string, unknown>[];
    displayRecords: Record<string, string>[];
    pageInfo: DynamicPageInfo;
}

export interface DynamicPageAssemblerOptions {
    schema: FormSchema;
    dictMap: DictValueLabelMap;
    pageResult: MesPageResponse;
    page: number;
    limit: number;
}

/**
 *  把“后端分页查询结果”整理成“前端/Work Buddy 好用的展示结果”
 *  {
 *   schema,      // 字段配置
 *   dictMap,     // 数据字典
 *   pageResult,  // 后端分页查询原始结果
 *   page,
 *   limit
 * }
 */
export class DynamicPageAssembler {
    assemble(options: DynamicPageAssemblerOptions): DynamicPageResult {
        const columns = options.schema.tableFields.map(toDynamicColumn);
        const rawRecords = toRawRecords(options.pageResult.data);
        const pageInfo = buildPageInfo({
            pageResult: options.pageResult,
            page: options.page,
            limit: options.limit,
        });

        return {
            columns,
            rawRecords,
            displayRecords: rawRecords.map((record) =>
                toDisplayRecord(record, options.schema.tableFields, options.dictMap)
            ),
            pageInfo,
        };
    }
}

function toDynamicColumn(field: FormSchemaField): DynamicColumn {
    return {
        title: field.title,
        field: field.field,
        width: field.width,
        formType: field.formType,
        fieldType: field.fieldType,
        dictType: field.dictType,
        sort: field.sort,
        tableAlias: field.tableAlias,
        tableField: field.tableField,
    };
}

function toRawRecords(data: unknown): Record<string, unknown>[] {
    if (!Array.isArray(data)) {
        return [];
    }

    return data.filter((item): item is Record<string, unknown> => {
        return Boolean(item) && typeof item === "object" && !Array.isArray(item);
    });
}

function toDisplayRecord(
    record: Record<string, unknown>,
    fields: FormSchemaField[],
    dictMap: DictValueLabelMap
): Record<string, string> {
    const displayRecord: Record<string, string> = {};

    for (const field of fields) {
        displayRecord[field.field] = formatDisplayValue(field, record[field.field], dictMap);
    }

    return displayRecord;
}

function formatDisplayValue(
    field: FormSchemaField,
    value: unknown,
    dictMap: DictValueLabelMap
): string {
    const text = String(value ?? "").trim();
    if (!text) {
        return "";
    }

    if (field.formType !== "select" || !field.dictType) {
        return text;
    }

    const valueMap = dictMap[field.dictType];
    if (!valueMap) {
        return text;
    }

    if (text.includes(",")) {
        return text
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => valueMap[item] ?? item)
            .join(", ");
    }

    return valueMap[text] ?? text;
}

function buildPageInfo(options: {
    pageResult: MesPageResponse;
    page: number;
    limit: number;
}): DynamicPageInfo {
    const page = toPositiveNumber(options.pageResult.page, options.page);
    const limit = toPositiveNumber(options.pageResult.limit, options.limit);
    const total = toNonNegativeNumber(options.pageResult.count, 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;

    return {
        page,
        limit,
        total,
        totalPages,
        hasPrevPage,
        prevPage: hasPrevPage ? page - 1 : null,
        hasNextPage,
        nextPage: hasNextPage ? page + 1 : null,
    };
}

function toPositiveNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
        return fallback;
    }
    return numberValue;
}

function toNonNegativeNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
        return fallback;
    }
    return numberValue;
}

/**
 * 字段元数据服务
 *
 * 调用 MES /form/initFieldData API 获取 Form + FieldEntity 配置，
 * 缓存字段元数据（表格列定义、搜索字段、表单配置）。
 * MES 前端页面在渲染前执行相同流程，确保 MCP 工具输出与页面一致。
 */


import type { MesClient } from "./mesClient.js";
import { cacheService } from "./cacheService.js";
import { logger } from "../utils/logger.js";

/** 缓存 TTL：30 分钟（字段配置不常变动） */
const FIELD_META_TTL_MS = 30 * 60 * 1000;

/** 单个字段元数据 */
export interface FieldMeta {
    /** 英文字段名（数据库列名，驼峰格式） */
    field: string;
    /** 中文标题（列头） */
    title: string;
    /** 是否在表格中显示 "1"=显示 */
    isTable: string;
    /** 是否作为搜索条件 "1"=可搜索 */
    isSearch: string;
    /** 搜索条件类型: =, like, in, >, <, >=, <=, between */
    searchCondition: string;
    /** 列宽（像素） */
    width: number;
    /** 是否可排序 */
    isSort: string;
    /** 是否显示合计行 */
    isTotal: string;
    /** 表单控件类型: input, select, date, datetime 等 */
    formType: string;
    /** 字段类型: varchar, int, decimal, date, datetime */
    fieldType: string;
    /** 字典类型编码（用于 select 字段的值转换） */
    dictType: string;
    /** 排序序号 */
    sort: number;
    /** 固定列: left, right */
    fixed: string;
}

/** 表单元数据 */
export interface FormMeta {
    className: string;
    formName: string;
    tableName: string;
    /** 默认每页条数 */
    pageLimit: number;
    /** 可选每页条数 */
    pageLimits: string;
    /** 默认排序字段 */
    sortField: string;
    /** 默认排序方向 */
    sortMode: string;
    /** 是否显示合计行 */
    isTotal: string;
}

/** 完整的元数据缓存结构 */
export interface CachedFieldMeta {
    /** 所有字段 */
    allFields: FieldMeta[];
    /** 表格显示字段（isTable == "1"），按 sort 排序 */
    tableFields: FieldMeta[];
    /** 搜索字段（isSearch == "1"） */
    searchFields: FieldMeta[];
    /** 表单元数据 */
    form: FormMeta;
    /** 缓存时间 */
    cachedAt: number;
}

/**
 * 字段元数据服务
 */
export class FieldMetaService {
    private client: MesClient;

    constructor(client: MesClient) {
        this.client = client;
    }

    /**
     * 获取指定 className 的字段元数据
     * 优先从缓存读取，缓存不存在时调用 MES API
     */
    async getFieldMeta(className: string): Promise<CachedFieldMeta> {
        const cacheKey = `fieldMeta:${className}`;

        // 尝试缓存
        const cached = cacheService.get<CachedFieldMeta>(cacheKey);
        if (cached) {
            logger.debug(`FieldMeta cache hit: ${className} (${cached.allFields.length} fields)`);
            return cached;
        }

        // 缓存未命中，调用 MES API
        logger.info(`Fetching field metadata for ${className}...`);
        const meta = await this.fetchFieldMeta(className);

        // 写入缓存
        cacheService.set(cacheKey, meta, FIELD_META_TTL_MS);
        logger.info(
            `FieldMeta cached: ${className} — ` +
            `${meta.tableFields.length} table fields, ${meta.searchFields.length} search fields`
        );

        return meta;
    }

    /**
     * 调用 MES /form/initFieldData API 获取字段元数据
     */
    private async fetchFieldMeta(className: string): Promise<CachedFieldMeta> {
        const response = await this.client.initFieldData<RawFormData>({ className });

        if (!response || response.code !== 0) {
            throw new Error(
                `Failed to fetch field metadata for ${className}: ${response?.msg || "Unknown error"}`
            );
        }

        const formData = response.data;
        if (!formData || !formData.childList) {
            throw new Error(`Empty field metadata response for ${className}`);
        }

        // 解析所有字段
        const allFields: FieldMeta[] = (formData.childList || []).map(
            (raw: RawFieldData) => ({
                field: raw.field || "",
                title: raw.title || raw.field || "",
                isTable: raw.isTable || "0",
                isSearch: raw.isSearch || "0",
                searchCondition: raw.searchCondition || "=",
                width: parseInt(raw.width ?? "0", 10) || 150,
                isSort: raw.isSort || "0",
                isTotal: raw.isTotal || "0",
                formType: raw.formType || "input",
                fieldType: raw.fieldType || "varchar",
                dictType: raw.dictType || "",
                sort: parseInt(raw.sort ?? "0", 10) || 0,
                fixed: raw.fixed || "",
            })
        );

        // 表格字段：isTable == "1"，按 sort 排序
        const tableFields = allFields
            .filter((f) => f.isTable === "1")
            .sort((a, b) => a.sort - b.sort);

        // 搜索字段：isSearch == "1"
        const searchFields = allFields.filter((f) => f.isSearch === "1");

        // 表单元数据
        const form: FormMeta = {
            className: formData.className || className,
            formName: formData.formName || className,
            tableName: formData.tableName || "",
            pageLimit: parseInt(formData.pageLimit ?? "0", 10) || 20,
            pageLimits: formData.pageLimits || "20,50,100,150,200",
            sortField: formData.sortField || "create_time",
            sortMode: formData.sortMode || "DESC",
            isTotal: formData.isTotal || "0",
        };

        return {
            allFields,
            tableFields,
            searchFields,
            form,
            cachedAt: Date.now(),
        };
    }

    /**
     * 清除指定 className 的字段元数据缓存
     */
    clearCache(className: string): void {
        cacheService.delete(`fieldMeta:${className}`);
        logger.info(`FieldMeta cache cleared: ${className}`);
    }

    /**
     * 清除所有字段元数据缓存
     */
    clearAllCache(): void {
        // 常见 className
        for (const name of ["TaskReport", "TaskReportBody", "TaskReportAuxiliaryOperator", "AbnormalReport", "InspectionCheckReport", "ProductionTaskToSchedule"]) {
            cacheService.delete(`fieldMeta:${name}`);
        }
        // 联动清除字典缓存
        this.client.dict.clearAllCache();
        logger.info("All FieldMeta and Dict cache cleared");
    }
}

/** MES API 返回的原始 Form 数据结构 */
interface RawFormData {
    id?: string;
    className?: string;
    formName?: string;
    tableName?: string;
    pageLimit?: string;
    pageLimits?: string;
    sortField?: string;
    sortMode?: string;
    isTotal?: string;
    childList?: RawFieldData[];
}

/** MES API 返回的原始 FieldEntity 数据结构 */
interface RawFieldData {
    id?: string;
    field?: string;
    title?: string;
    isTable?: string;
    isSearch?: string;
    searchCondition?: string;
    width?: string;
    isSort?: string;
    isTotal?: string;
    formType?: string;
    fieldType?: string;
    dictType?: string;
    sort?: string;
    fixed?: string;
}

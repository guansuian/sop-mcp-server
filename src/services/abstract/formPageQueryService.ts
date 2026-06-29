import { FormSchemaService, type FormSchema } from "./formSchemaService.js";
import { DynamicQueryParamBuilder } from "./DynamicQueryParamBuilder.js";
import { BatchDictService, type DictValueLabelMap } from "./BatchDictService.js";
import {
    DynamicPageAssembler,
    type DynamicColumn,
    type DynamicPageInfo,
} from "./DynamicPageAssembler.js";
import type { MesClient } from "../mesClient.js";
import type { MesPageResponse } from "../../types/api.js";

export interface FormPageQueryOptions {
    className?: string;
    schemaClassName?: string;
    queryClassName?: string;
    endpoint: string;
    page?: number;
    limit?: number;
    contain?: string;
    exclude?: string;
    filters?: Record<string, unknown>;
    fixedParams?: Record<string, unknown>;
}

export interface FormPageRecordContext {
    index: number;
    id: string;
    display: Record<string, string>;
}

/**
 * columns         表格列
 * displayRecords  给用户看的数据
 * rawRecords      后端原始数据
 * pageInfo        分页信息
 * requestParams   最终请求参数
 * dictMap         字典映射
 */

export interface FormPageQueryResult {
    schema: FormSchema;
    columns: DynamicColumn[];
    dictMap: DictValueLabelMap;
    requestParams: Record<string, unknown>;
    pageResult: MesPageResponse;
    rawRecords: Record<string, unknown>[];
    displayRecords: Record<string, string>[];
    records: FormPageRecordContext[];
    pageInfo: DynamicPageInfo;
}

/**
 * 这个是分页查询的主要接口
 * 我们只要调这个接口就可以了，集大成者
 * FormPageQueryService
 *   -> FormSchemaService 查字段配置
 *   -> BatchDictService 查数据字典
 *   -> queryPageMap 查真实数据
 *   -> DynamicPageAssembler 整合结果
 */
export class FormPageQueryService {
    constructor(private readonly client: MesClient) {}

    async query(options: FormPageQueryOptions): Promise<FormPageQueryResult> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 20;
        const schemaClassName = options.schemaClassName ?? options.className;
        const queryClassName = options.queryClassName ?? options.className;

        if (!schemaClassName || !queryClassName) {
            throw new Error("请提供 schemaClassName 和 queryClassName，或提供兼容字段 className");
        }

        const formSchemaService = new FormSchemaService(this.client);
        const schema = await formSchemaService.getSchema({
            className: schemaClassName,
            contain: options.contain,
            exclude: options.exclude,
        });

        const queryParamBuilder = new DynamicQueryParamBuilder();
        const requestParams = {
            ...queryParamBuilder.build({
            className: queryClassName,
            page,
            limit,
            filters: options.filters ?? {},
            searchFields: schema.searchFields,
            }),
            ...options.fixedParams,
        };

        const batchDictService = new BatchDictService(this.client);
        const dictMap = await batchDictService.getDictMapByFields(schema.tableFields);
        const pageResult = await this.client.queryPageMap(options.endpoint, requestParams);
        const assembler = new DynamicPageAssembler();
        const dynamicPage = assembler.assemble({
            schema,
            dictMap,
            pageResult,
            page,
            limit,
        });
        const records = dynamicPage.displayRecords.map((display, index) => ({
            index: index + 1,
            id: String(dynamicPage.rawRecords[index]?.id ?? ""),
            display,
        }));

        return {
            schema,
            columns: dynamicPage.columns,
            dictMap,
            requestParams,
            pageResult,
            rawRecords: dynamicPage.rawRecords,
            displayRecords: dynamicPage.displayRecords,
            records,
            pageInfo: dynamicPage.pageInfo,
        };
    }
}

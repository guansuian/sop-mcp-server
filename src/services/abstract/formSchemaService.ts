import type { MesClient } from "../mesClient.js";

export interface FormSchemaOptions {
    className: string;
    contain?: string;
    exclude?: string;
}


/**
 * 每一个字段
 */
export interface FormSchemaField {
    id: string;
    formId: string;
    title: string;
    field: string;
    width: number;

    isTable: boolean;
    isForm: boolean;
    isSearch: boolean;
    isSort: boolean;
    isTotal: boolean;
    isTableEdit: boolean;
    isCompany: boolean;
    isDetail: boolean;

    formType: string;
    fieldType: string;
    fieldLength: string;
    formRequire: boolean;
    isFormEdit: string;

    dictType: string;
    searchCondition: string;
    searchValue: string;
    sort: number;
    fixed: string;

    tableAlias: string;
    tableField: string;
    templet: string;
    event: string;
    exportExcel: boolean;
    importExcel: string;

    minDateType: string;
    maxDateType: string;
}

export interface FormSchema {
    id: string;
    className: string;
    formName: string;
    tableName: string;
    classPath: string;
    inherit: string;

    formType: string;
    joinSql: string;
    foreignKey: string;
    childClassName: string;

    pageLimit: number;
    pageLimits: string;
    sortField: string;
    sortMode: string;
    isTotal: boolean;
    lineNum: string;

    childList: FormSchemaField[];
    allFields: FormSchemaField[];
    tableFields: FormSchemaField[];
    searchFields: FormSchemaField[];
    dictFields: FormSchemaField[];
    formFields: FormSchemaField[];
}

interface InitFieldDataResponse {
    code?: unknown;
    msg?: unknown;
    message?: unknown;
    data?: unknown;
}

/**
 * 获取到表单结构
 * 主要调用initFieldData这个方法
 * 这个类通常是FormPageQueryService的第一步
 */

export class FormSchemaService {
    constructor(private readonly client: Pick<MesClient, "initFieldData">) {}

    async getSchema(options: FormSchemaOptions): Promise<FormSchema> {
        const response = await this.client.initFieldData({
            className: options.className,
            contain: options.contain ?? "",
            exclude: options.exclude ?? "",
        }) as InitFieldDataResponse;

        if (!response || Number(response.code) !== 0) {
            throw new Error(
                `Failed to fetch form schema for ${options.className}: ${getResponseMessage(response)}`
            );
        }

        const formData = asRecord(response.data);
        if (!formData) {
            throw new Error(`Empty form schema response for ${options.className}`);
        }

        const childList = Array.isArray(formData.childList) ? formData.childList : null;
        if (!childList) {
            throw new Error(`Form schema for ${options.className} is missing childList`);
        }

        const allFields = childList
            .map((item) => asRecord(item))
            .filter((item): item is Record<string, unknown> => item !== null)
            .map(toFormSchemaField)
            .filter((field): field is FormSchemaField => field !== null);

        const tableFields = allFields
            .filter((field) => field.isTable)
            .sort((a, b) => a.sort - b.sort);
        const formFields = allFields
            .filter((field) => field.isForm)
            .sort((a, b) => a.sort - b.sort);

        return {
            id: toStringValue(formData.id),
            className: toStringValue(formData.className, options.className),
            formName: toStringValue(formData.formName, options.className),
            tableName: toStringValue(formData.tableName),
            classPath: toStringValue(formData.classPath),
            inherit: toStringValue(formData.inherit),
            formType: toStringValue(formData.formType),
            joinSql: toStringValue(formData.joinSql),
            foreignKey: toStringValue(formData.foreignKey),
            childClassName: toStringValue(formData.childClassName),
            pageLimit: toNumber(formData.pageLimit, 20),
            pageLimits: toStringValue(formData.pageLimits),
            sortField: toStringValue(formData.sortField),
            sortMode: toStringValue(formData.sortMode),
            isTotal: toBoolean(formData.isTotal),
            lineNum: toStringValue(formData.lineNum),
            childList: allFields,
            allFields,
            tableFields,
            searchFields: allFields.filter((field) => field.isSearch),
            dictFields: allFields.filter(
                (field) => field.formType === "select" && field.dictType.length > 0
            ),
            formFields,
        };
    }
}

function toFormSchemaField(item: Record<string, unknown>): FormSchemaField | null {
    const field = toStringValue(item.field).trim();
    if (!field) {
        return null;
    }

    return {
        id: toStringValue(item.id),
        formId: toStringValue(item.formId),
        title: toStringValue(item.title, field),
        field,
        width: toNumber(item.width, 150),
        isTable: toBoolean(item.isTable),
        isForm: toBoolean(item.isForm),
        isSearch: toBoolean(item.isSearch),
        isSort: toBoolean(item.isSort),
        isTotal: toBoolean(item.isTotal),
        isTableEdit: toBoolean(item.isTableEdit),
        isCompany: toBoolean(item.isCompany),
        isDetail: toBoolean(item.isDetail),
        formType: toStringValue(item.formType, "input").toLowerCase(),
        fieldType: toStringValue(item.fieldType, "varchar").toLowerCase(),
        fieldLength: toStringValue(item.fieldLength),
        formRequire: toBoolean(item.formRequire),
        isFormEdit: toStringValue(item.isFormEdit),
        dictType: toStringValue(item.dictType),
        searchCondition: toStringValue(item.searchCondition),
        searchValue: toStringValue(item.searchValue),
        sort: toNumber(item.sort, Number.MAX_SAFE_INTEGER),
        fixed: toStringValue(item.fixed),
        tableAlias: toStringValue(item.tableAlias),
        tableField: toStringValue(item.tableField),
        templet: toStringValue(item.templet),
        event: toStringValue(item.event),
        exportExcel: toBoolean(item.exportExcel),
        importExcel: toStringValue(item.importExcel),
        minDateType: toStringValue(item.minDateType),
        maxDateType: toStringValue(item.maxDateType),
    };
}

function getResponseMessage(response: InitFieldDataResponse | null | undefined): string {
    const message = response?.msg ?? response?.message;
    const text = toStringValue(message);
    return text || "Unknown error";
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function toStringValue(value: unknown, fallback = ""): string {
    if (value === undefined || value === null) {
        return fallback;
    }
    return String(value).trim() || fallback;
}

function toNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value === 1;
    }
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
}

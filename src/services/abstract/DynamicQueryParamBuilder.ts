import type { FormSchemaField } from "./formSchemaService.js";

export interface DynamicQueryParamBuilderOptions {
    className: string;
    page: number;
    limit: number;
    filters: Record<string, unknown>;
    searchFields: FormSchemaField[];
}

/**
 * 动态构建查询参数
 * 假设用户想查：
 * {
 *   className: "AndonAbnormalReport",
 *   page: 1,
 *   limit: 10,
 *   filters: {
 *     billUserName: "张三",
 *     createTime: {
 *       start: "2026-06-01 00:00:00",
 *       end: "2026-06-30 23:59:59"
 *     },
 *     abnormalType: ["1", "2"]
 *   },
 *   searchFields: [...]
 * }
 *
 * 输出大概是
 *
 * {
 *   className: "AndonAbnormalReport",
 *   page: 1,
 *   limit: 10,
 *   extraDefinition_like_billUserName: "张三",
 *   createTime: "2026-06-01 00:00:00 ~ 2026-06-30 23:59:59",
 *   extraDefinition_in_abnormalType: "1,2"
 * }
 *
 *
 */
export class DynamicQueryParamBuilder {

    build(options: DynamicQueryParamBuilderOptions): Record<string, unknown> {
        const params: Record<string, unknown> = {
            className: options.className,
            page: options.page,
            limit: options.limit,
        };
        const searchableFields = new Map(
            options.searchFields.map((field) => [field.field, field])
        );

        for (const [fieldName, rawValue] of Object.entries(options.filters)) {
            const field = searchableFields.get(fieldName);
            if (!field || isEmptyValue(rawValue)) {
                continue;
            }

            const queryParam = this.buildFieldParam(field, rawValue);
            if (!queryParam) {
                continue;
            }
            params[queryParam.key] = queryParam.value;
        }

        return params;
    }

    private buildFieldParam(
        field: FormSchemaField,
        rawValue: unknown
    ): { key: string; value: unknown } | null {
        if (Array.isArray(rawValue)) {
            const values = rawValue
                .map((value) => String(value ?? "").trim())
                .filter(Boolean);
            if (values.length === 0) {
                return null;
            }
            if (values.length === 1) {
                return { key: field.field, value: values[0] };
            }
            return { key: `extraDefinition_in_${field.field}`, value: values.join(",") };
        }

        if (isDateType(field)) {
            const range = toRangeValue(rawValue);
            return range ? { key: field.field, value: range } : null;
        }

        const condition = normalizeSearchCondition(field.searchCondition);
        if (condition) {
            return this.buildBySearchCondition(field, rawValue, condition);
        }

        if (isTextType(field)) {
            return {
                key: `extraDefinition_like_${field.field}`,
                value: String(rawValue).trim(),
            };
        }

        return { key: field.field, value: rawValue };
    }

    private buildBySearchCondition(
        field: FormSchemaField,
        rawValue: unknown,
        condition: string
    ): { key: string; value: unknown } | null {
        const value = String(rawValue).trim();
        if (!value) {
            return null;
        }

        switch (condition) {
            case "eq":
            case "=":
                return { key: field.field, value };
            case "like":
                return { key: `extraDefinition_like_${field.field}`, value };
            case "in":
                return { key: `extraDefinition_in_${field.field}`, value };
            case "notin":
            case "not_in":
            case "not-in":
                return { key: `extraDefinition_notIn_${field.field}`, value };
            case "ne":
            case "!=":
            case "<>":
                return { key: `extraDefinition_ne_${field.field}`, value };
            case "likeleft":
            case "like_left":
            case "like-left":
            case "likeright":
            case "like_right":
            case "like-right":
                return { key: field.field, value };
            default:
                return { key: field.field, value };
        }
    }
}

function isTextType(field: FormSchemaField): boolean {
    return field.fieldType === "varchar" ||
        field.fieldType === "char" ||
        field.fieldType === "text";
}

function isDateType(field: FormSchemaField): boolean {
    return field.fieldType.includes("date") ||
        field.fieldType.includes("time") ||
        field.formType === "date" ||
        field.formType === "datetime";
}

function toRangeValue(value: unknown): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }

    if (Array.isArray(value)) {
        const [startValue, endValue] = value;
        const start = String(startValue ?? "").trim();
        const end = String(endValue ?? "").trim();
        return start && end ? `${start} ~ ${end}` : null;
    }

    const record = asRecord(value);
    if (!record) {
        return null;
    }

    const start = String(record.start ?? record.begin ?? record.from ?? "").trim();
    const end = String(record.end ?? record.finish ?? record.to ?? "").trim();
    if (!start || !end) {
        return null;
    }
    return `${start} ~ ${end}`;
}

function normalizeSearchCondition(condition: string): string {
    return condition.trim().toLowerCase();
}

function isEmptyValue(value: unknown): boolean {
    if (value === undefined || value === null) {
        return true;
    }
    if (typeof value === "string") {
        return value.trim() === "";
    }
    if (Array.isArray(value)) {
        return value.length === 0 || value.every(isEmptyValue);
    }
    return false;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

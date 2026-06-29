import type { DictValueLabelMap } from "./BatchDictService.js";
import type { FormSchemaField } from "./formSchemaService.js";

export interface DynamicSaveParamBuilderOptions {
    fields: FormSchemaField[];
    entity: Record<string, unknown>;
    dictMap?: DictValueLabelMap;
    fixedParams?: Record<string, unknown>;
}

export interface DynamicSaveBuildResult {
    payload: Record<string, unknown>;
    ignoredFields: string[];
}

export class DynamicSaveParamBuilder {
    build(options: DynamicSaveParamBuilderOptions): DynamicSaveBuildResult {
        const payload: Record<string, unknown> = {};
        const formFieldMap = new Map(options.fields.map((field) => [field.field, field]));
        const ignoredFields = Object.keys(options.entity).filter((field) => !formFieldMap.has(field) && field !== "id");
        const missingFields: FormSchemaField[] = [];

        for (const field of options.fields) {
            const value = options.entity[field.field];

            if (isEmptyValue(value)) {
                if (field.formRequire) {
                    missingFields.push(field);
                }
                continue;
            }

            payload[field.field] = this.normalizeFieldValue(field, value, options.dictMap ?? {});
        }

        if (!isEmptyValue(options.entity.id)) {
            payload.id = options.entity.id;
        }

        if (missingFields.length > 0) {
            throw new Error(
                `缺少必填字段：${missingFields.map((field) => `${field.title}(${field.field})`).join("、")}`
            );
        }

        return {
            payload: {
                ...payload,
                ...options.fixedParams,
            },
            ignoredFields,
        };
    }

    private normalizeFieldValue(
        field: FormSchemaField,
        value: unknown,
        dictMap: DictValueLabelMap
    ): unknown {
        if (field.formType !== "select" || !field.dictType) {
            return Array.isArray(value) ? value.join(",") : value;
        }

        const valueMap = dictMap[field.dictType];
        if (!valueMap) {
            return Array.isArray(value) ? value.join(",") : value;
        }

        if (Array.isArray(value)) {
            return value
                .map((item) => normalizeDictValue(item, valueMap))
                .filter(Boolean)
                .join(",");
        }

        const text = String(value ?? "").trim();
        if (text.includes(",")) {
            return text
                .split(",")
                .map((item) => normalizeDictValue(item, valueMap))
                .filter(Boolean)
                .join(",");
        }

        return normalizeDictValue(text, valueMap);
    }
}

function normalizeDictValue(value: unknown, valueMap: Record<string, string>): string {
    const text = String(value ?? "").trim();
    if (!text) {
        return "";
    }

    if (valueMap[text] !== undefined) {
        return text;
    }

    const matched = Object.entries(valueMap).find(([, label]) => label === text);
    return matched?.[0] ?? text;
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

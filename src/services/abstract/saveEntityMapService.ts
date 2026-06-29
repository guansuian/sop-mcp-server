import type { MesClient } from "../mesClient.js";
import type { MesApiResponse } from "../../types/api.js";
import { BatchDictService, type DictValueLabelMap } from "./BatchDictService.js";
import {
    DynamicSaveParamBuilder,
    type DynamicSaveBuildResult,
} from "./DynamicSaveParamBuilder.js";
import {
    FormSchemaService,
    type FormSchema,
    type FormSchemaField,
} from "./formSchemaService.js";

export interface FormEntitySaveContextOptions {
    schemaClassName: string;
    contain?: string;
    exclude?: string;
}

export interface FormEntitySaveOptions extends FormEntitySaveContextOptions {
    endpoint: string;
    entity: Record<string, unknown>;
    fixedParams?: Record<string, unknown>;
}

export interface FormEntitySaveFieldContext {
    title: string;
    field: string;
    formType: string;
    fieldType: string;
    formRequire: boolean;
    dictType: string;
    dictOptions: Record<string, string>;
}

export interface FormEntitySaveContext {
    schema: FormSchema;
    formFields: FormSchemaField[];
    requiredFields: FormSchemaField[];
    dictMap: DictValueLabelMap;
    fields: FormEntitySaveFieldContext[];
}

export interface FormEntitySaveResult {
    context: FormEntitySaveContext;
    buildResult: DynamicSaveBuildResult;
    response: MesApiResponse;
}

export class FormEntitySaveService {
    constructor(private readonly client: MesClient) {}

    async getSaveContext(options: FormEntitySaveContextOptions): Promise<FormEntitySaveContext> {
        const formSchemaService = new FormSchemaService(this.client);
        const schema = await formSchemaService.getSchema({
            className: options.schemaClassName,
            contain: options.contain,
            exclude: options.exclude,
        });

        const formFields = schema.formFields;
        const batchDictService = new BatchDictService(this.client);
        const dictMap = await batchDictService.getDictMapByFields(formFields);

        return {
            schema,
            formFields,
            requiredFields: formFields.filter((field) => field.formRequire),
            dictMap,
            fields: formFields.map((field) => toSaveFieldContext(field, dictMap)),
        };
    }

    async saveEntity(options: FormEntitySaveOptions): Promise<FormEntitySaveResult> {
        const context = await this.getSaveContext({
            schemaClassName: options.schemaClassName,
            contain: options.contain,
            exclude: options.exclude,
        });

        const builder = new DynamicSaveParamBuilder();
        const buildResult = builder.build({
            fields: context.formFields,
            entity: options.entity,
            dictMap: context.dictMap,
            fixedParams: options.fixedParams,
        });

        const response = await this.client.saveEntityMap(
            normalizeEndpoint(options.endpoint),
            buildResult.payload
        );

        return {
            context,
            buildResult,
            response,
        };
    }
}

function toSaveFieldContext(
    field: FormSchemaField,
    dictMap: DictValueLabelMap
): FormEntitySaveFieldContext {
    return {
        title: field.title,
        field: field.field,
        formType: field.formType,
        fieldType: field.fieldType,
        formRequire: field.formRequire,
        dictType: field.dictType,
        dictOptions: field.dictType ? dictMap[field.dictType] ?? {} : {},
    };
}

function normalizeEndpoint(endpoint: string): string {
    const value = endpoint.trim();
    return value.startsWith("/") ? value : `/${value}`;
}

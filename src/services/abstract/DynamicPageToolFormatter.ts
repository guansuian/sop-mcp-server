import type { FormPageQueryResult } from "./formPageQueryService.js";
import type { DynamicColumn, DynamicPageInfo } from "./DynamicPageAssembler.js";

export interface DynamicPageToolFormatterOptions {
    title: string;
    result: FormPageQueryResult;
}

export class DynamicPageToolFormatter {
    format(options: DynamicPageToolFormatterOptions): string {
        const { title, result } = options;

        return [
            title,
            this.formatPageSummary(result.pageInfo),
            "",
            this.formatMarkdownTable(result.columns, result.displayRecords),
            "",
            this.formatPageNavigation(result.pageInfo),
            "",
            this.formatWorkBuddyQueryContext(result),
        ].join("\n");
    }

    private formatPageSummary(pageInfo: DynamicPageInfo): string {
        return `当前第 ${pageInfo.page} 页 / 共 ${pageInfo.totalPages} 页，共 ${pageInfo.total} 条`;
    }

    private formatMarkdownTable(
        columns: DynamicColumn[],
        records: Record<string, string>[]
    ): string {
        return [
            this.toMarkdownHeader(columns),
            this.toMarkdownSeparator(columns),
            ...records.map((record) => this.toTableRow(record, columns)),
        ].join("\n");
    }

    private toMarkdownHeader(columns: DynamicColumn[]): string {
        return `| ${columns.map((column) => this.formatCell(column.title)).join(" | ")} |`;
    }

    private toMarkdownSeparator(columns: DynamicColumn[]): string {
        return `|${columns.map(() => "---").join("|")}|`;
    }

    private toTableRow(record: Record<string, string>, columns: DynamicColumn[]): string {
        const values = columns.map((column) => this.formatCell(record[column.field]));
        return `| ${values.join(" | ")} |`;
    }

    private formatPageNavigation(pageInfo: DynamicPageInfo): string {
        return [
            `hasPrevPage: ${pageInfo.hasPrevPage}`,
            `prevPage: ${pageInfo.prevPage ?? ""}`,
            `hasNextPage: ${pageInfo.hasNextPage}`,
            `nextPage: ${pageInfo.nextPage ?? ""}`,
        ].join("\n");
    }

    private formatWorkBuddyQueryContext(result: FormPageQueryResult): string {
        return [
            "Work Buddy 查询上下文（用于后续构建 filters，以及根据用户选择的记录获取 id）：",
            "```json",
            JSON.stringify({
                records: result.records,
                searchableFields: result.schema.searchFields.map((field) => ({
                    title: field.title,
                    field: field.field,
                    formType: field.formType,
                    fieldType: field.fieldType,
                    dictType: field.dictType,
                    searchCondition: field.searchCondition,
                })),
                dictMap: result.dictMap,
            }, null, 2),
            "```",
        ].join("\n");
    }

    private formatCell(value: unknown): string {
        return String(value ?? "").replace(/\r?\n/g, " ").trim();
    }
}

/**
 * 业务标识符解析：UUID 直接使用，否则按编码/名称/单号查询并转换为 id
 */

import type { MesClient } from "./mesClient.js";
import { logger } from "../utils/logger.js";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResolvedEntity {
    id: string;
    /** 便于日志/返回展示 */
    display: string;
    /** 业务编码（物料 code / 工序 code 等），便于后续 save 传参 */
    code?: string;
}

export class EntityResolverService {
    constructor(private client: MesClient) {}

    isUuid(value: string): boolean {
        return UUID_REGEX.test(value.trim());
    }

    /** MES 常见主键：标准 UUID 或 32 位 hex（无连字符） */
    isPrimaryKey(value: string): boolean {
        const v = value.trim();
        return this.isUuid(v) || /^[0-9a-f]{32}$/i.test(v);
    }

    /** 解析生产计划单：UUID 或计划单号 billNo */
    async resolveProductionPlanId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("计划单标识不能为空");
        }
        if (this.isUuid(value)) {
            return { id: value, display: value };
        }

        const response = await this.client.queryPageMap("/productionPlan", {
            className: "ProductionPlan",
            page: 1,
            limit: 20,
            billNo: value,
        });

        if (!response || response.code !== 0) {
            throw new Error(`查询计划单失败：${response?.msg || "未知错误"}`);
        }

        return this.pickUnique(
            (response.data || []) as Record<string, unknown>[],
            value,
            "billNo",
            "计划单号",
            (r) => String(r.billNo ?? r.id ?? "")
        );
    }

    /** 解析客户：UUID、客户编码 code 或客户名称 name */
    async resolveCustomerId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("客户标识不能为空");
        }
        if (this.isUuid(value)) {
            return { id: value, display: value };
        }

        for (const field of ["code", "name"] as const) {
            const response = await this.client.queryPageMap("/customer", {
                className: "Customer",
                page: 1,
                limit: 20,
                [field]: value,
            });

            if (!response || response.code !== 0) {
                continue;
            }

            const records = (response.data || []) as Record<string, unknown>[];
            if (records.length === 0) {
                continue;
            }

            try {
                return this.pickUnique(
                    records,
                    value,
                    field,
                    field === "code" ? "客户编码" : "客户名称",
                    (r) => {
                        const code = r.code ? String(r.code) : "";
                        const name = r.name ? String(r.name) : "";
                        return [code, name].filter(Boolean).join(" / ") || String(r.id ?? "");
                    }
                );
            } catch (e) {
                if (field === "name") throw e;
            }
        }

        throw new Error(`未找到客户：${value}（可传 UUID、客户编码或客户名称）`);
    }

    /** 解析物料：主键、物料编码 code 或物料名称 name */
    async resolveMaterielId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("物料标识不能为空");
        }
        if (this.isPrimaryKey(value)) {
            const byId = await this.loadMaterielByPrimaryKey(value);
            if (byId) return byId;
            return { id: value, display: value };
        }

        for (const field of ["code", "name"] as const) {
            const response = await this.client.queryPageMap("/materiel", {
                className: "Materiel",
                page: 1,
                limit: 20,
                [field]: value,
            });

            if (!response || response.code !== 0) {
                continue;
            }

            const records = (response.data || []) as Record<string, unknown>[];
            if (records.length === 0) {
                continue;
            }

            try {
                return this.pickUnique(
                    records,
                    value,
                    field,
                    field === "code" ? "物料编码" : "物料名称",
                    (r) => {
                        const code = r.code ? String(r.code) : "";
                        const name = r.name ? String(r.name) : "";
                        const spec = r.spec ? String(r.spec) : "";
                        return [code, name, spec].filter(Boolean).join(" / ") || String(r.id ?? "");
                    }
                );
            } catch (e) {
                if (field === "name") throw e;
            }
        }

        throw new Error(`未找到物料：${value}（可传 UUID、物料编码或物料名称）`);
    }

    /**
     * 工程图导入：仅查找物料（不创建）
     * 优先：显式 materiel → 零件名称 → 型号规格 → 图号（图号≠物料编码，仅作 spec 模糊查）
     */
    async lookupMaterielForDrawing(options: {
        materiel?: string;
        partName?: string;
        modelSpec?: string;
        drawingNumber?: string;
    }): Promise<ResolvedEntity | null> {
        if (options.materiel?.trim()) {
            try {
                return await this.resolveMaterielId(options.materiel.trim());
            } catch {
                return null;
            }
        }

        if (options.partName?.trim()) {
            try {
                return await this.resolveMaterielId(options.partName.trim());
            } catch {
                // continue
            }
        }

        for (const field of ["spec", "name"] as const) {
            const value =
                field === "spec"
                    ? options.modelSpec?.trim()
                    : undefined;
            if (!value) continue;

            const response = await this.client.queryPageMap("/materiel", {
                className: "Materiel",
                page: 1,
                limit: 20,
                [field]: value,
            });

            if (!response || response.code !== 0 || !response.data?.length) {
                continue;
            }

            try {
                return this.pickUnique(
                    response.data as Record<string, unknown>[],
                    value,
                    field,
                    field === "spec" ? "规格型号" : "物料名称",
                    (r) => {
                        const code = r.code ? String(r.code) : "";
                        const name = r.name ? String(r.name) : "";
                        const spec = r.spec ? String(r.spec) : "";
                        return [code, name, spec].filter(Boolean).join(" / ");
                    }
                );
            } catch {
                // continue
            }
        }

        if (options.drawingNumber?.trim()) {
            const response = await this.client.queryPageMap("/materiel", {
                className: "Materiel",
                page: 1,
                limit: 20,
                spec: options.drawingNumber.trim(),
            });

            if (response?.code === 0 && response.data?.length) {
                try {
                    return this.pickUnique(
                        response.data as Record<string, unknown>[],
                        options.drawingNumber.trim(),
                        "spec",
                        "图号(规格)",
                        (r) => {
                            const code = r.code ? String(r.code) : "";
                            const name = r.name ? String(r.name) : "";
                            const spec = r.spec ? String(r.spec) : "";
                            return [code, name, spec].filter(Boolean).join(" / ");
                        }
                    );
                } catch {
                    // not found
                }
            }
        }

        return null;
    }

    /**
     * 工程图导入：查找物料，必要时自动创建（图号不得作为物料编码）
     */
    async resolveMaterielForDrawing(options: {
        materiel?: string;
        partName?: string;
        modelSpec?: string;
        drawingNumber?: string;
        material?: string;
        autoCreate?: boolean;
    }): Promise<ResolvedEntity & { created?: boolean }> {
        const existing = await this.lookupMaterielForDrawing(options);
        if (existing) {
            return { ...existing, created: false };
        }

        const autoCreate = options.autoCreate !== false;
        const name = options.partName?.trim() || options.drawingNumber?.trim();

        if (!autoCreate || !name) {
            throw new Error(
                "未找到对应物料。优先按「零件名称+型号规格」匹配；也可传 materiel，或设 autoCreateMateriel=true 自动新建。"
            );
        }

        const materielCode = `DRW-${Date.now().toString(36).slice(-8).toUpperCase()}`;
        const spec = [
            options.drawingNumber ? `图号:${options.drawingNumber}` : "",
            options.modelSpec ?? "",
            options.material ?? "",
        ]
            .filter(Boolean)
            .join(" / ");

        const response = await this.client.saveEntityMap("/materiel", {
            className: "Materiel",
            code: materielCode,
            name,
            spec,
            property: "2",
        });

        if (Number(response?.code) !== 0) {
            try {
                const verified = await this.resolveMaterielId(materielCode);
                return { ...verified, created: true };
            } catch {
                throw new Error(
                    `自动创建物料失败：${response?.msg || "未知错误"}`
                );
            }
        }

        const verified = await this.resolveMaterielId(materielCode);
        logger.info(`Auto-created materiel: ${materielCode} / ${name}`);
        return { ...verified, created: true };
    }

    /** 解析工序：主键、工序编号 code 或工序名称 name */
    async resolveProcedureId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("工序标识不能为空");
        }
        if (this.isPrimaryKey(value)) {
            const byId = await this.loadProcedureByPrimaryKey(value);
            if (byId) return byId;
            return { id: value, display: value };
        }

        for (const field of ["code", "name"] as const) {
            const response = await this.client.queryPageMap("/procedure", {
                className: "Procedure",
                page: 1,
                limit: 20,
                [field]: value,
            });

            if (!response || response.code !== 0) {
                continue;
            }

            const records = (response.data || []) as Record<string, unknown>[];
            if (records.length === 0) {
                continue;
            }

            try {
                return this.pickUnique(
                    records,
                    value,
                    field,
                    field === "code" ? "工序编号" : "工序名称",
                    (r) => {
                        const code = r.code ? String(r.code) : "";
                        const name = r.name ? String(r.name) : "";
                        return [code, name].filter(Boolean).join(" / ") || String(r.id ?? "");
                    }
                );
            } catch (e) {
                if (field === "name") throw e;
            }
        }

        throw new Error(`未找到工序：${value}（可传 UUID、工序编号或工序名称）`);
    }

    /** 解析工艺路线：UUID、工艺编号 code，或物料编码/名称（取最新版本） */
    async resolveProcessRouteId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("工艺路线标识不能为空");
        }
        if (this.isUuid(value)) {
            return { id: value, display: value };
        }

        for (const field of ["code"] as const) {
            const response = await this.client.queryPageMap("/processRoute", {
                className: "ProcessRoute",
                page: 1,
                limit: 20,
                [field]: value,
            });

            if (!response || response.code !== 0) {
                continue;
            }

            const records = (response.data || []) as Record<string, unknown>[];
            if (records.length === 0) {
                continue;
            }

            try {
                return this.pickUnique(
                    records,
                    value,
                    field,
                    "工艺编号",
                    (r) => {
                        const code = r.code ? String(r.code) : "";
                        const name = r.name ? String(r.name) : "";
                        const materielCode = r.materielCode ? String(r.materielCode) : "";
                        return [code, name, materielCode].filter(Boolean).join(" / ") || String(r.id ?? "");
                    }
                );
            } catch (e) {
                if (field === "code") throw e;
            }
        }

        try {
            const materiel = await this.resolveMaterielId(value);
            const routeRes = await this.client.queryPageMap("/processRoute", {
                className: "ProcessRoute",
                page: 1,
                limit: 1,
                materielId: materiel.id,
            });

            if (routeRes?.code === 0 && routeRes.data?.length) {
                const route = routeRes.data[0] as Record<string, unknown>;
                const id = String(route.id ?? "");
                if (!id) {
                    throw new Error(`物料「${value}」的工艺路线缺少 id`);
                }
                const display = [
                    route.code ? String(route.code) : "",
                    route.name ? String(route.name) : "",
                    materiel.display,
                ]
                    .filter(Boolean)
                    .join(" / ");
                logger.info(`Resolved 工艺路线(按物料): ${value} → ${id} (${display})`);
                return { id, display };
            }
        } catch (e) {
            if (e instanceof Error && e.message.includes("未找到物料")) {
                throw e;
            }
        }

        /* 旧实现：无路线时服务端抛「请先维护选择的物料的工艺路线!」
        const routeResp = await this.client.customPost(
          "/processRoute/getProcessRouteToMaterielAndNewVersion",
          { materielId: materiel.id }
        );
        */

        throw new Error(
            `未找到工艺路线：${value}（可传 UUID、工艺编号 code，或物料编码/名称）`
        );
    }

    /** 解析控制计划：UUID 或单据编号 code */
    async resolveQualityControlId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("控制计划标识不能为空");
        }
        if (this.isUuid(value)) {
            return { id: value, display: value };
        }

        const response = await this.client.queryPageMap("/qualityControl", {
            className: "QualityControl",
            page: 1,
            limit: 20,
            code: value,
        });

        if (!response || response.code !== 0) {
            throw new Error(`查询控制计划失败：${response?.msg || "未知错误"}`);
        }

        return this.pickUnique(
            (response.data || []) as Record<string, unknown>[],
            value,
            "code",
            "控制计划单据编号",
            (r) => {
                const code = r.code ? String(r.code) : "";
                const materielCode = r.materielCode ? String(r.materielCode) : "";
                const procedureName = r.procedureName ? String(r.procedureName) : "";
                return [code, materielCode, procedureName].filter(Boolean).join(" / ") || String(r.id ?? "");
            }
        );
    }

    /** 按物料 + 工序解析控制计划（取第一条匹配） */
    async resolveQualityControlByMaterielAndProcedure(
        materielInput: string,
        procedureInput: string
    ): Promise<ResolvedEntity> {
        const materiel = await this.resolveMaterielId(materielInput);
        const procedure = await this.resolveProcedureId(procedureInput);

        const response = await this.client.queryPageMap("/qualityControl", {
            className: "QualityControl",
            page: 1,
            limit: 20,
            materielId: materiel.id,
            procedureId: procedure.id,
        });

        if (!response || response.code !== 0) {
            throw new Error(`查询控制计划失败：${response?.msg || "未知错误"}`);
        }

        const records = (response.data || []) as Record<string, unknown>[];
        if (records.length === 0) {
            throw new Error(
                `未找到控制计划：物料「${materielInput}」+ 工序「${procedureInput}」`
            );
        }

        const record = records[0];
        const id = String(record.id ?? "");
        if (!id) {
            throw new Error("控制计划记录缺少 id 字段");
        }

        const display = [
            record.code ? String(record.code) : "",
            materiel.display,
            procedure.display,
        ]
            .filter(Boolean)
            .join(" / ");

        logger.info(
            `Resolved 控制计划(物料+工序): ${materielInput} + ${procedureInput} → ${id}`
        );
        return { id, display };
    }

    /** 解析工艺文件类别：UUID 或类别名称 title */
    async resolveEsopCategoryId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("工艺文件类别标识不能为空");
        }
        if (this.isUuid(value)) {
            return { id: value, display: value };
        }

        const response = (await this.client.customPost("/esopCategory/queryTreeList", {})) as {
            code: number;
            msg?: string;
            data?: Record<string, unknown>[];
        };

        if (!response || response.code !== 0) {
            throw new Error(`查询工艺文件类别失败：${response?.msg || "未知错误"}`);
        }

        const nodes = response.data || [];
        const exact = nodes.filter(
            (n) => String(n.title ?? "").trim() === value
        );
        const partial = nodes.filter((n) =>
            String(n.title ?? "").includes(value)
        );
        const candidates = exact.length > 0 ? exact : partial;

        if (candidates.length === 0) {
            throw new Error(`未找到工艺文件类别：${value}`);
        }
        if (candidates.length > 1) {
            const names = candidates
                .slice(0, 5)
                .map((n) => String(n.title ?? n.id))
                .join("、");
            throw new Error(
                `工艺文件类别「${value}」匹配到 ${candidates.length} 条，请指定更精确的名称。例如：${names}`
            );
        }

        const record = candidates[0];
        const id = String(record.id ?? "");
        if (!id) {
            throw new Error("工艺文件类别记录缺少 id 字段");
        }

        const display = String(record.title ?? id);
        logger.info(`Resolved 工艺文件类别: ${value} → ${id} (${display})`);
        return { id, display };
    }

    /** 解析工艺文件附件：UUID 或文档名称 originalFilename（模糊） */
    async resolveEsopAttachmentId(input: string): Promise<ResolvedEntity> {
        const value = input.trim();
        if (!value) {
            throw new Error("工艺文件标识不能为空");
        }
        if (this.isPrimaryKey(value)) {
            return { id: value, display: value };
        }

        const response = await this.client.queryPageMap("/esopAttachment", {
            className: "ESOPAttachment",
            page: 1,
            limit: 20,
            originalFilename: value,
        });

        if (!response || response.code !== 0) {
            throw new Error(`查询工艺文件失败：${response?.msg || "未知错误"}`);
        }

        return this.pickUnique(
            (response.data || []) as Record<string, unknown>[],
            value,
            "originalFilename",
            "工艺文件",
            (r) =>
                [
                    String(r.originalFilename ?? ""),
                    String(r.materielCode ?? ""),
                    String(r.procedureName ?? ""),
                ]
                    .filter(Boolean)
                    .join(" / ")
        );
    }

    /** 批量解析计划单 ID（下达用） */
    async resolveProductionPlanIds(
        inputs: string | string[]
    ): Promise<{ ids: string; resolved: ResolvedEntity[] }> {
        const rawList = (Array.isArray(inputs) ? inputs : inputs.split(","))
            .map((s) => s.trim())
            .filter(Boolean);

        if (rawList.length === 0) {
            throw new Error("请提供至少一个计划单标识");
        }

        const resolved: ResolvedEntity[] = [];
        for (const item of rawList) {
            resolved.push(await this.resolveProductionPlanId(item));
        }

        const ids = `${resolved.map((r) => r.id).join(",")},`;
        return { ids, resolved };
    }

    /** save 类工具传参：优先业务编码，其次 display 首段，最后 id */
    materielRef(resolved: ResolvedEntity): string {
        if (resolved.code) return resolved.code;
        const head = resolved.display.split(" / ")[0]?.trim();
        if (head && !this.isPrimaryKey(head)) return head;
        return resolved.id;
    }

    private async loadMaterielByPrimaryKey(
        id: string
    ): Promise<ResolvedEntity | null> {
        const resp = await this.client.getMapById("/materiel", id);
        if (resp?.code !== 0 || !resp.data) return null;
        const data = resp.data;
        const code = String(data.code ?? "");
        return {
            id,
            code: code || undefined,
            display: this.formatMaterielDisplay(data),
        };
    }

    private async loadProcedureByPrimaryKey(
        id: string
    ): Promise<ResolvedEntity | null> {
        const resp = await this.client.getMapById("/procedure", id);
        if (resp?.code !== 0 || !resp.data) return null;
        const data = resp.data;
        const code = String(data.code ?? data.mesNo ?? "");
        const name = String(data.name ?? data.procedureName ?? "");
        return {
            id,
            code: code || undefined,
            display: [code, name].filter(Boolean).join(" / ") || id,
        };
    }

    /** 工序编号索引条目 */
    async loadProcedureCodeIndex(): Promise<
        Map<string, { id: string; display: string; mesName: string }>
    > {
        const map = new Map<string, { id: string; display: string; mesName: string }>();
        const response = await this.client.queryPageMap("/procedure", {
            className: "Procedure",
            page: 1,
            limit: 500,
        });
        if (!response || response.code !== 0) {
            return map;
        }
        for (const r of (response.data || []) as Record<string, unknown>[]) {
            const code = String(r.code ?? "").trim();
            const id = String(r.id ?? "").trim();
            if (!code || !id) continue;
            const name = String(r.name ?? "").trim();
            map.set(code, {
                id,
                display: [code, name].filter(Boolean).join(" / "),
                mesName: name,
            });
        }
        return map;
    }

    /** 从已加载索引解析工序 id（避免写入阶段逐条 queryPageMap） */
    resolveProcedureIdFromIndex(
        ref: string,
        index: Map<string, { id: string; display: string; mesName: string }>
    ): { id: string; display: string } | null {
        const trimmed = ref.trim();
        const hit = index.get(trimmed);
        if (hit) {
            return { id: hit.id, display: hit.display };
        }
        return null;
    }

    private formatMaterielDisplay(record: Record<string, unknown>): string {
        const code = String(record.code ?? record.materielCode ?? "");
        const name = String(record.name ?? record.materielName ?? "");
        const spec = String(record.spec ?? record.specification ?? "");
        return [code, name, spec].filter(Boolean).join(" / ") || String(record.id ?? "");
    }

    private pickUnique(
        records: Record<string, unknown>[],
        input: string,
        matchField: string,
        label: string,
        formatDisplay: (record: Record<string, unknown>) => string
    ): ResolvedEntity {
        if (records.length === 0) {
            throw new Error(`未找到${label}：${input}`);
        }

        const normalized = input.trim();
        const exact = records.filter(
            (r) => String(r[matchField] ?? "").trim() === normalized
        );

        const candidates = exact.length > 0 ? exact : records;

        if (candidates.length === 1) {
            const record = candidates[0];
            const id = String(record.id ?? "");
            if (!id) {
                throw new Error(`${label}记录缺少 id 字段`);
            }
            logger.info(`Resolved ${label}: ${input} → ${id} (${formatDisplay(record)})`);
            const code = String(
                record.code ?? record.materielCode ?? record.procedureCode ?? record.billNo ?? ""
            );
            return {
                id,
                display: formatDisplay(record),
                code: code || undefined,
            };
        }

        const lines = candidates.slice(0, 5).map((r, i) => {
            const id = String(r.id ?? "-");
            return `${i + 1}. ${formatDisplay(r)} (id: ${id})`;
        });

        throw new Error(
            `找到多条${label}「${input}」，请改用 UUID 或更精确的编码：\n${lines.join("\n")}`
        );
    }
}

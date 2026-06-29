import type { MesClient } from "./mesClient.js";
import type { MesMapResponse } from "../types/api.js";

export interface FilePreviewOptions {
    endpoint: string;
    id: string;
    pathField?: string;
}

export interface FilePreviewResult {
    endpoint: string;
    id: string;
    pathField: string;
    filePath: string;
    previewUrl: string;
    entity: Record<string, unknown>;
    response: MesMapResponse;
}

/**
 * 根据实体 ID 查询文件记录，并拼接 MES 静态文件访问地址。
 *
 * 默认从实体的 filePath 字段读取相对路径，最终拼接为：
 * {baseUrl}/files/{filePath}
 */
export class FilePreviewService {
    constructor(private readonly client: MesClient) {}

    async getPreviewById(options: FilePreviewOptions): Promise<FilePreviewResult> {
        const endpoint = normalizeEndpoint(options.endpoint);
        const id = options.id.trim();
        const pathField = options.pathField?.trim() || "filePath";

        if (!endpoint) {
            throw new Error("请提供 endpoint");
        }
        if (!id) {
            throw new Error("请提供文件实体 id");
        }

        const response = await this.client.getMapById(endpoint, id);
        const entity = normalizeEntity(response.data);
        const filePath = String(entity[pathField] ?? "").trim();

        if (!filePath) {
            throw new Error(`实体中没有找到有效的文件路径字段：${pathField}`);
        }

        return {
            endpoint,
            id,
            pathField,
            filePath,
            previewUrl: buildPreviewUrl(this.client.getBaseUrl(), filePath),
            entity,
            response,
        };
    }

    formatPreviewText(result: FilePreviewResult): string {
        return [
            `图片URL: ${result.previewUrl}`,
            "请读取这个文件URL的内容，并将文件下载并展示给用户看。","并告诉用户这个文件到底描述了什么"
        ].join("\n");
    }
}

function normalizeEndpoint(endpoint: string): string {
    const value = endpoint.trim();
    if (!value) {
        return "";
    }
    return value.startsWith("/") ? value : `/${value}`;
}

function normalizeEntity(data: unknown): Record<string, unknown> {
    if (Array.isArray(data)) {
        const first = data[0];
        if (first && typeof first === "object" && !Array.isArray(first)) {
            return first as Record<string, unknown>;
        }
        throw new Error("后端返回 data 为空，无法获取文件实体");
    }

    if (data && typeof data === "object") {
        return data as Record<string, unknown>;
    }

    throw new Error("后端返回 data 不是有效实体");
}

function buildPreviewUrl(baseUrl: string, filePath: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const normalizedFilePath = filePath.replace(/^\/+/, "").replace(/\\/g, "/");
    return `${normalizedBaseUrl}/files/${normalizedFilePath}`;
}

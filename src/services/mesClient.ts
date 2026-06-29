/**
 * MES API HTTP 客户端
 * 封装对 MES 系统 REST API 的调用，处理鉴权、超时、重试
 *
 * MES 鉴权方式（非标准）：
 * - 请求头: `token: <jwt>` （不是 Authorization: Bearer）
 * - 查询参数: `?token=<jwt>` 也可用
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import axios, {
    type AxiosInstance,
    type InternalAxiosRequestConfig,
} from "axios";
import type {
    MesConfig,
    QueryParams,
    MesPageResponse,
    MesListResponse,
    MesMapResponse,
    MesApiResponse,
} from "../types/api.js";
import { AuthService } from "./authService.js";
import { FieldMetaService } from "./fieldMetaService.js";
import { DictService } from "./dictService.js";
import { EntityResolverService } from "./entityResolverService.js";
import { logger } from "../utils/logger.js";
import { isMesRateLimited } from "../utils/mesResponse.js";
import { WriteThrottle } from "../utils/writeThrottle.js";

/** 扩展 axios 配置，添加自定义重试标记 */
interface RetryConfig extends InternalAxiosRequestConfig {
    __is401Retry?: boolean;
}

export class MesClient {
    private http: AxiosInstance;
    private authService: AuthService;
    private config: MesConfig;
    /** 字段元数据服务（懒初始化） */
    private _fieldMetaService: FieldMetaService | null = null;

    /** 字典服务（懒初始化） */
    private _dictService: DictService | null = null;

    /** 业务标识符解析（懒初始化） */
    private _entityResolver: EntityResolverService | null = null;

    /** 写入类 API 按 URL 排队，避免触发 MES 2 秒防重复提交 */
    private readonly writeThrottle: WriteThrottle;

    constructor(config: MesConfig) {
        this.config = config;
        this.authService = new AuthService(config);
        this.writeThrottle = new WriteThrottle(config.writeIntervalMs);

        this.http = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeout,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        // 请求拦截器：自动注入 MES 自定义 token 头
        this.http.interceptors.request.use(
            async (reqConfig) => {
                const token = await this.authService.getToken();
                // MES 使用自定义头 `token`（小写），不是标准 Authorization
                reqConfig.headers.token = token;
                return reqConfig;
            },
            (error) => Promise.reject(error)
        );

        // 响应拦截器
        this.http.interceptors.response.use(
            // 成功：记录日志
            (response) => {
                logger.debug(
                    `API ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`
                );
                return response;
            },
            // 失败：处理 401 自动重试，其他错误记录日志
            async (error) => {
                if (!axios.isAxiosError(error)) {
                    return Promise.reject(error);
                }

                const config = error.config as RetryConfig | undefined;
                const status = error.response?.status;

                // 401 自动刷新 Token 并重试（仅一次，避免死循环）
                if (status === 401 && config && !config.__is401Retry) {
                    logger.warn(
                        `401 Unauthorized on ${config.method?.toUpperCase()} ${config.url} — re-logging in...`
                    );
                    config.__is401Retry = true;

                    try {
                        // 清除旧 Token 缓存，强制重新登录
                        this.authService.clearToken();
                        // 重新获取 Token（将触发 loginAndGetToken）
                        const newToken = await this.authService.getToken();
                        // 更新请求头并重试
                        config.headers.token = newToken;
                        logger.info("Token refreshed, retrying request...");
                        return this.http.request(config);
                    } catch (reLoginError) {
                        logger.error("Re-login failed after 401", reLoginError);
                        return Promise.reject(reLoginError);
                    }
                }

                // 记录其他错误
                logger.error(
                    `API ${config?.method?.toUpperCase()} ${config?.url} failed`,
                    { status, message: error.message }
                );

                return Promise.reject(error);
            }
        );
    }

    /**
     * POST 请求（MES 系统统一使用 POST）
     * 支持网络错误自动重试（401 重试由响应拦截器处理）
     * allowRetry=false 用于 save/audit，避免触发 MES 2 秒防重复提交
     */
    private async post<T>(
        url: string,
        params?: Record<string, unknown>,
        options: {
            retryCount?: number;
            allowRetry?: boolean;
            timeoutMs?: number;
        } = {}
    ): Promise<T> {
        const retryCount = options.retryCount ?? 0;
        const allowRetry = options.allowRetry ?? true;
        const maxRetries = this.config.retry || 3;
        const timeoutMs = options.timeoutMs ?? this.config.timeout;

        try {
            // MES API 使用 URLSearchParams 格式传参
            const formData = new URLSearchParams();
            if (params) {
                for (const [key, value] of Object.entries(params)) {
                    if (value !== undefined && value !== null && value !== "") {
                        formData.append(key, String(value));
                    }
                }
            }

            const response = await this.http.post<T>(url, formData, { timeout: timeoutMs });
            return response.data;
        } catch (error) {
            // 写入类接口：HTTP 4xx/5xx 仍可能带 JSON body（MES 偶发「已保存但返回 400」）
            if (
                !allowRetry &&
                axios.isAxiosError(error) &&
                error.response?.data &&
                typeof error.response.data === "object"
            ) {
                logger.warn(
                    `Write API returned HTTP ${error.response.status}, using response body`,
                    error.response.data
                );
                return error.response.data as T;
            }

            // 写入类接口禁止自动重试（MES @NoRepeatSubmit 间隔 2 秒）
            if (
                allowRetry &&
                retryCount < maxRetries &&
                axios.isAxiosError(error) &&
                error.response?.status !== 401 // 401 已由拦截器处理，不在此重试
            ) {
                logger.warn(`Retrying ${url} (${retryCount + 1}/${maxRetries})`);
                await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, retryCount) * 500)
                );
                return this.post<T>(url, params, {
                    retryCount: retryCount + 1,
                    allowRetry,
                    timeoutMs,
                });
            }
            throw error;
        }
    }

    /**
     * 查询树形结构
     * @param endpoint 查询树形结构的url
     */
    async queryTreeList(endpoint: string): Promise<MesApiResponse>{
        logger.info("查询树形结构");
        return this.post<MesApiResponse>(`${endpoint}/queryListMap`);
    }

    async queryList(endpoint: string):Promise<MesApiResponse>{
        logger.info("查询数据库中每一行字段");
        return this.post<MesApiResponse>(`${endpoint}/queryList`);
    }

    /**
     * 分页查询
     */
    async queryPageMap(
        endpoint: string,
        params: QueryParams
    ): Promise<MesPageResponse> {
        const { page = 1, limit = 20, ...filters } = params;
        const requestParams: Record<string, unknown> = {
            page,
            limit,
            ...filters,
        };

        logger.info(`queryPageMap: ${endpoint}`, { page, limit });
        return this.post<MesPageResponse>(
            `${endpoint}/queryPageMap`,
            requestParams,
            { timeoutMs: this.config.queryTimeoutMs ?? 25000 }
        );
    }

    /**
     * 列表查询（不分页）
     */
    async queryListMap(
        endpoint: string,
        params: QueryParams = {}
    ): Promise<MesListResponse> {
        logger.info(`queryListMap: ${endpoint}`, params);
        return this.post<MesListResponse>(`${endpoint}/queryListMap`, params, {
            timeoutMs: this.config.queryTimeoutMs ?? 25000,
        });
    }

    /**
     * 通过 ID 查询 Map
     */
    async getMapById(endpoint: string, id: string): Promise<MesMapResponse> {
        logger.info(`getMapById: ${endpoint}, id=${id}`);
        return this.post<MesMapResponse>(`${endpoint}/getMapById`, { id }, {
            timeoutMs: this.config.queryTimeoutMs ?? 25000,
        });
    }

    /**
     * 通用 POST 请求（用于非标准接口，如 /taskReport/getTaskReport）
     */
    async customPost<T = unknown>(
        endpoint: string,
        params: Record<string, unknown> = {}
    ): Promise<T> {
        logger.info(`customPost: ${endpoint}`, params);
        return this.post<T>(endpoint, params, {
            timeoutMs: this.config.queryTimeoutMs ?? 25000,
        });
    }

    /**
     * 通用 JSON POST 请求，用于后端 @RequestBody 接口。
     */
    async customJsonPost<T = unknown>(
        endpoint: string,
        body: Record<string, unknown> = {}
    ): Promise<T> {
        logger.info(`customJsonPost: ${endpoint}`, body);
        const response = await this.http.post<T>(endpoint, body, {
            headers: {
                "Content-Type": "application/json",
            },
            timeout: this.config.queryTimeoutMs ?? 25000,
        });
        return response.data;
    }

    /**
     * 初始化 MES 表单字段数据。
     * 对应后端 POST /form/initFieldData，可传 className、contain、exclude 等参数。
     */
    async initFieldData<T = Record<string, unknown>>(
        params: Record<string, unknown> = {}
    ): Promise<MesMapResponse<T>> {
        logger.info("initFieldData: /form/initFieldData", params);
        return this.post<MesMapResponse<T>>("/form/initFieldData", params, {
            timeoutMs: this.config.queryTimeoutMs ?? 25000,
        });
    }

    /**
     * 保存单据（新增/修改）
     * childList 需传 JSON 字符串，与 MES 前端 saveEntityMap 一致
     * 自动按 URL 排队间隔，遇 code=7 时延迟重试
     */
    async saveEntityMap(
        endpoint: string,
        params: Record<string, unknown>
    ): Promise<MesApiResponse> {
        const payload = { ...params };
        if (payload.childList !== undefined && typeof payload.childList !== "string") {
            payload.childList = JSON.stringify(payload.childList);
        }
        const url = `${endpoint}/saveEntityMap`;
        logger.info(`saveEntityMap: ${endpoint}`);
        return this.throttledWrite(url, payload);
    }

    /**
     * 单据下达（审核）
     */
    async audit(endpoint: string, ids: string): Promise<MesApiResponse> {
        const url = `${endpoint}/audit`;
        logger.info(`audit: ${endpoint}, ids=${ids}`);
        return this.throttledWrite(url, { ids });
    }

    async delEntityById(endpoint: string, ids: string): Promise<MesApiResponse> {
        const url = `${endpoint}/delEntityById`;
        logger.info(`delEntityById: ${endpoint}, ids=${ids}`);
        return this.throttledWrite(url, { ids });
    }

    /**
     * 带限频排队与 code=7 重试的写入请求
     */
    private async throttledWrite(
        url: string,
        params: Record<string, unknown>
    ): Promise<MesApiResponse> {
        return this.writeThrottle.schedule(url, () =>
            this.postWriteWithRateLimitRetry(url, params)
        );
    }

    private async postWriteWithRateLimitRetry(
        url: string,
        params: Record<string, unknown>
    ): Promise<MesApiResponse> {
        const maxAttempts = 3;
        let last: MesApiResponse | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            last = await this.post<MesApiResponse>(url, params, { allowRetry: false });
            if (!isMesRateLimited(last)) {
                return last;
            }
            if (attempt < maxAttempts - 1) {
                const wait = this.writeThrottle.getIntervalMs();
                logger.warn(
                    `MES rate limit (code=7) on ${url}, retry in ${wait}ms (${attempt + 1}/${maxAttempts - 1})`
                );
                await new Promise((resolve) => setTimeout(resolve, wait));
            }
        }

        return last!;
    }

    /**
     * 初始化新增表单默认值（单号、日期等）
     */
    async initBusinessDataReturnView(
        endpoint: string,
        params: Record<string, unknown> = {}
    ): Promise<MesMapResponse> {
        logger.info(`initBusinessDataReturnView: ${endpoint}`, params);
        return this.post<MesMapResponse>(
            `${endpoint}/initBusinessDataReturnView`,
            params
        );
    }

    /**
     * 获取字段元数据服务（懒初始化）
     */
    get fieldMeta(): FieldMetaService {
        if (!this._fieldMetaService) {
            this._fieldMetaService = new FieldMetaService(this);
        }
        return this._fieldMetaService;
    }

    /**
     * 获取字典服务（懒初始化）
     */
    get dict(): DictService {
        if (!this._dictService) {
            this._dictService = new DictService(this);
        }
        return this._dictService;
    }

    /** 获取标识符解析服务（懒初始化） */
    get resolver(): EntityResolverService {
        if (!this._entityResolver) {
            this._entityResolver = new EntityResolverService(this);
        }
        return this._entityResolver;
    }

    /** MES 服务根地址（用于拼接 /files/ 预览链接） */
    getBaseUrl(): string {
        return this.config.baseUrl.replace(/\/$/, "");
    }

    /**
     * 工艺文件批量上传（multipart）
     * localFilePaths 为 MCP 所在机器上的本地文件绝对路径
     */
    async uploadEsopBatch(options: {
        localFilePaths: string[];
        filePath?: string;
        version: string;
        esopCategoryId: string;
        materielId?: string;
        procedureId?: string;
    }): Promise<MesApiResponse> {
        const files = options.localFilePaths.map((localPath) => ({
            buffer: readFileSync(localPath),
            filename: basename(localPath),
        }));
        return this.uploadEsopBatchFromBuffers({
            files,
            filePath: options.filePath,
            version: options.version,
            esopCategoryId: options.esopCategoryId,
            materielId: options.materielId,
            procedureId: "  ",
        });
    }

    /**
     * 工艺文件批量上传（内存 Buffer，供 base64 场景使用）
     */
    async uploadEsopBatchFromBuffers(options: {
        files: { buffer: Buffer; filename: string }[];
        filePath?: string;
        version: string;
        esopCategoryId: string;
        materielId?: string;
        procedureId?: string;
    }): Promise<MesApiResponse> {
        if (options.files.length === 0) {
            throw new Error("请提供至少一个文件");
        }

        const form = new FormData();
        for (const file of options.files) {
            form.append("file", new Blob([new Uint8Array(file.buffer)]), file.filename);
        }
        form.append("version", options.version);
        form.append("esopCategoryId", options.esopCategoryId);
        if (options.materielId) {
            form.append("materielId", options.materielId);
        }
        // if (options.procedureId) {
        //     form.append("procedureId", options.procedureId);
            form.append("procedureId", " ");
        // }

        const storagePath = options.filePath ?? "ESOP";
        const token = await this.authService.getToken();
        logger.info(`uploadEsopBatchFromBuffers: ${options.files.length} file(s)`);

        try {
            const response = await this.http.post<MesApiResponse>(
                `/esopAttachment/uploadBatch?filePath=${encodeURIComponent(storagePath)}`,
                form,
                {
                    headers: { token },
                    transformRequest: [(data, headers) => {
                        if (headers) {
                            delete headers["Content-Type"];
                        }
                        return data;
                    }],
                }
            );
            return response.data;
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.data &&
                typeof error.response.data === "object"
            ) {
                logger.warn(
                    `uploadEsopBatchFromBuffers returned HTTP ${error.response.status}, using response body`,
                    error.response.data
                );
                return error.response.data as MesApiResponse;
            }
            throw error;
        }
    }

    /**
     * 下载 MES 静态文件（/files/ 相对路径，无需鉴权）
     */
    async downloadStaticFile(relativePath: string): Promise<Buffer> {
        const path = String(relativePath).replace(/^\/+/, "").replace(/\\/g, "/");
        if (!path) {
            throw new Error("文件路径为空");
        }
        logger.info(`downloadStaticFile: /files/${path}`);
        const response = await this.http.get<ArrayBuffer>(`/files/${path}`, {
            responseType: "arraybuffer",
            timeout: Math.max(this.config.timeout, 120_000),
        });
        return Buffer.from(response.data);
    }





}

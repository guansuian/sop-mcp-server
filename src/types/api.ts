/**
 * MES API 统一响应类型定义
 */

/** 通用 API 响应包装 */
export interface MesApiResponse<T = unknown> {
    code: number;
    msg: string;
    data: T;
}

/** 分页查询响应 */
export interface MesPageResponse<T = unknown> extends MesApiResponse<T[]> {
    count: number;
    page: number;
    limit: number;
}

/** 列表查询响应 */
export interface MesListResponse<T = unknown> extends MesApiResponse<T[]> {
    count: number;
}

/** 单条查询响应 */
export interface MesMapResponse<T = Record<string, unknown>> extends MesApiResponse<T> {}

/** 查询参数 */
export interface QueryParams {
    page?: number;
    limit?: number;
    [key: string]: unknown;
}

/** 分页结果（MCP Tool 返回格式） */
export interface PaginatedResult<T = Record<string, unknown>> {
    records: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/** 统计汇总结果 */
export interface SummaryResult {
    groupKey: string;
    finishedNum: number;
    qualifiedNum: number;
    unqualifiedNum: number;
    scrapNum: number;
    reworkNum: number;
    qualifiedRate: string;
    recordCount: number;
}

/** MES 配置 */
export interface MesConfig {
    baseUrl: string;
    auth: MesAuthConfig;
    timeout: number;
    /** 查询类 API 超时（毫秒），避免 dryRun 因 MES 卡顿拖到客户端 MCP 超时，默认 25000 */
    queryTimeoutMs?: number;
    retry: number;
    /** 同 URL 写入最小间隔（毫秒），适配 MES @NoRepeatSubmit 2 秒限制，默认 2100 */
    writeIntervalMs?: number;
}

export type MesAuthConfig =
    | { type: "token"; token: string }
    | { type: "login"; username: string; password: string; loginUrl: string };

/** Tool 启用配置 */
export interface ToolsConfig {
    [toolName: string]: boolean;
}

/** 完整应用配置 */
export interface AppConfig {
    mes: MesConfig;
    tools: ToolsConfig;
}

/**
 * 表格类 单元格
 */
export interface Cell{
    id:string;//id
    name:string;//名字
}

export interface MaterielCell extends Cell{
    code:string;//编号
}
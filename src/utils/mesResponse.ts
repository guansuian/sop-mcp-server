/**
 * MES 响应判断（saveEntityMap / audit 等返回 ResponseInfo，字段为 message 而非 msg）
 */

export type MesLikeResponse = {
    code?: unknown;
    msg?: unknown;
    message?: unknown;
};

export function isMesSuccess(response: MesLikeResponse | null | undefined): boolean {
    return response != null && Number(response.code) === 0;
}

export function getMesErrorMessage(
    response: MesLikeResponse | null | undefined,
    fallback = "未知错误"
): string {
    const text = response?.msg ?? response?.message;
    if (text === null || text === undefined || String(text).trim() === "") {
        return fallback;
    }
    return String(text);
}

export function getMesSuccessMessage(
    response: MesLikeResponse | null | undefined,
    fallback = "操作成功"
): string {
    return getMesErrorMessage(response, fallback);
}

/** MES code=7：同一 token 在 2 秒内重复调用同一 save 接口 */
export function isMesRateLimited(response: MesLikeResponse | null | undefined): boolean {
    return Number(response?.code) === 7;
}

/**
 * 本地 MES 新增工序时常见：save 已成功但 @CacheEvict(key=#map['id']) 因 id 为空抛错 → HTTP 400「请求页面不存在」
 */
export function isMesProcedureCreateCacheGlitch(
    response: MesLikeResponse | null | undefined
): boolean {
    if (isMesSuccess(response)) return false;
    const msg = getMesErrorMessage(response, "");
    return (
        Number(response?.code) === 400 &&
        (msg.includes("请求页面不存在") ||
            msg.toLowerCase().includes("null key") ||
            msg.includes("cache operation"))
    );
}

export function formatMesErrorForUser(
    response: MesLikeResponse | null | undefined,
    fallback = "未知错误"
): string {
    const msg = getMesErrorMessage(response, fallback);
    if (isMesRateLimited(response)) {
        return (
            `${msg}\n\n` +
            `原因：MES 对「保存/下达」类接口有 **2 秒防重复提交**（同一 token + 同一 URL）。\n` +
            `请使用 **productProcess_import_from_drawing** 一次写入（MCP 会自动排队）；` +
            `勿在 WorkBuddy 中循环调用 procedure_save / qualityControl_save。`
        );
    }
    return msg;
}

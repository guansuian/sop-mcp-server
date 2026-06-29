/**
 * 鉴权服务
 * 管理 JWT Token 的获取、缓存与自动刷新
 *
 * MES 系统鉴权机制：
 * - 登录: POST /main/login (application/x-www-form-urlencoded)
 * - 响应: { token: "<jwt>", loginTime: <epoch_ms> }
 * - Token 携带: 自定义请求头 `token` 或查询参数 `token`
 * - Token 有效期: 7200 秒 (2小时)，剩余 <10分钟时自动续期
 */

import type { MesConfig, MesAuthConfig } from "../types/api.js";
import { cacheService } from "./cacheService.js";
import { logger } from "../utils/logger.js";
import axios from "axios";

const TOKEN_CACHE_KEY = "mes:auth:token";

/** Token 缓存时间：110分钟（MES 有效期 120分钟，留 10分钟安全边界） */
const TOKEN_CACHE_TTL_MS = 110 * 60 * 1000;

export class AuthService {
    private mesConfig: MesConfig;

    constructor(mesConfig: MesConfig) {
        this.mesConfig = mesConfig;
    }

    /**
     * 获取有效的 JWT Token
     * 优先从缓存获取，若不存在则根据配置类型获取
     */
    async getToken(): Promise<string> {
        // 尝试从缓存获取
        const cached = cacheService.get<string>(TOKEN_CACHE_KEY);
        if (cached) {
            return cached;
        }

        const auth = this.mesConfig.auth;

        if (auth.type === "token") {
            // 方案 A: 固定 Token
            logger.info("Using configured static token");
            cacheService.set(TOKEN_CACHE_KEY, auth.token, TOKEN_CACHE_TTL_MS);
            return auth.token;
        } else {
            // 方案 B: 账号密码自动登录
            logger.info("Logging in with username/password...");
            return this.loginAndGetToken(auth);
        }
    }

    /**
     * 通过登录接口获取 JWT Token
     * MES 使用 Spring Security form-login，要求 application/x-www-form-urlencoded 格式
     */
    private async loginAndGetToken(
        auth: Extract<MesAuthConfig, { type: "login" }>
    ): Promise<string> {
        // 构建完整的登录 URL
        const loginUrl = this.buildLoginUrl(auth.loginUrl);

        try {
            // MES 的 /main/login 要求 form-urlencoded 格式，字段名为 username 和 password
            const params = new URLSearchParams();
            params.append("username", auth.username);
            params.append("password", auth.password);

            logger.info(`POST ${loginUrl} (form-urlencoded)`);

            const response = await axios.post(loginUrl, params, {
                timeout: this.mesConfig.timeout,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            const data = response.data;

            // MES 登录成功返回: { token: "<jwt>", loginTime: <epoch_ms> }
            // 登录失败返回: { code: 401, msg: "<error>", isLoginErr: true }
            if (data.code === 401 || data.isLoginErr) {
                throw new Error(`Login rejected by MES: ${data.msg || "Unknown error"}`);
            }

            const token = data.token;
            if (!token || typeof token !== "string") {
                throw new Error(
                    `Unable to extract token from login response. ` +
                    `Expected { token: "...", loginTime: ... }, got: ${JSON.stringify(data)}`
                );
            }

            // 缓存 Token
            cacheService.set(TOKEN_CACHE_KEY, token, TOKEN_CACHE_TTL_MS);
            logger.info(
                `Token obtained and cached (TTL: ${TOKEN_CACHE_TTL_MS / 1000}s). ` +
                `Will auto-refresh after expiry.`
            );
            return token;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Login failed: ${error.message} (status: ${error.response?.status}). ` +
                    `Login URL: ${loginUrl}`
                );
            }
            throw error;
        }
    }

    /**
     * 处理鉴权错误（如 401 Unauthorized）
     * 清除旧 Token 缓存，下次请求会自动重新登录获取新 Token
     */
    handleAuthError(statusCode: number): boolean {
        if (statusCode === 401) {
            logger.warn("Received 401 Unauthorized — clearing cached token for re-login");
            this.clearToken();
            return true; // 表示调用方应重试
        }
        return false;
    }

    /**
     * 构建完整的登录 URL
     * 如果 loginUrl 是相对路径（如 /main/login），则拼接到 baseUrl 后面
     * 如果 loginUrl 是绝对 URL（如 http://...），则直接使用
     */
    private buildLoginUrl(loginUrl: string): string {
        if (loginUrl.startsWith("http://") || loginUrl.startsWith("https://")) {
            return loginUrl;
        }
        // 相对路径，拼接 baseUrl
        const base = this.mesConfig.baseUrl.replace(/\/+$/, "");
        const path = loginUrl.startsWith("/") ? loginUrl : `/${loginUrl}`;
        return `${base}${path}`;
    }

    /** 清除缓存的 Token（强制重新登录） */
    clearToken(): void {
        cacheService.delete(TOKEN_CACHE_KEY);
        logger.info("Token cache cleared — next request will trigger re-login");
    }
}

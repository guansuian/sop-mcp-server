import assert from "node:assert/strict";
import test from "node:test";

import { handler } from "../src/tools/andonAbnormalReport/query_abnormal_report_page.js";
import type { MesClient } from "../src/services/mesClient.js";

test("queryAbnormalReportPage builds query and table from form configuration", async () => {
    let capturedFormParams: Record<string, unknown> | undefined;
    let capturedPageEndpoint = "";
    let capturedPageParams: Record<string, unknown> | undefined;

    const client = {
        async initFieldData(params: Record<string, unknown>) {
            capturedFormParams = params;
            return {
                code: 0,
                msg: "ok",
                message: "操作成功",
                data: {
                    childList: [
                        {
                            title: "上报工位",
                            field: "billUserName",
                            isTable: "1",
                            isSearch: "1",
                            fieldType: "varchar",
                            sort: 1,
                        },
                        {
                            title: "发生时间",
                            field: "beginOccurDate",
                            isTable: "1",
                            isSearch: "1",
                            fieldType: "datetime",
                            sort: 2,
                        },
                        {
                            title: "处理结果",
                            field: "handleResult",
                            isTable: "1",
                            isSearch: "1",
                            fieldType: "varchar",
                            sort: 3,
                        },
                        {
                            title: "备注",
                            field: "remarks",
                            isTable: "0",
                            isSearch: "1",
                            fieldType: "varchar",
                            sort: 4,
                        },
                        {
                            title: "删除标记",
                            field: "delFlag",
                            isTable: "0",
                            isSearch: "0",
                            fieldType: "int",
                            sort: 5,
                        },
                    ],
                },
            };
        },
        async queryPageMap(endpoint: string, params: Record<string, unknown>) {
            capturedPageEndpoint = endpoint;
            capturedPageParams = params;
            return {
                code: 0,
                msg: "ok",
                count: 12,
                page: 2,
                limit: 5,
                data: [
                    {
                        billUserName: "张三",
                        beginOccurDate: "2026-06-18 08:00:00",
                        handleResult: "已处理",
                        remarks: "内部备注不展示",
                    },
                ],
            };
        },
    } as Pick<MesClient, "initFieldData" | "queryPageMap"> as MesClient;

    const result = await handler(client, {
        className: "OtherReport",
        page: 2,
        limit: 5,
        filters: {
            billUserName: "张三",
            beginOccurDate: {
                start: "2026-06-18 00:00:00",
                end: "2026-06-18 23:59:59",
            },
            remarks: "内部",
            delFlag: "0",
            unknownField: "ignored",
        },
    });

    assert.deepEqual(capturedFormParams, {
        className: "AndonAbnormalReport",
        contain: "",
        exclude: "",
    });
    assert.equal(capturedPageEndpoint, "/andonAbnormalReport");
    assert.deepEqual(capturedPageParams, {
        className: "AndonAbnormalReport",
        page: 2,
        limit: 5,
        extraDefinition_like_billUserName: "张三",
        beginOccurDate: "2026-06-18 00:00:00 ~ 2026-06-18 23:59:59",
        extraDefinition_like_remarks: "内部",
    });

    assert.equal(result.content.length, 1);
    const [content] = result.content;
    if (content.type !== "text") {
        throw new Error(`Expected text content, got ${content.type}`);
    }
    assert.match(content.text, /异常记录分页查询结果/);
    assert.match(content.text, /\| 上报工位 \| 发生时间 \| 处理结果 \|/);
    assert.match(content.text, /\| 张三 \| 2026-06-18 08:00:00 \| 已处理 \|/);
    assert.doesNotMatch(content.text, /内部备注不展示/);
    assert.match(content.text, /nextPage: 3/);
});

test("queryAbnormalReportPage keeps numeric fields exact and skips incomplete date ranges", async () => {
    let capturedPageParams: Record<string, unknown> | undefined;
    const client = {
        async initFieldData() {
            return {
                code: 0,
                msg: "ok",
                data: {
                    childList: [
                        {
                            title: "持续时长",
                            field: "duration",
                            isTable: "1",
                            isSearch: "1",
                            fieldType: "int",
                            sort: 1,
                        },
                        {
                            title: "关闭时间",
                            field: "closeTime",
                            isTable: "1",
                            isSearch: "1",
                            fieldType: "datetime",
                            sort: 2,
                        },
                    ],
                },
            };
        },
        async queryPageMap(_endpoint: string, params: Record<string, unknown>) {
            capturedPageParams = params;
            return {
                code: 0,
                msg: "ok",
                count: 0,
                page: 1,
                limit: 5,
                data: [],
            };
        },
    } as Pick<MesClient, "initFieldData" | "queryPageMap"> as MesClient;

    await handler(client, {
        filters: {
            duration: 30,
            closeTime: {
                start: "2026-06-18 00:00:00",
            },
        },
    });

    assert.deepEqual(capturedPageParams, {
        className: "AndonAbnormalReport",
        page: 1,
        limit: 5,
        duration: 30,
    });
});

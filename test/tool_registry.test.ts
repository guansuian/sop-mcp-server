import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { allToolNames } from "../src/tools/index.js";

test("tool registry only exposes existing abnormal report tool", () => {
    assert.deepEqual(allToolNames, ["queryAbnormalReportPage"]);
});

test("mes config only enables existing tools", () => {
    const config = JSON.parse(
        readFileSync("config/mes-config.json", "utf-8"),
    ) as { tools?: Record<string, boolean> };

    assert.deepEqual(Object.keys(config.tools ?? {}), allToolNames);
});

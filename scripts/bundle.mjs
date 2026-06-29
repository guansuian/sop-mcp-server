/**
 * esbuild bundle script
 *
 * Bundles src/index.ts + all dependencies (including node_modules) into a single
 * self-contained ESM file that can run on any machine with Node.js >= 18.
 *
 * Usage: node scripts/bundle.mjs
 * Output: andon_sop-mcp.mjs (project root)
 */

import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function bundle() {
    console.log("Bundling andon_sop-mcp...");

    const result = await esbuild.build({
        entryPoints: [resolve(root, "src", "index.ts")],
        bundle: true,
        platform: "node",
        target: "node18",
        format: "esm",
        outfile: resolve(root, "andon_sop-mcp.mjs"),
        // Bundle everything — no externals
        external: [],
        // Keep readable for debugging (not minified)
        minify: false,
        // Generate source map for debugging
        sourcemap: true,
        // Shebang + CJS compatibility shim for dependencies that use require()
        // (e.g., axios → form-data → combined-stream does require('util'))
        banner: {
            js: `#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
`,
        },
        // Preserve ESM semantics
        mainFields: ["module", "main"],
    });

    if (result.errors.length > 0) {
        console.error("Bundle errors:", result.errors);
        process.exit(1);
    }

    if (result.warnings.length > 0) {
        console.warn("Bundle warnings:", result.warnings);
    }

    // Print output size
    const stats = readFileSync(resolve(root, "andon_sop-mcp.mjs"), "utf-8");
    const sizeKB = (Buffer.byteLength(stats, "utf-8") / 1024).toFixed(1);
    console.log(`Bundle complete: andon_sop-mcp.mjs (${sizeKB} KB)`);
}

bundle().catch((err) => {
    console.error("Bundle failed:", err);
    process.exit(1);
});

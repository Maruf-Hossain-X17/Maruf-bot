/**
 * start.js — Maruf Bot Launcher
 * 
 * Features:
 *   - Config file validation (JSON parse check)
 *   - Integrated 3D Dashboard Engine
 *   - Memory guard (prevents Render OOM kill)
 *   - Graceful shutdown handling
 *   - Memory usage monitoring
 *   - Non-blocking startup
 * 
 * Original Goat Bot V2 by NTKhang03 (MIT License)
 * Enhanced by Maruf — bug fixes, memory safety
 */

const fs = require("fs-extra");
const path = require("path");

// ============================================================
// DASHBOARD INTEGRATION
// ============================================================
try {
        require("./dashboard/dashboard.js");
} catch (err) {
        console.error("[DASHBOARD] Failed to initialize:", err.message);
}

// ============================================================
// CONFIG
// ============================================================
const MEMORY_LIMIT_MB = 400;              // Node heap limit
const MEMORY_WARN_MB = 350;               // Warning threshold
const MEMORY_CHECK_INTERVAL_MS = 5 * 60_000;  // Check every 5 min
const REQUIRED_FILES = ["config.json", "configCommands.json", "account.txt"];

// ============================================================
// LOGGER
// ============================================================
function log(tag, msg) {
        const time = new Date().toISOString().replace("T", " ").slice(0, 19);
        console.log(`[${time}] [START] ${tag} ${msg}`);
}

// ============================================================
// MEMORY GUARD — Prevent Render OOM Kill
// ============================================================
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes("max-old-space-size")) {
        const opts = (process.env.NODE_OPTIONS || "").trim();
        process.env.NODE_OPTIONS = `${opts} --max-old-space-size=${MEMORY_LIMIT_MB}`.trim();
        log("⚙️", `Memory limit set: ${MEMORY_LIMIT_MB}MB`);
}

// Memory monitor
let memWarnedAt = 0;
setInterval(() => {
        try {
                const m = process.memoryUsage();
                const heapMB = Math.round(m.heapUsed / 1024 / 1024);
                const rssMB = Math.round(m.rss / 1024 / 1024);
                const externalMB = Math.round((m.external || 0) / 1024 / 1024);

                if (heapMB > MEMORY_WARN_MB) {
                        const now = Date.now();
                        if (now - memWarnedAt > 60_000) { // don't spam
                                memWarnedAt = now;
                                log("⚠️", `HIGH MEMORY — Heap: ${heapMB}MB, RSS: ${rssMB}MB, External: ${externalMB}MB`);
                        }
                } else {
                        log("✅", `Memory OK — Heap: ${heapMB}MB, RSS: ${rssMB}MB`);
                }

                // Force GC if available and heap is high
                if (heapMB > MEMORY_LIMIT_MB * 0.9 && typeof global.gc === "function") {
                        log("🔄", "Triggering garbage collection...");
                        global.gc();
                }
        } catch (_) {}
}, MEMORY_CHECK_INTERVAL_MS).unref?.();

// ============================================================
// CONFIG FILE VALIDATION
// ============================================================
log("🔍", "Validating config files...");

let hasError = false;

for (const file of REQUIRED_FILES) {
        const abs = path.resolve(__dirname, file);

        // Check file exists
        if (!fs.existsSync(abs)) {
                log("❌", `Required file missing: ${file}`);
                log("💡", `Make sure it's committed to GitHub (not in .gitignore)`);
                hasError = true;
                continue;
        }

        // Check file is not empty
        const stats = fs.statSync(abs);
        if (stats.size === 0) {
                log("❌", `File is empty: ${file}`);
                hasError = true;
                continue;
        }

        // Validate JSON files
        if (file.endsWith(".json")) {
                try {
                        const content = fs.readFileSync(abs, "utf-8");
                        JSON.parse(content);
                        log("✅", `${file} OK (${content.length} bytes)`);
                } catch (err) {
                        log("❌", `Invalid JSON in ${file}: ${err.message}`);
                        hasError = true;
                }
        } else {
                log("✅", `${file} OK (${stats.size} bytes)`);
        }
}

if (hasError) {
        log("💀", "Startup aborted due to config errors.");
        process.exit(1);
}

// ============================================================
// GRACEFUL SHUTDOWN — Render sends SIGTERM before kill
// ============================================================
let isShuttingDown = false;

function shutdown(signal) {
        if (isShuttingDown) return;
        isShuttingDown = true;

        log("🛑", `Received ${signal} — shutting down...`);

        // Give 3 seconds for any pending operations
        setTimeout(() => {
                log("👋", "Goodbye.");
                // exit code 2 → launcher (Goat.js) will restart
                process.exit(2);
        }, 500).unref?.();

        // Force exit after 3s if something hangs
        setTimeout(() => {
                log("⚠️", "Force exit (timeout).");
                process.exit(2);
        }, 3000).unref?.();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

// ============================================================
// CRASH HANDLERS — Log stack traces
// ============================================================
process.on("uncaughtException", (err) => {
        console.error("╔══════════════════════════════════════╗");
        console.error("║       UNCAUGHT EXCEPTION             ║");
        console.error("╚══════════════════════════════════════╝");
        console.error(`Time: ${new Date().toISOString()}`);
        console.error(`Message: ${err?.message || err}`);
        console.error(`Stack:\n${err?.stack || "(no stack)"}`);
});

process.on("unhandledRejection", (reason) => {
        console.error("╔══════════════════════════════════════╗");
        console.error("║      UNHANDLED REJECTION             ║");
        console.error("╚══════════════════════════════════════╝");
        console.error(`Time: ${new Date().toISOString()}`);
        console.error(`Reason: ${reason?.stack || reason?.message || reason}`);
});

// ============================================================
// START BOT
// ============================================================
log("🚀", "All checks passed. Starting bot...");
log("ℹ️", `Node: ${process.version} | Platform: ${process.platform} | PID: ${process.pid}`);

try {
        require("./Goat.js");
} catch (err) {
        log("❌", `Failed to start bot: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
}
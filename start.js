/**
 * start.js — Maruf Bot
 * Launches the bot. Config files are read directly from the project root (GitHub repo).
 */

const fs = require("fs-extra");
const path = require("path");

function log(tag, msg) {
    const time = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(`[${time}] [START] ${tag} ${msg}`);
}

// ————— Validate required files exist in project root —————
const REQUIRED = ["config.json", "configCommands.json", "account.txt"];

for (const file of REQUIRED) {
    const abs = path.resolve(__dirname, file);
    if (!fs.existsSync(abs)) {
        log("❌", `Required file missing: ${file}`);
        log("💡", `Make sure it's committed to GitHub (not in .gitignore)`);
        process.exit(1);
    }

    // Validate JSON files
    if (file.endsWith(".json")) {
        try {
            const content = fs.readFileSync(abs, "utf-8");
            JSON.parse(content);
            log("✅", `${file} OK (${content.length} bytes)`);
        } catch (err) {
            log("❌", `Invalid JSON in ${file}: ${err.message}`);
            process.exit(1);
        }
    } else {
        log("✅", `${file} OK`);
    }
}

log("🚀", "Starting bot...");
require("./Goat.js");
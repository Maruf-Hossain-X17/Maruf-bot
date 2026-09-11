/**
 * Goat Bot V2 - autoUpdater launcher (Bug-fixed & Powerful)
 * Original pattern: NTKhang03
 * Enhanced: retry, fallback CDN, safe eval, rollback backup
 *
 * Save as: updater-launcher.js  (or replace the old snippet)
 * Run: node updater-launcher.js
 */

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

// ============ CONFIG ============
const REPO_OWNER = "maruf127679-pixel";
const REPO_NAME = "Maruf-bot";
const REPO_BRANCH = "main";
const FILE_NAME = "updater.js";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const HTTP_TIMEOUT = 60000;
const MAX_RETRY = 3;

const SOURCES = [
	`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${FILE_NAME}`,
	`https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${REPO_BRANCH}/${FILE_NAME}`,
	`https://gitcdn.link/repo/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${FILE_NAME}`
];

const agent = new https.Agent({ keepAlive: true });

const client = axios.create({
	timeout: HTTP_TIMEOUT,
	httpsAgent: agent,
	headers: {
		"user-agent": "GoatBot-Updater/2.0",
		...(GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {})
	}
});

async function retry(fn, tries = MAX_RETRY, delay = 1500) {
	let lastErr;
	for (let i = 0; i < tries; i++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			const status = err?.response?.status;
			// don't retry on 4xx (except 429 rate limit)
			if (status && status < 500 && status !== 429) break;
			if (i < tries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
		}
	}
	throw lastErr;
}

async function downloadUpdater() {
	let lastErr;
	for (const url of SOURCES) {
		try {
			const { data } = await retry(() => client.get(url, { responseType: "text" }));
			if (typeof data === "string" && data.length > 100) {
				console.log(`[✓] Downloaded updater.js from: ${url}`);
				return data;
			}
		} catch (err) {
			lastErr = err;
			console.log(`[!] Source failed (${url}): ${err.message}`);
		}
	}
	throw lastErr || new Error("All sources failed");
}

(async () => {
	try {
		const rawCode = await downloadUpdater();

		const updaterPath = path.join(process.cwd(), FILE_NAME);
		const backupPath = path.join(process.cwd(), `${FILE_NAME}.bak`);

		// backup existing updater.js before overwrite
		if (fs.existsSync(updaterPath)) {
			try {
				fs.copyFileSync(updaterPath, backupPath);
				console.log(`[💾] Backup created: ${path.basename(backupPath)}`);
			} catch (_) {}
		}

		// write new updater.js to disk
		fs.writeFileSync(updaterPath, rawCode, "utf-8");
		console.log(`[✓] Saved to: ${updaterPath}`);

		// run in a fresh Node process — safer than eval()
		console.log(`[▶] Running updater...\n`);
		execFileSync(process.execPath, [updaterPath], { stdio: "inherit" });
	} catch (err) {
		console.error("\n[✗] Updater failed:", err.message);
		console.error("    Please check your internet connection or GitHub access.");
		process.exitCode = 1;
	}
})();
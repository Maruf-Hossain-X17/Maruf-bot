/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * --------------------------------------------------------------------------
 * autoUptime enhanced by Maruf — bug fixes, timeout, retry, jitter, drift-free
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

const axios = require("axios");
const { config } = global.GoatBot;
const { log, getText } = global.utils;

// ————— state —————
if (global.timeOutUptime) {
	clearInterval(global.timeOutUptime);
	clearTimeout(global.timeOutUptime);
	global.timeOutUptime = null;
}
if (global.autoUptimeRunning) return; // prevent duplicate init

if (!config?.autoUptime?.enable) return;

// ————— config sanitize —————
const REQUEST_TIMEOUT = 15_000;             // 15s per request
const MAX_RETRIES = 3;                      // retries before marking failed
const RETRY_DELAY = 2_000;                  // delay between retries
let intervalSec = Number(config.autoUptime.timeInterval) || 180;
if (!isFinite(intervalSec) || intervalSec < 30) intervalSec = 30;  // min 30s
const INTERVAL_MS = intervalSec * 1000;

const PORT = config.dashBoard?.port ||
	(!isNaN(config.serverUptime?.port) && config.serverUptime.port) ||
	3001;

// ————— build URL (robust) —————
function buildUptimeUrl() {
	let url = (config.autoUptime.url || "").trim();

	if (!url) {
		if (process.env.REPL_OWNER) {
			url = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
		} else if (process.env.API_SERVER_EXTERNAL === "https://api.glitch.com") {
			url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
		} else {
			url = `http://localhost:${PORT}`;
		}
	}

	// fix scheme: if URL host is localhost/127.0.0.1, ensure http://
	if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
		url = url.replace(/^https:/i, "http:");
	}

	// append /uptime if not present, avoid double slash
	try {
		const u = new URL(url);
		if (!u.pathname.replace(/\/+$/, "").endsWith("/uptime")) {
			u.pathname = u.pathname.replace(/\/+$/, "") + "/uptime";
		}
		url = u.toString();
	} catch (_) {
		// fallback string concat
		url = url.replace(/\/+$/, "") + "/uptime";
	}

	return url;
}

const myUrl = buildUptimeUrl();

// ————— client —————
const client = axios.create({
	timeout: REQUEST_TIMEOUT,
	validateStatus: () => true, // we handle status manually
	httpsAgent: new (require("https").Agent)({ keepAlive: true }),
	headers: { "user-agent": "GoatBot-Uptime/2.0" }
});

let status = "unknown"; // "ok" | "failed" | "unknown"
let consecutiveFailures = 0;
let stopped = false;

// ————— single ping with retries —————
async function pingOnce() {
	let lastErr;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const res = await client.get(myUrl);
			if (res.status >= 200 && res.status < 400) return { ok: true, res };
			lastErr = new Error(`HTTP ${res.status}`);
		} catch (err) {
			lastErr = err;
		}
		if (attempt < MAX_RETRIES) {
			await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
		}
	}
	throw lastErr;
}

// ————— read statusAccountBot from response —————
function extractBotStatus(res, err) {
	// server returns JSON {status, uptime, statusAccountBot}
	try {
		if (res?.data && typeof res.data === "object" && res.data.statusAccountBot) {
			return res.data.statusAccountBot;
		}
	} catch (_) {}
	try {
		const e = err?.response?.data;
		if (e && typeof e === "object" && e.statusAccountBot) return e.statusAccountBot;
	} catch (_) {}
	return null;
}

// ————— main ping cycle —————
async function autoUptime() {
	if (stopped) return;

	try {
		const { res } = await pingOnce();
		const botStatus = extractBotStatus(res);

		if (botStatus === "block spam") {
			if (status !== "block spam") {
				log.err("UPTIME", "Your account is blocked (spam)");
				status = "block spam";
			}
			consecutiveFailures = 0;
		} else if (botStatus === "can't login") {
			if (status !== "no-login") {
				log.err("UPTIME", "Can't login account bot");
				status = "no-login";
			}
			consecutiveFailures = 0;
		} else {
			if (status !== "ok") {
				status = "ok";
				log.info("UPTIME", "Bot is online");
			}
			consecutiveFailures = 0;
		}
	} catch (err) {
		consecutiveFailures++;

		// only mark failed after all retries exhausted
		if (consecutiveFailures >= 1 && status !== "failed") {
			status = "failed";
			const botStatus = extractBotStatus(null, err);
			if (botStatus === "can't login")
				log.err("UPTIME", "Can't login account bot");
			else if (botStatus === "block spam")
				log.err("UPTIME", "Your account is blocked");
			else
				log.err("UPTIME", `Ping failed: ${err.message || err}`);
		}
	}
}

// ————— drift-free scheduler —————
function scheduleNext(delayMs) {
	if (stopped) return;
	const jitter = Math.floor(delayMs * 0.05 * (Math.random() * 2 - 1)); // ±5%
	global.timeOutUptime = setTimeout(async () => {
		if (stopped) return;
		await autoUptime();
		scheduleNext(INTERVAL_MS);
	}, Math.max(1000, delayMs + jitter));
}

// ————— start —————
global.autoUptimeRunning = true;

// first ping after interval (matches original behavior)
scheduleNext(INTERVAL_MS);

log.info("AUTO UPTIME", getText("autoUptime", "autoUptimeTurnedOn", myUrl));

// ————— graceful shutdown —————
function stopUptime() {
	stopped = true;
	if (global.timeOutUptime) {
		clearTimeout(global.timeOutUptime);
		global.timeOutUptime = null;
	}
	global.autoUptimeRunning = false;
}
process.once("SIGTERM", stopUptime);
process.once("SIGINT", stopUptime);
global.stopAutoUptime = stopUptime;
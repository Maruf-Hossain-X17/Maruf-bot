/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * English:
 * ! Please do not change the below code, it is very important for the project.
 * It is my motivation to maintain and develop the project for free.
 * ! If you change it, you will be banned forever
 * Thank you for using
 *
 * --------------------------------------------------------------------------
 * Launcher & bootstrap enhanced by Maruf (bug-fix + security hardening)
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

// ———————————————— GLOBAL ERROR HANDLERS ———————————————— //
process.on("unhandledRejection", (error) => {
	try {
		console.error(`[unhandledRejection] ${new Date().toISOString()}`);
		console.error(error?.stack || error);
	} catch (_) {}
});
process.on("uncaughtException", (error) => {
	try {
		console.error(`[uncaughtException] ${new Date().toISOString()}`);
		console.error(error?.stack || error);
	} catch (_) {}
});

const axios = require("axios");
const fs = require("fs-extra");
const google = require("googleapis").google;
const nodemailer = require("nodemailer");
const express = require("express");
const crypto = require("crypto");
const app = express();
const { execSync } = require("child_process");
const log = require("./logger/log.js");
const path = require("path");

process.env.BLUEBIRD_W_FORGOTTEN_RETURN = 0;

// ———————————————— JSON VALIDATOR ———————————————— //
function validJSON(pathDir) {
	try {
		if (!fs.existsSync(pathDir)) throw new Error(`File "${pathDir}" not found`);
		execSync(`npx jsonlint "${pathDir}"`, { stdio: "pipe", timeout: 30000 });
		return true;
	} catch (err) {
		let msgError = err.message;
		msgError = msgError.split("\n").slice(1).join("\n");
		const indexPos = msgError.indexOf("    at");
		msgError = msgError.slice(0, indexPos !== -1 ? indexPos - 1 : msgError.length);
		throw new Error(msgError);
	}
}

const { NODE_ENV } = process.env;
const dirConfig = path.normalize(`${__dirname}/config.json`);
const dirConfigCommands = path.normalize(`${__dirname}/configCommands.json`);
const dirAccount = path.normalize(`${__dirname}/account.txt`);

for (const pathDir of [dirConfig, dirConfigCommands]) {
	try {
		validJSON(pathDir);
	} catch (err) {
		log.error(
			"CONFIG",
			`Invalid JSON file "${pathDir.replace(__dirname, "")}":\n${err.message
				.split("\n")
				.map((line) => `  ${line}`)
				.join("\n")}\nPlease fix it and restart bot`
		);
		process.exit(0);
	}
}

const config = require(dirConfig);
if (config.whiteListMode?.whiteListIds && Array.isArray(config.whiteListMode.whiteListIds)) {
	config.whiteListMode.whiteListIds = config.whiteListMode.whiteListIds.map((id) => id.toString());
}
const configCommands = require(dirConfigCommands);

// ———————————————— GLOBAL STATE ———————————————— //
global.GoatBot = {
	startTime: Date.now() - process.uptime() * 1000,
	commands: new Map(),
	eventCommands: new Map(),
	commandFilesPath: [],
	eventCommandsFilesPath: [],
	aliases: new Map(),
	onFirstChat: [],
	onChat: [],
	onEvent: [],
	onReply: new Map(),
	onReaction: new Map(),
	onAnyEvent: [],
	config,
	configCommands,
	envCommands: {},
	envEvents: {},
	envGlobal: {},
	reLoginBot: function () {},
	Listening: null,
	oldListening: [],
	callbackListenTime: {},
	storage5Message: [],
	fcaApi: null,
	botID: null
};

global.db = {
	allThreadData: [],
	allUserData: [],
	allDashBoardData: [],
	allGlobalData: [],
	threadModel: null,
	userModel: null,
	dashboardModel: null,
	globalModel: null,
	threadsData: null,
	usersData: null,
	dashBoardData: null,
	globalData: null,
	receivedTheFirstMessage: {}
};

global.client = {
	dirConfig,
	dirConfigCommands,
	dirAccount,
	countDown: {},
	cache: {},
	database: {
		creatingThreadData: [],
		creatingUserData: [],
		creatingDashBoardData: [],
		creatingGlobalData: []
	},
	commandBanned: configCommands.commandBanned
};

const utils = require("./utils.js");
global.utils = utils;
const { colors } = utils;

global.temp = {
	createThreadData: [],
	createUserData: [],
	createThreadDataError: [],
	filesOfGoogleDrive: { arraybuffer: {}, stream: {}, fileNames: {} },
	contentScripts: { cmds: {}, events: {} }
};

// ———————————————— CONFIG WATCHER (fixed) ———————————————— //
const watchAndReloadConfig = (dir, type, prop, logName) => {
	let lastModified = fs.statSync(dir).mtimeMs;
	let isFirstModified = true;
	let pending = null;

	const reload = () => {
		const oldConfig = global.GoatBot[prop];
		try {
			if (isFirstModified) {
				isFirstModified = false;
				return;
			}
			const newMtime = fs.statSync(dir).mtimeMs;
			if (lastModified === newMtime) return;

			const raw = fs.readFileSync(dir, "utf-8");
			const parsed = JSON.parse(raw); // validate before assign
			global.GoatBot[prop] = parsed;
			lastModified = newMtime;
			log.success(logName, `Reloaded ${dir.replace(process.cwd(), "")}`);
		} catch (err) {
			log.warn(logName, `Can't reload ${dir.replace(process.cwd(), "")}: ${err.message}`);
			global.GoatBot[prop] = oldConfig;
		}
	};

	fs.watch(dir, (eventType) => {
		if (!["change", "rename"].includes(eventType)) return;
		if (pending) clearTimeout(pending);
		pending = setTimeout(() => {
			pending = null;
			reload();
		}, 250);
	});
};

watchAndReloadConfig(dirConfigCommands, "change", "configCommands", "CONFIG COMMANDS");
watchAndReloadConfig(dirConfig, "change", "config", "CONFIG");

global.GoatBot.envGlobal = global.GoatBot.configCommands.envGlobal;
global.GoatBot.envCommands = global.GoatBot.configCommands.envCommands;
global.GoatBot.envEvents = global.GoatBot.configCommands.envEvents;

// ———————————————— LOAD LANGUAGE ———————————————— //
const getText = global.utils.getText;

// ———————————————— AUTO RESTART ———————————————— //
if (config.autoRestart) {
	const time = config.autoRestart.time;
	if (!isNaN(time) && time > 0) {
		utils.log.info("AUTO RESTART", getText("Goat", "autoRestart1", utils.convertTime(time, true)));
		setTimeout(() => {
			utils.log.info("AUTO RESTART", "Restarting...");
			process.exit(2);
		}, time).unref?.();
	} else if (
		typeof time === "string" &&
		time.match(/^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})$/gim)
	) {
		utils.log.info("AUTO RESTART", getText("Goat", "autoRestart2", time));
		const cron = require("node-cron");
		cron.schedule(time, () => {
			utils.log.info("AUTO RESTART", "Restarting...");
			process.exit(2);
		});
	}
}

// ———————————————— BOOTSTRAP ———————————————— //
(async () => {
	try {
		// ——— SETUP MAIL (optional, bot runs without it) ——— //
		const { gmailAccount = {} } = config.credentials || {};
		const { email, clientId, clientSecret, refreshToken } = gmailAccount;

		if (email && clientId && clientSecret && refreshToken) {
			try {
				const OAuth2 = google.auth.OAuth2;
				const OAuth2_client = new OAuth2(clientId, clientSecret);
				OAuth2_client.setCredentials({ refresh_token: refreshToken });
				const { token: accessToken } = await OAuth2_client.getAccessToken();

				const transporter = nodemailer.createTransport({
					host: "smtp.gmail.com",
					service: "Gmail",
					auth: { type: "OAuth2", user: email, clientId, clientSecret, refreshToken, accessToken }
				});

				async function sendMail({ to, subject, text, html, attachments }) {
					const info = await transporter.sendMail({
						from: email,
						to,
						subject,
						text,
						html,
						attachments
					});
					return info;
				}

				global.utils.sendMail = sendMail;
				global.utils.transporter = transporter;
				log.info("MAIL", "Mail transporter ready.");
			} catch (err) {
				log.warn("MAIL", `Mail setup skipped: ${err.message}`);
			}
		} else {
			log.warn("MAIL", "Gmail credentials not configured — mail features disabled.");
		}

		// ——— CHECK NEW VERSION (from Maruf-bot repo) ——— //
		try {
			const { data } = await axios.get(
				"https://raw.githubusercontent.com/maruf127679-pixel/Maruf-bot/main/package.json",
				{ timeout: 15000 }
			);
			const remoteVersion = data.version;
			const currentVersion = require("./package.json").version;
			if (compareVersion(remoteVersion, currentVersion) === 1) {
				utils.log.master(
					"NEW VERSION",
					getText(
						"Goat",
						"newVersionDetected",
						colors.gray(currentVersion),
						colors.hex("#eb6a07", remoteVersion),
						colors.hex("#eb6a07", "npm run update")
					)
				);
			}
		} catch (err) {
			log.warn("VERSION", `Can't check new version: ${err.message}`);
		}

		// ——— GOOGLE DRIVE FOLDER (non-fatal) ——— //
		try {
			const parentIdGoogleDrive = await utils.drive.checkAndCreateParentFolder("GoatBot");
			utils.drive.parentID = parentIdGoogleDrive;
		} catch (err) {
			log.warn("GOOGLE DRIVE", `Can't init Drive folder: ${err.message}`);
		}

		// ——— LOGIN ——— //
		require(`./bot/login/login${NODE_ENV === "development" ? ".dev.js" : ".js"}`);
	} catch (err) {
		log.error("BOOT", err?.stack || err?.message || String(err));
		process.exit(1);
	}
})();

// ———————————————— VERSION COMPARE ———————————————— //
function compareVersion(version1, version2) {
	const v1 = String(version1 || "").split(".").map((n) => parseInt(n) || 0);
	const v2 = String(version2 || "").split(".").map((n) => parseInt(n) || 0);
	const len = Math.max(v1.length, v2.length, 3);
	for (let i = 0; i < len; i++) {
		const a = v1[i] || 0;
		const b = v2[i] || 0;
		if (a > b) return 1;
		if (a < b) return -1;
	}
	return 0;
}

// ———————————————— EXPRESS HARDENING ———————————————— //

// security headers (minimal, no extra dependency)
app.use((req, res, next) => {
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("X-Frame-Options", "DENY");
	res.setHeader("Referrer-Policy", "no-referrer");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET,POST");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Api-Key");
	next();
});

// body parser with size limit (1MB is plenty for appstate JSON)
app.use(express.json({ limit: "1mb" }));

// simple in-memory rate limiter for /api/*
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function rateLimiter(req, res, next) {
	const ip = req.ip || req.connection?.remoteAddress || "unknown";
	const now = Date.now();
	const entry = rateLimitMap.get(ip) || { count: 0, reset: now + RATE_WINDOW_MS };
	if (now > entry.reset) {
		entry.count = 0;
		entry.reset = now + RATE_WINDOW_MS;
	}
	entry.count++;
	rateLimitMap.set(ip, entry);
	if (entry.count > RATE_MAX) {
		return res.status(429).json({ error: "Too many requests. Try again later." });
	}
	// cleanup occasionally
	if (rateLimitMap.size > 1000) {
		for (const [k, v] of rateLimitMap) {
			if (now > v.reset) rateLimitMap.delete(k);
		}
	}
	next();
}

// ———————————————— ROUTES ———————————————— //

app.get("/", (req, res) => {
	res.send("Maruf Bot is running ✅");
});

app.get("/health", (req, res) => {
	res.status(global.statusAccountBot === "block spam" ? 503 : 200).json({
		status: global.statusAccountBot === "block spam" ? "blocked" : "ok",
		uptime: Math.floor(process.uptime()),
		startTime: global.GoatBot.startTime,
		version: require("./package.json").version,
		botID: global.GoatBot.botID || null
	});
});

app.get("/uptime", (req, res) => {
	res.send(String(process.uptime()));
});

// API key for /api/appstate — set via env APSTATE_API_KEY
const APPSTATE_API_KEY = process.env.APPSTATE_API_KEY || "";

app.post("/api/appstate", rateLimiter, async (req, res) => {
	// auth check (only if API key is configured)
	if (APPSTATE_API_KEY) {
		const provided = req.headers["x-api-key"] || req.query.key;
		if (provided !== APPSTATE_API_KEY) {
			return res.status(401).json({ error: "Unauthorized" });
		}
	}

	const { appstate } = req.body || {};
	if (!appstate) {
		return res.status(400).json({ error: "Appstate is required" });
	}

	let appstateStr;
	if (typeof appstate === "string") {
		appstateStr = appstate;
	} else if (typeof appstate === "object") {
		appstateStr = JSON.stringify(appstate);
	} else {
		return res.status(400).json({ error: "Appstate must be a JSON string or object" });
	}

	// validate it's actually an array of cookies
	try {
		const parsed = JSON.parse(appstateStr);
		if (!Array.isArray(parsed) || parsed.length === 0) {
			return res.status(400).json({ error: "Appstate must be a non-empty array" });
		}
		if (!parsed.every((c) => c && typeof c === "object" && c.key && c.value)) {
			return res.status(400).json({ error: "Each appstate item must have key & value" });
		}
	} catch {
		return res.status(400).json({ error: "Invalid JSON in appstate" });
	}

	// atomic write: write to .tmp then rename
	const tmpPath = `${dirAccount}.tmp-${Date.now()}`;
	try {
		await fs.writeFile(tmpPath, appstateStr);
		await fs.move(tmpPath, dirAccount, { overwrite: true });
	} catch (err) {
		try { await fs.remove(tmpPath); } catch (_) {}
		console.error("Error saving appstate:", err);
		return res.status(500).json({ error: "Failed to save appstate" });
	}

	res.json({ success: true, message: "Appstate saved. Restarting..." });

	log.info("APPSTATE", "Updated via API. Restarting bot in 1s...");
	setTimeout(() => process.exit(2), 1000);
});

// 404 handler
app.use((req, res) => {
	res.status(404).json({ error: "Not found" });
});

// error handler
app.use((err, req, res, _next) => {
	console.error("Express error:", err);
	res.status(500).json({ error: "Internal server error" });
});

// ———————————————— RENDER / PORT ———————————————— //
const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
	log.info("WEB", `Web server listening on http://${HOST}:${PORT}`);
});

server.on("error", (err) => {
	if (err.code === "EADDRINUSE") {
		log.error("WEB", `Port ${PORT} is already in use.`);
	} else {
		log.error("WEB", `Server error: ${err.message}`);
	}
});

// graceful shutdown
function gracefulShutdown(signal) {
	log.info("WEB", `Received ${signal} — closing server...`);
	server.close(() => {
		log.info("WEB", "Server closed.");
		process.exit(0);
	});
	setTimeout(() => process.exit(0), 5000).unref?.();
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
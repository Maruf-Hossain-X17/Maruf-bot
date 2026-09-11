/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 *
 * English:
 * ! Please do not change the below code, it is very important for the project.
 * It is my motivation to maintain and develop the project for free.
 * ! If you change it, you will be banned forever
 * Thank you for using
 *
 * Vietnamese:
 * ! Vui lòng không thay đổi mã bên dưới, nó rất quan trọng đối với dự án.
 * Nó là động lực để tôi duy trì và phát triển dự án miễn phí.
 * ! Nếu thay đổi nó, bạn sẽ bị cấm vĩnh viễn
 * Cảm ơn bạn đã sử dụng
 *
 * --------------------------------------------------------------------------
 * Launcher enhanced by Maruf (bug-fix + crash recovery)
 * Original author credit preserved as required by license.
 * --------------------------------------------------------------------------
 */

const { spawn } = require("child_process");
const log = require("./logger/log.js");

// ============ CONFIG (override via env) ============
const ENTRY_FILE = process.env.ENTRY_FILE || "Goat.js";
const MAX_RESTARTS = Number(process.env.MAX_RESTARTS || 10);
const BASE_DELAY_MS = Number(process.env.RESTART_DELAY || 1000);
const MAX_DELAY_MS = 30000;
const STABLE_RUN_MS = 60000; // bot running > this => consider healthy, reset counter
const NODE_ARGS = process.env.NODE_ARGS ? process.env.NODE_ARGS.split(" ").filter(Boolean) : [];

let restartCount = 0;
let child = null;
let shuttingDown = false;
let lastStartTime = 0;

function formatTime() {
	return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function tsLog(level, msg) {
	const prefix = `[${formatTime()}]`;
	if (typeof log?.[level] === "function") {
		log[level]("LAUNCHER", `${prefix} ${msg}`);
	} else {
		console[level === "err" ? "error" : "log"](`${prefix} [${level.toUpperCase()}] ${msg}`);
	}
}

function getBackoffDelay(attempt) {
	const delay = Math.min(BASE_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1)), MAX_DELAY_MS);
	// jitter ±20% to avoid thundering herd
	const jitter = delay * (0.8 + Math.random() * 0.4);
	return Math.floor(jitter);
}

function startProject() {
	if (shuttingDown) return;

	lastStartTime = Date.now();
	tsLog("info", `Starting ${ENTRY_FILE} (attempt #${restartCount + 1})...`);

	try {
		child = spawn(process.execPath, [...NODE_ARGS, ENTRY_FILE], {
			cwd: __dirname,
			stdio: "inherit",
			env: { ...process.env, FORCE_COLOR: "1" }
			// NOTE: shell:true removed — security + cross-platform safety
		});
	} catch (err) {
		tsLog("err", `Failed to spawn Node process: ${err.message}`);
		return scheduleRestart();
	}

	child.on("error", (err) => {
		tsLog("err", `Child process error: ${err.message}`);
	});

	child.on("close", (code, signal) => {
		child = null;
		if (shuttingDown) {
			tsLog("info", "Child process stopped (shutdown requested).");
			return;
		}

		const runtime = Date.now() - lastStartTime;
		tsLog("info", `Child exited — code=${code} signal=${signal || "none"} runtime=${Math.floor(runtime / 1000)}s`);

		// if it ran healthy long enough, reset counter
		if (runtime >= STABLE_RUN_MS) {
			restartCount = 0;
			tsLog("info", "Bot ran stably — restart counter reset.");
		}

		// treat any non-zero code OR signal-based kill as crash
		if (code === 0 && !signal) {
			tsLog("info", "Clean exit (code 0). Not restarting.");
			return;
		}

		scheduleRestart(code, signal);
	});
}

function scheduleRestart(code, signal) {
	if (shuttingDown) return;

	if (restartCount >= MAX_RESTARTS) {
		tsLog("err", `Max restarts (${MAX_RESTARTS}) reached. Giving up. Last exit: code=${code} signal=${signal || "none"}`);
		process.exit(1);
	}

	restartCount++;
	const delay = getBackoffDelay(restartCount);
	tsLog("info", `Restarting in ${(delay / 1000).toFixed(1)}s... (${restartCount}/${MAX_RESTARTS})`);

	setTimeout(() => {
		if (!shuttingDown) startProject();
	}, delay).unref?.();
}

// ============ GRACEFUL SHUTDOWN ============

function shutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;
	tsLog("info", `Received ${signal} — shutting down gracefully...`);

	if (child && !child.killed) {
		try {
			// try graceful first (SIGTERM), force kill after 5s
			child.kill("SIGTERM");
			setTimeout(() => {
				if (child && !child.killed) {
					tsLog("info", "Force killing child process...");
					child.kill("SIGKILL");
				}
			}, 5000).unref?.();
		} catch (err) {
			tsLog("err", `Failed to kill child: ${err.message}`);
		}
	} else {
		process.exit(0);
	}

	// hard exit fallback
	setTimeout(() => process.exit(0), 6000).unref?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

// safety net — don't let launcher itself crash silently
process.on("uncaughtException", (err) => {
	tsLog("err", `Launcher uncaughtException: ${err.stack || err.message}`);
});
process.on("unhandledRejection", (reason) => {
	tsLog("err", `Launcher unhandledRejection: ${reason}`);
});

// ============ GO ============
startProject();
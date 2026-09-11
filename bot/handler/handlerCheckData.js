/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * --------------------------------------------------------------------------
 * handlerCheckData enhanced by Maruf — non-blocking DB, fast timeout, memory safe
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log, getText } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

// ————— tuning —————
const CREATE_TIMEOUT_MS = 15_000;        // ⬇️ 30s → 15s (Facebook slow হলে দ্রুত fail)
const ERROR_CACHE_MAX = 5_000;
const ERROR_CACHE_TTL_MS = 10 * 60_000;  // 10 min (আগে ছিল 30 min — দ্রুত retry)

// internal error cache with timestamps
const errorCache = new Map();

function markError(id) {
	errorCache.set(String(id), Date.now());
	if (errorCache.size > ERROR_CACHE_MAX) {
		const oldest = errorCache.keys().next().value;
		errorCache.delete(oldest);
	}
}

function hasError(id) {
	const key = String(id);
	if (!errorCache.has(key)) return false;
	if (Date.now() - errorCache.get(key) > ERROR_CACHE_TTL_MS) {
		errorCache.delete(key);
		return false;
	}
	return true;
}

function isValidId(id) {
	return id !== undefined && id !== null && id !== "" && !isNaN(Number(id));
}

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
		)
	]);
}

// ————— NON-BLOCKING thread ensure —————
function ensureThreadBackground(threadsData, threadID) {
	if (hasError(threadID)) return;
	if (db.allThreadData.some((t) => String(t.threadID) === String(threadID))) return;

	const existing = creatingThreadData.find((t) => String(t.threadID) === String(threadID));
	if (existing) return; // already being created

	// Register lock SYNCHRONOUSLY
	let resolveLock, rejectLock;
	const lockPromise = new Promise((res, rej) => {
		resolveLock = res;
		rejectLock = rej;
	});
	const entry = { threadID, promise: lockPromise };
	creatingThreadData.push(entry);

	// Fire-and-forget — DO NOT await here!
	(async () => {
		try {
			const threadData = await withTimeout(
				threadsData.create(threadID),
				CREATE_TIMEOUT_MS,
				`createThread(${threadID})`
			);
			log.info(
				"DATABASE",
				`New Thread: ${threadID} | ${threadData?.threadName || "unknown"} | ${config.database.type}`
			);
			resolveLock(threadData);
		} catch (err) {
			if (err?.name === "DATA_ALREADY_EXISTS") {
				resolveLock();
			} else {
				rejectLock(err);
				markError(threadID);
				log.err(
					"DATABASE",
					`Groups with id '${threadID}' cannot be written to the database!`,
					err?.message || err
				);
			}
		} finally {
			const idx = creatingThreadData.indexOf(entry);
			if (idx !== -1) creatingThreadData.splice(idx, 1);
		}
	})();
}

// ————— NON-BLOCKING user ensure —————
function ensureUserBackground(usersData, senderID) {
	if (hasError(senderID)) return;
	if (db.allUserData.some((u) => String(u.userID) === String(senderID))) return;

	const existing = creatingUserData.find((u) => String(u.userID) === String(senderID));
	if (existing) return;

	let resolveLock, rejectLock;
	const lockPromise = new Promise((res, rej) => {
		resolveLock = res;
		rejectLock = rej;
	});
	const entry = { userID: senderID, promise: lockPromise };
	creatingUserData.push(entry);

	// Fire-and-forget
	(async () => {
		try {
			const userData = await withTimeout(
				usersData.create(senderID),
				CREATE_TIMEOUT_MS,
				`createUser(${senderID})`
			);
			log.info(
				"DATABASE",
				`New User: ${senderID} | ${userData?.name || "unknown"} | ${config.database.type}`
			);
			resolveLock(userData);
		} catch (err) {
			if (err?.name === "DATA_ALREADY_EXISTS") {
				resolveLock();
			} else {
				rejectLock(err);
				markError(senderID);
				log.err(
					"DATABASE",
					`Users with id '${senderID}' cannot be written to the database!`,
					err?.message || err
				);
			}
		} finally {
			const idx = creatingUserData.indexOf(entry);
			if (idx !== -1) creatingUserData.splice(idx, 1);
		}
	})();
}

// ————— MAIN —————
module.exports = async function (usersData, threadsData, event) {
	if (!event || typeof event !== "object") return;

	const { threadID } = event;
	const senderID = event.senderID || event.author || event.userID;

	// ⚡ NON-BLOCKING: kick off DB writes in background, don't await them!
	// This means the message handler will NOT wait for Facebook API calls.
	// If a thread/user is new, they'll be created within a few seconds.
	// Meanwhile, the bot still processes the message.

	if (isValidId(threadID)) {
		try { ensureThreadBackground(threadsData, threadID); } catch (_) {}
	}

	if (isValidId(senderID) && String(senderID) !== String(threadID)) {
		try { ensureUserBackground(usersData, senderID); } catch (_) {}
	} else if (isValidId(senderID) && String(senderID) === String(threadID)) {
		try { ensureUserBackground(usersData, senderID); } catch (_) {}
	}

	// Return immediately — do NOT wait
	return;
};

// ————— exports for debugging —————
module.exports.resetErrorCache = (id) => {
	if (id === undefined) errorCache.clear();
	else errorCache.delete(String(id));
};
module.exports.getErrorCache = () => Object.fromEntries(errorCache);
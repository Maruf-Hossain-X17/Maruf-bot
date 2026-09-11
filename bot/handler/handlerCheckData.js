/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * --------------------------------------------------------------------------
 * handlerCheckData enhanced by Maruf — fully non-blocking, no unhandled rejection
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log, getText } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

// ————— tuning —————
const CREATE_TIMEOUT_MS = 45_000;        // ⬆️ 15s → 45s (FB API slow, patience দরকার)
const RETRY_AFTER_MS = 60_000;            // fail হলে ৬০ সেকেন্ড পর retry
const ERROR_CACHE_MAX = 5_000;

const errorCache = new Map(); // id -> timestamp
const retryQueue = new Map(); // id -> timer

function markError(id) {
	errorCache.set(String(id), Date.now());
	if (errorCache.size > ERROR_CACHE_MAX) {
		const oldest = errorCache.keys().next().value;
		errorCache.delete(oldest);
	}
}

function hasRecentError(id) {
	const t = errorCache.get(String(id));
	if (!t) return false;
	return Date.now() - t < RETRY_AFTER_MS;
}

function isValidId(id) {
	return id !== undefined && id !== null && id !== "" && !isNaN(Number(id));
}

function withTimeout(promise, ms, label) {
	let timer;
	return Promise.race([
		promise.finally(() => clearTimeout(timer)),
		new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		})
	]);
}

// ————— NON-BLOCKING thread ensure —————
function ensureThreadBackground(threadsData, threadID, event) {
	if (hasRecentError(threadID)) return;
	if (db.allThreadData.some((t) => String(t.threadID) === String(threadID))) return;

	const existing = creatingThreadData.find((t) => String(t.threadID) === String(threadID));
	if (existing) return;

	// Build info from event so we don't need FB API call
	const eventInfo = event ? {
		threadName: event.threadName || undefined,
		isGroup: event.isGroup,
		participantIDs: Array.isArray(event.participantIDs) ? event.participantIDs : undefined,
		adminIDs: Array.isArray(event.adminIDs) ? event.adminIDs : undefined,
		imageSrc: event.imageSrc,
		emoji: event.emoji,
		color: event.color
	} : undefined;

	let resolveLock;
	const lockPromise = new Promise((res) => { resolveLock = res; });
	// FIX: attach catch to prevent unhandled rejection
	lockPromise.catch(() => {});

	const entry = { threadID, promise: lockPromise };
	creatingThreadData.push(entry);

	(async () => {
		try {
			const threadData = await withTimeout(
				threadsData.create(threadID, eventInfo),
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
				return;
			}
			// Silent error — non-critical, retry later
			markError(threadID);
			// only log once per thread per 60s
			if (!retryQueue.has(String(threadID))) {
				log.warn?.("DATABASE", `Thread ${threadID} create failed — will retry in 60s`);
				const timer = setTimeout(() => {
					retryQueue.delete(String(threadID));
					errorCache.delete(String(threadID));
				}, RETRY_AFTER_MS);
				if (timer.unref) timer.unref();
				retryQueue.set(String(threadID), timer);
			}
			resolveLock(null);
		} finally {
			const idx = creatingThreadData.indexOf(entry);
			if (idx !== -1) creatingThreadData.splice(idx, 1);
		}
	})();
}

// ————— NON-BLOCKING user ensure —————
function ensureUserBackground(usersData, senderID, event) {
	if (hasRecentError(senderID)) return;
	if (db.allUserData.some((u) => String(u.userID) === String(senderID))) return;

	const existing = creatingUserData.find((u) => String(u.userID) === String(senderID));
	if (existing) return;

	// Info from event (avoid FB API call)
	const eventInfo = event ? {
		name: event.senderName || undefined,
		gender: undefined
	} : undefined;

	let resolveLock;
	const lockPromise = new Promise((res) => { resolveLock = res; });
	lockPromise.catch(() => {}); // prevent unhandled rejection

	const entry = { userID: senderID, promise: lockPromise };
	creatingUserData.push(entry);

	(async () => {
		try {
			const userData = await withTimeout(
				usersData.create(senderID, eventInfo),
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
				return;
			}
			markError(senderID);
			if (!retryQueue.has(String(senderID))) {
				log.warn?.("DATABASE", `User ${senderID} create failed — will retry in 60s`);
				const timer = setTimeout(() => {
					retryQueue.delete(String(senderID));
					errorCache.delete(String(senderID));
				}, RETRY_AFTER_MS);
				if (timer.unref) timer.unref();
				retryQueue.set(String(senderID), timer);
			}
			resolveLock(null);
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

	// Fire-and-forget — no await, no blocking, no unhandled rejection
	if (isValidId(threadID)) {
		try { ensureThreadBackground(threadsData, threadID, event); } catch (_) {}
	}

	if (isValidId(senderID)) {
		try { ensureUserBackground(usersData, senderID, event); } catch (_) {}
	}

	return;
};

// ————— debug helpers —————
module.exports.resetErrorCache = (id) => {
	if (id === undefined) errorCache.clear();
	else errorCache.delete(String(id));
};
module.exports.getErrorCache = () => Object.fromEntries(errorCache);
/**
 * @author NTKhang
 * Enhanced by Maruf — no FB API blocking, real error logging
 * Original author credit preserved as required by MIT license.
 */

const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

// ————— tuning —————
const CREATE_TIMEOUT_MS = 20_000;       // 20s max
const RETRY_AFTER_MS = 120_000;         // 2 min retry window
const ERROR_CACHE_MAX = 5_000;

const errorCache = new Map();

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
		Promise.resolve(promise).finally(() => clearTimeout(timer)),
		new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		})
	]);
}

// ————— thread create (non-blocking, FB-API-free when possible) —————
function ensureThreadBackground(threadsData, threadID, event) {
	if (hasRecentError(threadID)) return;
	if (db.allThreadData.some((t) => String(t.threadID) === String(threadID))) return;
	if (creatingThreadData.some((t) => String(t.threadID) === String(threadID))) return;

	// Build thread info from event — this avoids FB API call inside create()
	const eventInfo = event ? {
		threadID: String(threadID),
		threadName: event.threadName || "Unknown Group",
		isGroup: event.isGroup || false,
		participantIDs: Array.isArray(event.participantIDs) ? event.participantIDs.map(String) : [],
		adminIDs: Array.isArray(event.adminIDs) ? event.adminIDs.map(String) : [],
		members: Array.isArray(event.participantIDs)
			? event.participantIDs.map(id => ({ userID: String(id), inGroup: true }))
			: [],
		imageSrc: event.imageSrc || undefined,
		emoji: event.emoji || undefined,
		color: event.color || undefined
	} : undefined;

	let resolveLock;
	const lockPromise = new Promise((res) => { resolveLock = res; });
	lockPromise.catch(() => {});

	const entry = { threadID, promise: lockPromise };
	creatingThreadData.push(entry);

	// Fire and forget
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
			markError(threadID);
			log.err(
				"DATABASE",
				`Thread ${threadID} create failed: ${err?.name || "Error"}: ${err?.message || err}`
			);
			console.error("[DB THREAD ERROR]", {
				threadID,
				name: err?.name,
				message: err?.message,
				stack: (err?.stack || "").split("\n").slice(0, 3).join("\n")
			});
			resolveLock(null);
		} finally {
			const idx = creatingThreadData.indexOf(entry);
			if (idx !== -1) creatingThreadData.splice(idx, 1);
		}
	})();
}

// ————— user create —————
function ensureUserBackground(usersData, senderID, event) {
	if (hasRecentError(senderID)) return;
	if (db.allUserData.some((u) => String(u.userID) === String(senderID))) return;
	if (creatingUserData.some((u) => String(u.userID) === String(senderID))) return;

	const eventInfo = event ? {
		userID: String(senderID),
		name: event.senderName || "Facebook User",
		gender: 0,
		banned: { status: false, reason: null, date: null },
		settings: {},
		data: { exp: 0, money: 0, level: 0, rank: 0 }
	} : undefined;

	let resolveLock;
	const lockPromise = new Promise((res) => { resolveLock = res; });
	lockPromise.catch(() => {});

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
			log.err(
				"DATABASE",
				`User ${senderID} create failed: ${err?.name || "Error"}: ${err?.message || err}`
			);
			console.error("[DB USER ERROR]", {
				senderID,
				name: err?.name,
				message: err?.message,
				stack: (err?.stack || "").split("\n").slice(0, 3).join("\n")
			});
			resolveLock(null);
		} finally {
			const idx = creatingUserData.indexOf(entry);
			if (idx !== -1) creatingUserData.splice(idx, 1);
		}
	})();
}

// ————— main —————
module.exports = async function (usersData, threadsData, event) {
	if (!event || typeof event !== "object") return;

	const { threadID } = event;
	const senderID = event.senderID || event.author || event.userID;

	// Kick off DB writes in background — DO NOT AWAIT.
	if (isValidId(threadID)) {
		try { ensureThreadBackground(threadsData, threadID, event); }
		catch (e) { console.error("[CHECK THREAD]", e.message); }
	}

	if (isValidId(senderID) && String(senderID) !== String(threadID)) {
		try { ensureUserBackground(usersData, senderID, event); }
		catch (e) { console.error("[CHECK USER]", e.message); }
	} else if (isValidId(senderID)) {
		try { ensureUserBackground(usersData, senderID, event); }
		catch (e) { console.error("[CHECK USER]", e.message); }
	}

	return;
};

// debug helpers
module.exports.resetErrorCache = (id) => {
	if (id === undefined) errorCache.clear();
	else errorCache.delete(String(id));
};
module.exports.getErrorCache = () => Object.fromEntries(errorCache);
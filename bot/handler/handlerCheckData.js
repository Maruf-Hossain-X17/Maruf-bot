/**
 * @author NTKhang
 * Enhanced by Maruf — logs real errors, no unhandled rejection
 */

const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

const CREATE_TIMEOUT_MS = 60_000;
const RETRY_AFTER_MS = 120_000;
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
		promise.finally(() => clearTimeout(timer)),
		new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		})
	]);
}

// ————— thread —————
function ensureThreadBackground(threadsData, threadID, event) {
	if (hasRecentError(threadID)) return;
	if (db.allThreadData.some((t) => String(t.threadID) === String(threadID))) return;
	if (creatingThreadData.some((t) => String(t.threadID) === String(threadID))) return;

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
			markError(threadID);
			// ✅ LOG THE REAL ERROR
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

// ————— user —————
function ensureUserBackground(usersData, senderID, event) {
	if (hasRecentError(senderID)) return;
	if (db.allUserData.some((u) => String(u.userID) === String(senderID))) return;
	if (creatingUserData.some((u) => String(u.userID) === String(senderID))) return;

	const eventInfo = event ? {
		name: event.senderName || undefined
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

	if (isValidId(threadID)) {
		try { ensureThreadBackground(threadsData, threadID, event); } catch (e) { console.error("[CHECK THREAD]", e.message); }
	}
	if (isValidId(senderID)) {
		try { ensureUserBackground(usersData, senderID, event); } catch (e) { console.error("[CHECK USER]", e.message); }
	}
	return;
};

module.exports.resetErrorCache = (id) => {
	if (id === undefined) errorCache.clear();
	else errorCache.delete(String(id));
};
module.exports.getErrorCache = () => Object.fromEntries(errorCache);
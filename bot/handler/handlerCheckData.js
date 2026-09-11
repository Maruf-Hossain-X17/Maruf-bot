/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * --------------------------------------------------------------------------
 * handlerCheckData enhanced by Maruf — race-safe, timeout, memory-bounded
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log, getText } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

// ————— config —————
const CREATE_TIMEOUT_MS = 30_000;    // max wait for a create() call
const ERROR_CACHE_MAX = 5_000;       // cap on createThreadDataError list
const ERROR_CACHE_TTL_MS = 30 * 60_000; // retry after 30 minutes

// internal error cache with timestamps (bounded)
const errorCache = new Map(); // id -> timestamp

function markError(id) {
	errorCache.set(String(id), Date.now());
	// hard cap
	if (errorCache.size > ERROR_CACHE_MAX) {
		// remove oldest entry
		const oldest = errorCache.keys().next().value;
		errorCache.delete(oldest);
	}
}

function hasError(id) {
	const key = String(id);
	if (!errorCache.has(key)) return false;
	// TTL check
	if (Date.now() - errorCache.get(key) > ERROR_CACHE_TTL_MS) {
		errorCache.delete(key);
		return false;
	}
	return true;
}

// ————— utils —————
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

// ————— thread ensure —————
async function ensureThread(threadsData, threadID) {
	if (hasError(threadID)) return;

	// already in memory
	if (db.allThreadData.some((t) => String(t.threadID) === String(threadID))) return;

	// already creating — wait for existing
	const existing = creatingThreadData.find((t) => String(t.threadID) === String(threadID));
	if (existing) {
		try {
			await withTimeout(existing.promise, CREATE_TIMEOUT_MS, `createThread(${threadID})`);
		} catch (err) {
			// don't mark error — another caller owns the promise and will handle it
		}
		return;
	}

	// create with a lock
	let resolveLock, rejectLock;
	const lockPromise = new Promise((res, rej) => {
		resolveLock = res;
		rejectLock = rej;
	});
	const entry = { threadID, promise: lockPromise };
	creatingThreadData.push(entry);

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
				getText("handlerCheckData", "cantCreateThread", threadID),
				err?.stack || err?.message || err
			);
		}
	} finally {
		const idx = creatingThreadData.indexOf(entry);
		if (idx !== -1) creatingThreadData.splice(idx, 1);
	}
}

// ————— user ensure —————
async function ensureUser(usersData, senderID) {
	if (hasError(senderID)) return;

	if (db.allUserData.some((u) => String(u.userID) === String(senderID))) return;

	const existing = creatingUserData.find((u) => String(u.userID) === String(senderID));
	if (existing) {
		try {
			await withTimeout(existing.promise, CREATE_TIMEOUT_MS, `createUser(${senderID})`);
		} catch (_) {}
		return;
	}

	let resolveLock, rejectLock;
	const lockPromise = new Promise((res, rej) => {
		resolveLock = res;
		rejectLock = rej;
	});
	const entry = { userID: senderID, promise: lockPromise };
	creatingUserData.push(entry);

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
				getText("handlerCheckData", "cantCreateUser", senderID),
				err?.stack || err?.message || err
			);
		}
	} finally {
		const idx = creatingUserData.indexOf(entry);
		if (idx !== -1) creatingUserData.splice(idx, 1);
	}
}

// ————— main —————
module.exports = async function (usersData, threadsData, event) {
	if (!event || typeof event !== "object") return;

	const { threadID } = event;
	const senderID = event.senderID || event.author || event.userID;

	// run thread + user creation in parallel for speed
	const tasks = [];

	if (isValidId(threadID)) {
		tasks.push(ensureThread(threadsData, threadID).catch(() => {}));
	}

	// avoid double-create when threadID == senderID (self-chat)
	if (isValidId(senderID) && String(senderID) !== String(threadID)) {
		tasks.push(ensureUser(usersData, senderID).catch(() => {}));
	} else if (isValidId(senderID) && String(senderID) === String(threadID)) {
		// self-chat: thread + user same id, only create user once
		tasks.push(ensureUser(usersData, senderID).catch(() => {}));
	}

	await Promise.all(tasks);
};

// ————— exports for debugging / admin commands —————
module.exports.resetErrorCache = (id) => {
	if (id === undefined) errorCache.clear();
	else errorCache.delete(String(id));
};
module.exports.getErrorCache = () => Object.fromEntries(errorCache);
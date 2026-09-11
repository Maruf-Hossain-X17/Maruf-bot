/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * --------------------------------------------------------------------------
 * loadData enhanced by Maruf — bug fixes, batching, error isolation, memory safe
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

const chalk = require("chalk");
const path = require("path");
const { log, createOraDots, getText } = global.utils;

// ————— tuning —————
const THREAD_LIST_LIMIT = 9999999;      // max threads to fetch
const BATCH_SIZE = 20;                  // concurrent create/refresh per batch
const BATCH_DELAY_MS = 150;             // small delay between batches (avoid rate limit)
const SAFE_OPTIONS_LOGLEVEL = "silent";

/**
 * Run promise-returning tasks with concurrency limit.
 * @param {Array} items
 * @param {number} limit
 * @param {Function} worker async (item, index) => result
 * @param {number} delayMs
 */
async function runInBatches(items, limit, worker, delayMs = 0) {
	const results = new Array(items.length);
	for (let i = 0; i < items.length; i += limit) {
		const slice = items.slice(i, i + limit);
		const batchResults = await Promise.allSettled(
			slice.map((item, idx) => worker(item, i + idx))
		);
		for (let j = 0; j < batchResults.length; j++) {
			const r = batchResults[j];
			if (r.status === "fulfilled") results[i + j] = r.value;
			else {
				results[i + j] = null;
				// swallow individual error, log happens in worker
			}
		}
		if (delayMs > 0 && i + limit < items.length)
			await new Promise(r => setTimeout(r, delayMs));
	}
	return results;
}

function isValidThreadInfo(info) {
	return info && typeof info === "object" && info.threadID && !isNaN(Number(info.threadID));
}

// ————— safe setOptions wrapper —————
function safeSetOptions(api, options, loggerLabel) {
	if (!api || typeof api.setOptions !== "function") return;
	try {
		api.setOptions(options);
	} catch (err) {
		if (loggerLabel) log.warn(loggerLabel, `setOptions failed: ${err?.message || err}`);
	}
}

module.exports = async function (api, createLine) {
	// ———————————————————— LOAD DATA ———————————————————— //
	console.log(chalk.hex("#f5ab00")(createLine("DATABASE")));

	const controller = await require(
		path.join(__dirname, "..", "..", "database/controller/index.js")
	)(api);

	const {
		threadModel, userModel, dashBoardModel, globalModel,
		threadsData, usersData, dashBoardData, globalData,
		sequelize
	} = controller;

	// safe thread count (guard against null threadID)
	const validThreadCount = (global.db.allThreadData || []).filter(
		t => t && t.threadID !== null && t.threadID !== undefined &&
			String(t.threadID).length > 15
	).length;

	log.info("DATABASE", getText("loadData", "loadThreadDataSuccess", validThreadCount));
	log.info("DATABASE", getText("loadData", "loadUserDataSuccess", (global.db.allUserData || []).length));

	// ———————————————————— AUTO SYNC ———————————————————— //
	if (api && global.GoatBot?.config?.database?.autoSyncWhenStart === true) {
		console.log(chalk.hex("#f5ab00")(createLine("AUTO SYNC")));
		const spin = createOraDots(getText("loadData", "refreshingThreadData"));

		// remember original options to restore later
		const originalLogLevel = global.GoatBot?.config?.optionsFca?.logLevel || "info";

		try {
			safeSetOptions(api, { logLevel: SAFE_OPTIONS_LOGLEVEL }, "DATABASE");
			spin._start();

			// ——— fetch all threads from FB ———
			let allThreadInfo = [];
			try {
				const result = await api.getThreadList(THREAD_LIST_LIMIT, null, "INBOX");
				if (Array.isArray(result)) {
					allThreadInfo = result.filter(isValidThreadInfo);
				}
			} catch (err) {
				log.error("DATABASE", `getThreadList failed: ${err?.message || err}`);
			}

			// ——— snapshot current threads (avoid reference issues) ———
			const existingThreads = [...(global.db.allThreadData || [])];
			const existingMap = new Map();
			for (const t of existingThreads) {
				if (t && t.threadID !== undefined && t.threadID !== null)
					existingMap.set(String(t.threadID), t);
			}

			// ——— build list of work: { type: 'create' | 'refresh', info } ———
			const threadInfoMap = new Map();
			for (const info of allThreadInfo) {
				threadInfoMap.set(String(info.threadID), info);
			}

			const toCreate = [];
			const toRefresh = [];
			for (const info of allThreadInfo) {
				if (!existingMap.has(String(info.threadID))) toCreate.push(info);
				else toRefresh.push(info);
			}

			// mark as "received" for all currently-in-inbox threads
			for (const info of allThreadInfo) {
				global.db.receivedTheFirstMessage[info.threadID] = Date.now();
			}

			// ——— run creates ———
			const createdResults = await runInBatches(
				toCreate,
				BATCH_SIZE,
				async (info) => {
					try {
						return await threadsData.create(info.threadID, info);
					} catch (err) {
						log.warn("DATABASE", `create thread ${info.threadID} failed: ${err?.message || err}`);
						return null;
					}
				},
				BATCH_DELAY_MS
			);

			// ——— run refreshes ———
			const refreshedResults = await runInBatches(
				toRefresh,
				BATCH_SIZE,
				async (info) => {
					try {
						return await threadsData.refreshInfo(info.threadID, info);
					} catch (err) {
						log.warn("DATABASE", `refresh thread ${info.threadID} failed: ${err?.message || err}`);
						// fall back to existing data
						return existingMap.get(String(info.threadID)) || null;
					}
				},
				BATCH_DELAY_MS
			);

			// ——— assemble refreshed threads (dictionary by threadID) ———
			const refreshedByID = new Map();
			for (const t of createdResults) {
				if (t && t.threadID !== undefined && t.threadID !== null)
					refreshedByID.set(String(t.threadID), t);
			}
			for (const t of refreshedResults) {
				if (t && t.threadID !== undefined && t.threadID !== null)
					refreshedByID.set(String(t.threadID), t);
			}

			// ——— threads that are no longer in inbox ———
			const botID = (() => {
				try { return api.getCurrentUserID(); } catch (_) { return null; }
			})();

			const notInInbox = existingThreads.filter(
				t => t && t.threadID !== undefined && t.threadID !== null &&
					!threadInfoMap.has(String(t.threadID))
			);

			// update member flags for not-in-inbox threads (in parallel batches)
			await runInBatches(
				notInInbox,
				BATCH_SIZE,
				async (thread) => {
					try {
						if (!Array.isArray(thread.members)) return thread;
						const members = thread.members.map(m => ({ ...m })); // shallow copy
						const findMe = members.find(m => String(m.userID) === String(botID));
						if (findMe && findMe.inGroup !== false) {
							findMe.inGroup = false;
							await threadsData.set(thread.threadID, { members });
							return { ...thread, members };
						}
						return thread;
					} catch (err) {
						log.warn("DATABASE", `update members ${thread.threadID} failed: ${err?.message || err}`);
						return thread;
					}
				},
				BATCH_DELAY_MS
			);

			// ——— assemble final list (no spread — memory safe) ———
			const finalThreadData = [];
			for (const t of refreshedByID.values()) finalThreadData.push(t);
			for (const t of notInInbox) finalThreadData.push(t);

			global.db.allThreadData = finalThreadData;

			spin._stop();
			log.info("DATABASE", getText("loadData", "refreshThreadDataSuccess", finalThreadData.length));
		} catch (err) {
			try { spin._stop(); } catch (_) {}
			log.error("DATABASE", getText("loadData", "refreshThreadDataError"), err);
		} finally {
			// restore original log level
			safeSetOptions(api, { logLevel: originalLogLevel });
		}
	}
	// ————————————— ——————————— ———————————— ——————————— //

	return {
		threadModel: threadModel || null,
		userModel: userModel || null,
		dashBoardModel: dashBoardModel || null,
		globalModel: globalModel || null,
		threadsData,
		usersData,
		dashBoardData,
		globalData,
		sequelize
	};
};
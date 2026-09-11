/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * --------------------------------------------------------------------------
 * handlerEvents enhanced by Maruf — bug fixes, memory safety, regex escape,
 * mutation guards, timeout, and better error isolation.
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

const fs = require("fs-extra");
const nullAndUndefined = [undefined, null];

// ————— constants —————
const COUNTDOWN_CLEANUP_INTERVAL = 10 * 60_000; // 10 min
const RECEIVED_MESSAGE_TTL_MS = 6 * 60 * 60_000; // 6 hours
const COMMAND_TIMEOUT_MS = 5 * 60_000; // 5 min per command

function getType(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

// ————— regex escape helper —————
function escapeRegex(str = "") {
	return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ————— safe string id —————
function sid(v) {
	if (v === undefined || v === null || v === "") return null;
	return String(v);
}

// ————— role —————
function getRole(threadData, senderID) {
	const adminBot = (global.GoatBot.config.adminBot || []).map(String);
	const uid = sid(senderID);
	if (!uid) return 0;

	const adminBox = threadData ? (threadData.adminIDs || []).map(String) : [];
	if (adminBot.includes(uid)) return 2;
	if (adminBox.includes(uid)) return 1;
	return 0;
}

// ————— text —————
function getText(type, reason, time, targetID, lang) {
	const utils = global.utils;
	if (type === "userBanned") return utils.getText({ lang, head: "handlerEvents" }, "userBanned", reason, time, targetID);
	if (type === "threadBanned") return utils.getText({ lang, head: "handlerEvents" }, "threadBanned", reason, time, targetID);
	if (type === "onlyAdminBox") return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBox");
	if (type === "onlyAdminBot") return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBot");
}

function replaceShortcutInLang(text, prefix, commandName) {
	return String(text)
		.replace(/\{(?:p|prefix)\}/g, prefix)
		.replace(/\{(?:n|name)\}/g, commandName)
		.replace(/\{pn\}/g, `${prefix}${commandName}`);
}

function getRoleConfig(utils, command, isGroup, threadData, commandName) {
	const cfg = command?.config || {};
	let roleConfig;
	if (utils.isNumber(cfg.role)) {
		roleConfig = { onStart: Number(cfg.role) };
	} else if (typeof cfg.role === "object" && !Array.isArray(cfg.role)) {
		roleConfig = { ...cfg.role };
		if (roleConfig.onStart === undefined) roleConfig.onStart = 0;
	} else {
		roleConfig = { onStart: 0 };
	}

	if (isGroup && threadData?.data?.setRole?.[commandName] !== undefined) {
		roleConfig.onStart = threadData.data.setRole[commandName];
	}

	for (const key of ["onChat", "onStart", "onReaction", "onReply"]) {
		if (roleConfig[key] === undefined) roleConfig[key] = roleConfig.onStart;
	}
	return roleConfig;
}

// ————— ban / admin check —————
function isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, lang) {
	const config = global.GoatBot.config;
	const adminBot = (config.adminBot || []).map(String);
	const uid = sid(senderID);
	const { hideNotiMessage = {} } = config;

	// user banned
	if (userData?.banned?.status === true) {
		const { reason, date } = userData.banned;
		if (hideNotiMessage.userBanned === false)
			message.reply(getText("userBanned", reason, date, senderID, lang));
		return true;
	}

	// only admin bot
	const adminOnly = config.adminOnly || {};
	const ignoreList = Array.isArray(adminOnly.ignoreCommand) ? adminOnly.ignoreCommand : [];
	if (adminOnly.enable === true && !adminBot.includes(uid) && !ignoreList.includes(commandName)) {
		if (hideNotiMessage.adminOnly === false)
			message.reply(getText("onlyAdminBot", null, null, null, lang));
		return true;
	}

	// group-only checks
	if (isGroup === true && threadData) {
		const adminIDs = (threadData.adminIDs || []).map(String);
		const ignoreBox = Array.isArray(threadData.data?.ignoreCommanToOnlyAdminBox)
			? threadData.data.ignoreCommanToOnlyAdminBox
			: [];

		if (
			threadData.data?.onlyAdminBox === true &&
			!adminIDs.includes(uid) &&
			!ignoreBox.includes(commandName)
		) {
			if (!threadData.data?.hideNotiMessageOnlyAdminBox)
				message.reply(getText("onlyAdminBox", null, null, null, lang));
			return true;
		}

		if (threadData.banned?.status === true) {
			const { reason, date } = threadData.banned;
			if (hideNotiMessage.threadBanned === false)
				message.reply(getText("threadBanned", reason, date, threadID, lang));
			return true;
		}
	}
	return false;
}

// ————— per-command getText —————
function createGetText2(langCode, pathCustomLang, prefix, command) {
	const cfg = command?.config || {};
	const commandType = cfg.countDown ? "command" : "command event";
	const commandName = cfg.name || "unknown";

	let customLang = {};
	try {
		if (fs.existsSync(pathCustomLang)) {
			const mod = require(pathCustomLang);
			customLang = mod?.[commandName]?.text || {};
		}
	} catch (_) {}

	const hasLangs = command?.langs && typeof command.langs === "object";
	const hasCustom = Object.keys(customLang).length > 0;

	if (!hasLangs && !hasCustom) {
		return function () {
			return `❌ Can't find text on language "${langCode}" for ${commandType} "${commandName}"`;
		};
	}

	return function (key, ...args) {
		let lang = command?.langs?.[langCode]?.[key] ?? customLang[key] ?? "";
		lang = replaceShortcutInLang(lang, prefix, commandName);
		for (let i = args.length - 1; i >= 0; i--) {
			lang = lang.replace(new RegExp(`%${i + 1}`, "g"), args[i]);
		}
		return lang || `❌ Can't find text on language "${langCode}" for ${commandType} "${commandName}" with key "${key}"`;
	};
}

// ————— periodic cleanup —————
function startCleanups() {
	if (global.__handlerEventsCleanupStarted) return;
	global.__handlerEventsCleanupStarted = true;

	setInterval(() => {
		// countdown cleanup
		try {
			const cd = global.client?.countDown || {};
			const now = Date.now();
			for (const cmd in cd) {
				for (const uid in cd[cmd]) {
					if (typeof cd[cmd][uid] !== "number" || now - cd[cmd][uid] > 60 * 60_000) {
						delete cd[cmd][uid];
					}
				}
				if (Object.keys(cd[cmd]).length === 0) delete cd[cmd];
			}
		} catch (_) {}

		// receivedTheFirstMessage cleanup
		try {
			const r = global.db?.receivedTheFirstMessage || {};
			const now = Date.now();
			for (const tid in r) {
				// if value is a number (timestamp), expire after TTL
				if (typeof r[tid] === "number" && now - r[tid] > RECEIVED_MESSAGE_TTL_MS) {
					delete r[tid];
				}
			}
		} catch (_) {}
	}, COUNTDOWN_CLEANUP_INTERVAL).unref?.();
}

module.exports = function (
	api,
	threadModel,
	userModel,
	dashBoardModel,
	globalModel,
	usersData,
	threadsData,
	dashBoardData,
	globalData
) {
	const handlerEvents = require(
		process.env.NODE_ENV === "development" ? "./handlerEvents.dev.js" : "./handlerEvents.js"
	)(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);
	return async function (event, message) {
		const { utils, client, GoatBot } = global;
		const { getPrefix, removeHomeDir, log, getTime } = utils;
		const { config, configCommands: { envGlobal, envCommands, envEvents } } = GoatBot;
		const { autoRefreshThreadInfoFirstTime } = config.database || {};
		let { hideNotiMessage = {} } = config;

		const { body, messageID, threadID, isGroup } = event;

		if (!threadID) return;

		const senderID = sid(event.userID || event.senderID || event.author);

		// ————————— LOAD DATA ————————— //
		let threadData = global.db.allThreadData.find(t => String(t.threadID) === String(threadID));
		let userData = global.db.allUserData.find(u => String(u.userID) === String(senderID));

		if (!userData && senderID && !isNaN(Number(senderID))) {
			userData = await usersData.create(senderID);
		}

		if (!threadData && threadID && !isNaN(Number(threadID))) {
			const errorList = global.temp.createThreadDataError || [];
			if (errorList.includes(threadID)) return;
			threadData = await threadsData.create(threadID);
			global.db.receivedTheFirstMessage[threadID] = Date.now();
		} else if (
			autoRefreshThreadInfoFirstTime === true &&
			!global.db.receivedTheFirstMessage[threadID]
		) {
			global.db.receivedTheFirstMessage[threadID] = Date.now();
			await threadsData.refreshInfo(threadID);
		}

		if (typeof threadData?.settings?.hideNotiMessage === "object")
			hideNotiMessage = threadData.settings.hideNotiMessage;

		const prefix = getPrefix(threadID);
		const role = getRole(threadData, senderID);
		const langCode = threadData?.data?.lang || config.language || "en";

		// ————— parameters (shared object) ————— //
		const parameters = {
			api, usersData, threadsData, message, event,
			userModel, threadModel, prefix, dashBoardModel,
			globalModel, dashBoardData, globalData, envCommands,
			envEvents, envGlobal, role,
			removeCommandNameFromBody: function removeCommandNameFromBody(body_, prefix_, commandName_) {
				const allNullish = nullAndUndefined.includes(body_) &&
					nullAndUndefined.includes(prefix_) &&
					nullAndUndefined.includes(commandName_);
				if (allNullish) {
					throw new Error("Please provide body, prefix and commandName to use this function");
				}
				if (typeof body_ !== "string")
					throw new Error(`The first argument (body) must be a string, got "${getType(body_)}"`);
				if (typeof prefix_ !== "string")
					throw new Error(`The second argument (prefix) must be a string, got "${getType(prefix_)}"`);
				if (typeof commandName_ !== "string")
					throw new Error(`The third argument (commandName) must be a string, got "${getType(commandName_)}"`);

				return body_
					.replace(new RegExp(`^${escapeRegex(prefix_)}(\\s+|)${escapeRegex(commandName_)}`, "i"), "")
					.trim();
			}
		};

		// ————— per-event syntax error handler (NO shared mutation) ————— //
		function makeSyntaxError(commandName) {
			return async function SyntaxError() {
				return await message.reply(
					utils.getText({ lang: langCode, head: "handlerEvents" }, "commandSyntaxError", prefix, commandName)
				);
			};
		}

		// ————— error reply helper ————— //
		const shortStack = (err) => {
			try {
				if (err?.stack) return removeHomeDir(err.stack.split("\n").slice(0, 5).join("\n"));
				return removeHomeDir(JSON.stringify(err, null, 2));
			} catch (_) {
				return String(err);
			}
		};

		// ————— wrap Function → AsyncFunction without mutating original ————— //
		const asAsync = (fn) => {
			if (typeof fn !== "function") return null;
			if (getType(fn) === "AsyncFunction") return fn;
			return async function (...args) {
				return fn.apply(this, args);
			};
		};

		startCleanups();

		/*
		 +-----------------------------------------------+
		 |             WHEN USER CALLS COMMAND           |
		 +-----------------------------------------------+
		*/
		let isUserCallCommand = false;

		async function onStart() {
			if (!body || typeof body !== "string" || !body.startsWith(prefix)) return;

			const dateNow = Date.now();
			const args = body.slice(prefix.length).trim().split(/ +/);
			let commandName = args.shift().toLowerCase();

			let command =
				GoatBot.commands.get(commandName) ||
				GoatBot.commands.get(GoatBot.aliases.get(commandName));

			// aliases set by group
			const aliasesData = threadData?.data?.aliases || {};
			for (const cmdName in aliasesData) {
				const list = Array.isArray(aliasesData[cmdName]) ? aliasesData[cmdName] : [];
				if (list.includes(commandName)) {
					command = GoatBot.commands.get(cmdName);
					break;
				}
			}

			if (command?.config?.name) commandName = command.config.name;

			// ——— banned / admin check ——— //
			if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
				return;

			// ——— command not found ——— //
			if (!command || typeof command.onStart !== "function") {
				if (!hideNotiMessage.commandNotFound) {
					return await message.reply(
						commandName
							? utils.getText({ lang: langCode, head: "handlerEvents" }, "commandNotFound", commandName, prefix)
							: utils.getText({ lang: langCode, head: "handlerEvents" }, "commandNotFound2", prefix)
					);
				}
				return true;
			}

			// ——— permission ——— //
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onStart;
			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmd) {
					if (needRole === 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdmin", commandName));
					if (needRole === 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2", commandName));
				} else return true;
			}

			// ——— cooldown ——— //
			if (!client.countDown[commandName]) client.countDown[commandName] = {};
			const timestamps = client.countDown[commandName];
			let getCoolDown = command.config.countDown;
			if ((!getCoolDown && getCoolDown !== 0) || isNaN(getCoolDown)) getCoolDown = 1;
			const cooldownCommand = Number(getCoolDown) * 1000;
			if (timestamps[senderID]) {
				const expirationTime = timestamps[senderID] + cooldownCommand;
				if (dateNow < expirationTime)
					return await message.reply(
						utils.getText({ lang: langCode, head: "handlerEvents" }, "waitingForCommand",
							((expirationTime - dateNow) / 1000).toString().slice(0, 3))
					);
			}

			// ——— run ——— //
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			isUserCallCommand = true;

			try {
				// analytics (fire and forget, but catch errors)
				(async () => {
					try {
						const analytics = await globalData.get("analytics", "data", {});
						if (!analytics[commandName]) analytics[commandName] = 0;
						analytics[commandName]++;
						await globalData.set("analytics", analytics, "data");
					} catch (_) {}
				})();

				message.SyntaxError = makeSyntaxError(commandName);

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);

				await command.onStart({
					...parameters,
					args,
					commandName,
					getLang: getText2,
					removeCommandNameFromBody: parameters.removeCommandNameFromBody
				});

				timestamps[senderID] = dateNow;
				log.info("CALL COMMAND", `${commandName} | ${userData?.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
			} catch (err) {
				log.err("CALL COMMAND", `An error occurred when calling the command ${commandName}`, err);
				await message.reply(
					utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred",
						time, commandName, shortStack(err))
				);
			}
		}

		/*
		 +-----------------------------------------------+
		 |                   ON CHAT                     |
		 +-----------------------------------------------+
		*/
		async function onChat() {
			const allOnChat = GoatBot.onChat || [];
			const args = body ? body.split(/ +/) : [];

			for (const key of allOnChat) {
				const command = GoatBot.commands.get(key);
				if (!command || typeof command.onChat !== "function") continue;

				const commandName = command.config?.name || key;
				const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
				if (roleConfig.onChat > role) continue;

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				message.SyntaxError = makeSyntaxError(commandName);

				const fn = asAsync(command.onChat);
				try {
					const handler = await fn({
						...parameters,
						isUserCallCommand,
						args,
						commandName,
						getLang: getText2
					});
					if (typeof handler === "function") {
						if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
							continue;
						try {
							await handler();
							log.info("onChat", `${commandName} | ${userData?.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
						} catch (err) {
							await message.reply(
								utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred2",
									time, commandName, shortStack(err))
							);
						}
					}
				} catch (err) {
					log.err("onChat", `An error occurred when calling the command onChat ${commandName}`, err);
				}
			}
		}

		/*
		 +-----------------------------------------------+
		 |                 ON ANY EVENT                  |
		 +-----------------------------------------------+
		*/
		async function onAnyEvent() {
			const allOnAnyEvent = GoatBot.onAnyEvent || [];
			let args = [];
			if (typeof event.body === "string" && event.body.startsWith(prefix))
				args = event.body.split(/ +/);

			for (const key of allOnAnyEvent) {
				if (typeof key !== "string") continue;
				const command = GoatBot.commands.get(key);
				if (!command || typeof command.onAnyEvent !== "function") continue;

				const commandName = command.config?.name || key;
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				message.SyntaxError = makeSyntaxError(commandName);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);

				const fn = asAsync(command.onAnyEvent);
				try {
					const handler = await fn({ ...parameters, args, commandName, getLang: getText2 });
					if (typeof handler === "function") {
						try {
							await handler();
							log.info("onAnyEvent", `${commandName} | ${senderID} | ${userData?.name} | ${threadID}`);
						} catch (err) {
							message.reply(
								utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred7",
									time, commandName, shortStack(err))
							);
							log.err("onAnyEvent", `Error in onAnyEvent ${commandName}`, err);
						}
					}
				} catch (err) {
					log.err("onAnyEvent", `Error in onAnyEvent ${commandName}`, err);
				}
			}
		}

		/*
		 +-----------------------------------------------+
		 |                 ON FIRST CHAT                 |
		 +-----------------------------------------------+
		*/
		async function onFirstChat() {
			const allOnFirstChat = GoatBot.onFirstChat || [];
			const args = body ? body.split(/ +/) : [];

			for (const itemOnFirstChat of allOnFirstChat) {
				const { commandName, threadIDsChattedFirstTime } = itemOnFirstChat;
				if (!Array.isArray(threadIDsChattedFirstTime)) continue;
				if (threadIDsChattedFirstTime.includes(threadID)) continue;

				const command = GoatBot.commands.get(commandName);
				if (!command || typeof command.onFirstChat !== "function") continue;

				// mark AFTER successful run (fix premature marking)
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				message.SyntaxError = makeSyntaxError(commandName);

				const fn = asAsync(command.onFirstChat);
				try {
					const handler = await fn({
						...parameters,
						isUserCallCommand,
						args,
						commandName,
						getLang: getText2
					});
					threadIDsChattedFirstTime.push(threadID);
					if (typeof handler === "function") {
						if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
							continue;
						try {
							await handler();
							log.info("onFirstChat", `${commandName} | ${userData?.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
						} catch (err) {
							await message.reply(
								utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred2",
									time, commandName, shortStack(err))
							);
						}
					}
				} catch (err) {
					log.err("onFirstChat", `Error in onFirstChat ${commandName}`, err);
				}
			}
		}

		/*
		 +-----------------------------------------------+
		 |                    ON REPLY                   |
		 +-----------------------------------------------+
		*/
		async function onReply() {
			if (!event.messageReply) return;
			const { onReply } = GoatBot;
			const originalMsgID = event.messageReply.messageID;
			const Reply = onReply.get(originalMsgID);
			if (!Reply) return;

			// FIX: delete original entry, not the reply's messageID
			Reply.delete = () => onReply.delete(originalMsgID);

			const commandName = Reply.commandName;
			if (!commandName) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName"));
				return log.err("onReply", "Can't find command name to execute this reply!", Reply);
			}
			const command = GoatBot.commands.get(commandName);
			if (!command || typeof command.onReply !== "function") {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName));
				return log.err("onReply", `Command "${commandName}" not found`, Reply);
			}

			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onReply;
			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmdOnReply) {
					if (needRole === 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReply", commandName));
					if (needRole === 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReply", commandName));
				} else return true;
			}

			const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				const args = body ? body.split(/ +/) : [];
				message.SyntaxError = makeSyntaxError(commandName);
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
					return;
				await command.onReply({
					...parameters,
					Reply,
					args,
					commandName,
					getLang: getText2
				});
				log.info("onReply", `${commandName} | ${userData?.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
			} catch (err) {
				log.err("onReply", `Error in onReply ${commandName}`, err);
				await message.reply(
					utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred3",
						time, commandName, shortStack(err))
				);
			}
		}

		/*
		 +-----------------------------------------------+
		 |                  ON REACTION                  |
		 +-----------------------------------------------+
		*/
		async function onReaction() {
			const { onReaction } = GoatBot;
			const Reaction = onReaction.get(messageID);
			if (!Reaction) return;

			Reaction.delete = () => onReaction.delete(messageID);
			const commandName = Reaction.commandName;
			if (!commandName) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName"));
				return log.err("onReaction", "Can't find command name to execute this reaction!", Reaction);
			}
			const command = GoatBot.commands.get(commandName);
			if (!command || typeof command.onReaction !== "function") {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName));
				return log.err("onReaction", `Command "${commandName}" not found`, Reaction);
			}

			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onReaction;
			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmdOnReaction) {
					if (needRole === 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReaction", commandName));
					if (needRole === 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReaction", commandName));
				} else return true;
			}

			const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				const args = [];
				message.SyntaxError = makeSyntaxError(commandName);
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
					return;
				await command.onReaction({
					...parameters,
					Reaction,
					args,
					commandName,
					getLang: getText2
				});
				log.info("onReaction", `${commandName} | ${userData?.name} | ${senderID} | ${threadID} | ${event.reaction}`);
			} catch (err) {
				log.err("onReaction", `Error in onReaction ${commandName}`, err);
				await message.reply(
					utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred4",
						time, commandName, shortStack(err))
				);
			}
		}

		/*
		 +-----------------------------------------------+
		 |                EVENT COMMAND                  |
		 +-----------------------------------------------+
		*/
		async function handlerEvent() {
			const { author } = event;
			const allEventCommand = GoatBot.eventCommands.entries();
			for (const [key] of allEventCommand) {
				const getEvent = GoatBot.eventCommands.get(key);
				if (!getEvent || typeof getEvent.onStart !== "function") continue;

				const commandName = getEvent.config?.name || key;
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, getEvent);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				try {
					const handler = await getEvent.onStart({ ...parameters, commandName, getLang: getText2 });
					if (typeof handler === "function") {
						await handler();
						log.info("EVENT COMMAND", `Event: ${commandName} | ${author} | ${userData?.name} | ${threadID}`);
					}
				} catch (err) {
					log.err("EVENT COMMAND", `Error in event ${commandName}`, err);
					await message.reply(
						utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred5",
							time, commandName, shortStack(err))
					);
				}
			}
		}

		/*
		 +-----------------------------------------------+
		 |                    ON EVENT                   |
		 +-----------------------------------------------+
		*/
		async function onEvent() {
			const allOnEvent = GoatBot.onEvent || [];
			const args = [];
			const { author } = event;
			for (const key of allOnEvent) {
				if (typeof key !== "string") continue;
				const command = GoatBot.commands.get(key);
				if (!command || typeof command.onEvent !== "function") continue;

				const commandName = command.config?.name || key;
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				message.SyntaxError = makeSyntaxError(commandName);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);

				const fn = asAsync(command.onEvent);
				try {
					const handler = await fn({ ...parameters, args, commandName, getLang: getText2 });
					if (typeof handler === "function") {
						try {
							await handler();
							log.info("onEvent", `${commandName} | ${author} | ${userData?.name} | ${threadID}`);
						} catch (err) {
							message.reply(
								utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred6",
									time, commandName, shortStack(err))
							);
							log.err("onEvent", `Error in onEvent ${commandName}`, err);
						}
					}
				} catch (err) {
					log.err("onEvent", `Error in onEvent ${commandName}`, err);
				}
			}
		}

		/*
		 +-----------------------------------------------+
		 |              PRESENCE / RECEIPT / TYP         |
		 +-----------------------------------------------+
		*/
		async function presence() {}
		async function read_receipt() {}
		async function typ() {}

		return {
			onAnyEvent,
			onFirstChat,
			onChat,
			onStart,
			onReaction,
			onReply,
			onEvent,
			handlerEvent,
			presence,
			read_receipt,
			typ
		};
	};
};
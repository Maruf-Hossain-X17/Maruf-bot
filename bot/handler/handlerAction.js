/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 *
 * --------------------------------------------------------------------------
 * handlerAction enhanced by Maruf — bug fixes, error isolation, safer reactions
 * Original author credit preserved as required by MIT license.
 * --------------------------------------------------------------------------
 */

const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handlerCheckData.js");

module.exports = (
	api,
	threadModel,
	userModel,
	dashBoardModel,
	globalModel,
	usersData,
	threadsData,
	dashBoardData,
	globalData
) => {
	const handlerEvents = require(
		process.env.NODE_ENV === "development" ? "./handlerEvents.dev.js" : "./handlerEvents.js"
	)(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

	// ——— cached bot user id (avoid repeated API calls) ———
	let _botID = null;
	const getBotID = () => {
		if (_botID) return _botID;
		try {
			_botID = api.getCurrentUserID();
		} catch (_) {}
		return _botID;
	};

	// ——— admin check helper ———
	const isAdmin = (uid) => {
		if (!uid) return false;
		const list = global.GoatBot?.config?.adminBot;
		return Array.isArray(list) && list.includes(uid);
	};

	// ——— safe caller: isolates errors from one handler so others still run ———
	const safeCall = (name, fn) => {
		if (typeof fn !== "function") return;
		try {
			const result = fn();
			if (result && typeof result.catch === "function") {
				result.catch((err) => console.error(`[${name}]`, err?.stack || err?.message || err));
			}
		} catch (err) {
			console.error(`[${name}]`, err?.stack || err?.message || err);
		}
	};

	return async function (event) {
		try {
			if (!event || typeof event !== "object") return;

			const config = global.GoatBot?.config || {};

			// ================= ANTI INBOX =================
			if (
				config.antiInbox === true &&
				(event.senderID === event.threadID ||
					event.userID === event.senderID ||
					event.isGroup === false)
			) {
				return;
			}

			// ================= MESSAGE HELPER =================
			const message = createFuncMessage(api, event);

			// ================= DB CHECK (non-fatal) =================
			try {
				await handlerCheckDB(usersData, threadsData, event);
			} catch (err) {
				console.error("[handlerCheckDB]", err?.stack || err?.message || err);
				// don't return — let the command still run if possible
			}

			// ================= HANDLER EVENTS =================
			let handlerChat;
			try {
				handlerChat = await handlerEvents(event, message);
			} catch (err) {
				console.error("[handlerEvents]", err?.stack || err?.message || err);
				return;
			}
			if (!handlerChat) return;

			// ================= APPROVAL MODE (fixed) =================
			if (config.approval) {
				try {
					let approvedData = await globalData.get("approved", "data", {});
					if (!approvedData || typeof approvedData !== "object") approvedData = {};

					if (!Array.isArray(approvedData.approved)) {
						approvedData.approved = [];
						await globalData.set("approved", approvedData, "data");
					}
					if (!approvedData.approved.includes(event.threadID)) return;
				} catch (err) {
					console.error("[approval]", err?.message || err);
				}
			}

			// ================= DESTRUCTURE =================
			const {
				onAnyEvent,
				onFirstChat,
				onStart,
				onChat,
				onReply,
				onEvent,
				handlerEvent,
				onReaction,
				typ,
				presence,
				read_receipt
			} = handlerChat;

			// ================= ON ANY EVENT =================
			safeCall("onAnyEvent", onAnyEvent);

			// ================= REACTION CONFIG (safe) =================
			const reactBy = config.reactBy || {};
			const delReactions = Array.isArray(reactBy.delete) ? reactBy.delete : [];
			const kickReactions = Array.isArray(reactBy.kick) ? reactBy.kick : [];

			// ================= SWITCH =================
			switch (event.type) {
				case "message":
				case "message_reply":
				case "message_unsend":
					safeCall("onFirstChat", onFirstChat);
					safeCall("onChat", onChat);
					safeCall("onStart", onStart);
					safeCall("onReply", onReply);
					break;

				case "event":
					safeCall("handlerEvent", handlerEvent);
					safeCall("onEvent", onEvent);
					break;

				case "message_reaction": {
					safeCall("onReaction", onReaction);

					const botID = getBotID();
					const reactorID = event.userID; // who reacted
					const targetSenderID = event.senderID; // author of the original message
					const isReactorAdmin = isAdmin(reactorID);

					// ——— auto-unsend: admin reacts with a "delete" emoji on bot's own message ———
					if (
						delReactions.length &&
						delReactions.includes(event.reaction) &&
						isReactorAdmin &&
						targetSenderID === botID
					) {
						try {
							api.unsendMessage(event.messageID);
						} catch (err) {
							console.error("[reactBy.delete]", err?.message || err);
						}
					}

					// ——— auto-kick: admin reacts with a "kick" emoji ———
					if (
						kickReactions.length &&
						kickReactions.includes(event.reaction) &&
						isReactorAdmin &&
						targetSenderID &&
						targetSenderID !== botID // never kick the bot itself
					) {
						api.removeUserFromGroup(targetSenderID, event.threadID, (err) => {
							if (err) console.error("[reactBy.kick]", err?.message || err);
						});
					}
					break;
				}

				case "typ":
					safeCall("typ", typ);
					break;

				case "presence":
					safeCall("presence", presence);
					break;

				case "read_receipt":
					safeCall("read_receipt", read_receipt);
					break;

				// case "friend_request_received":
				// 	break;
				// case "friend_request_cancel":
				// 	break;

				default:
					break;
			}
		} catch (err) {
			console.error("[handlerAction]", err?.stack || err?.message || err);
		}
	};
};
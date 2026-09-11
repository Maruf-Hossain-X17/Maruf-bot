/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
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
	// ✅ এটা ঠিক আছে — handlerAction FROM handlerEvents
	const handlerEvents = require(
		process.env.NODE_ENV === "development" ? "./handlerEvents.dev.js" : "./handlerEvents.js"
	)(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

	let _botID = null;
	const getBotID = () => {
		if (_botID) return _botID;
		try { _botID = api.getCurrentUserID(); } catch (_) {}
		return _botID;
	};

	const isAdmin = (uid) => {
		if (!uid) return false;
		const list = global.GoatBot?.config?.adminBot;
		return Array.isArray(list) && list.includes(uid);
	};

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

			if (
				config.antiInbox === true &&
				(event.senderID === event.threadID ||
					event.userID === event.senderID ||
					event.isGroup === false)
			) {
				return;
			}

			const message = createFuncMessage(api, event);

			try {
				await handlerCheckDB(usersData, threadsData, event);
			} catch (err) {
				console.error("[handlerCheckDB]", err?.stack || err?.message || err);
			}

			let handlerChat;
			try {
				handlerChat = await handlerEvents(event, message);
			} catch (err) {
				console.error("[handlerEvents]", err?.stack || err?.message || err);
				return;
			}
			if (!handlerChat) return;

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

			const {
				onAnyEvent, onFirstChat, onStart, onChat,
				onReply, onEvent, handlerEvent, onReaction,
				typ, presence, read_receipt
			} = handlerChat;

			safeCall("onAnyEvent", onAnyEvent);

			const reactBy = config.reactBy || {};
			const delReactions = Array.isArray(reactBy.delete) ? reactBy.delete : [];
			const kickReactions = Array.isArray(reactBy.kick) ? reactBy.kick : [];

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
					const reactorID = event.userID;
					const targetSenderID = event.senderID;
					const isReactorAdmin = isAdmin(reactorID);

					if (
						delReactions.length &&
						delReactions.includes(event.reaction) &&
						isReactorAdmin &&
						targetSenderID === botID
					) {
						try { api.unsendMessage(event.messageID); }
						catch (err) { console.error("[reactBy.delete]", err?.message || err); }
					}

					if (
						kickReactions.length &&
						kickReactions.includes(event.reaction) &&
						isReactorAdmin &&
						targetSenderID &&
						targetSenderID !== botID
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

				default:
					break;
			}
		} catch (err) {
			console.error("[handlerAction]", err?.stack || err?.message || err);
		}
	};
};
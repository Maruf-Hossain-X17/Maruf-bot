/* eslint-disable no-prototype-builtins */
"use strict";

let request = promisifyPromise(require("request").defaults({ jar: true, proxy: process.env.FB_PROXY }));
const stream = require("stream");
const log = require("npmlog");
const querystring = require("querystring");
const url = require("url");

// ——————————————————————————————
// Custom Error
// ——————————————————————————————
class CustomError extends Error {
	constructor(obj) {
		if (typeof obj === "string") obj = { message: obj };
		if (typeof obj !== "object" || obj === null) throw new TypeError("Object required");
		obj.message ? super(obj.message) : super();
		Object.assign(this, obj);
	}
}

// ——————————————————————————————
// Promisify helpers (safe)
// ——————————————————————————————
function callbackToPromise(func) {
	return function (...args) {
		return new Promise((resolve, reject) => {
			try {
				func(...args, (err, data) => {
					if (err) reject(err);
					else resolve(data);
				});
			} catch (err) {
				reject(err);
			}
		});
	};
}

function isHasCallback(func) {
	if (typeof func !== "function") return false;
	try {
		return func.toString().split("\n")[0].match(/(callback|cb)\s*\)/) !== null;
	} catch (_) {
		return false;
	}
}

function promisifyPromise(promise) {
	const keys = Object.keys(promise || {});
	let promise_;
	if (typeof promise === "function" && isHasCallback(promise))
		promise_ = callbackToPromise(promise);
	else
		promise_ = promise;

	for (const key of keys) {
		try {
			if (!promise[key] || !promise[key].toString) continue;
			if (typeof promise[key] === "function" && isHasCallback(promise[key]))
				promise_[key] = callbackToPromise(promise[key]);
			else
				promise_[key] = promise[key];
		} catch (_) {
			promise_[key] = promise[key];
		}
	}

	return promise_;
}

// ——————————————————————————————
// Delay / Try (bluebird replacements)
// ——————————————————————————————
function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function tryPromise(tryFunc) {
	return new Promise((resolve, reject) => {
		try {
			resolve(tryFunc());
		} catch (error) {
			reject(error);
		}
	});
}

// ——————————————————————————————
// Proxy setter (now returns/updates consistently)
// ——————————————————————————————
function setProxy(proxyUrl) {
	try {
		if (typeof proxyUrl === "undefined") {
			request = promisifyPromise(require("request").defaults({ jar: true }));
			return request;
		}
		request = promisifyPromise(require("request").defaults({ jar: true, proxy: proxyUrl }));
		return request;
	} catch (err) {
		log.error("setProxy", `Failed to set proxy: ${err.message}`);
		throw err;
	}
}

// ——————————————————————————————
// Header building
// ——————————————————————————————
function getHeaders(url, options = {}, ctx, customHeader) {
	const headers = {
		"Content-Type": "application/x-www-form-urlencoded",
		Referer: "https://www.facebook.com/",
		Host: url.replace("https://", "").split("/")[0],
		Origin: "https://www.facebook.com",
		"User-Agent": options.userAgent,
		Connection: "keep-alive",
		"sec-fetch-site": "same-origin"
	};
	if (customHeader) Object.assign(headers, customHeader);
	if (ctx && ctx.region) headers["X-MSGR-Region"] = ctx.region;
	return headers;
}

function isReadableStream(obj) {
	return (
		obj instanceof stream.Stream &&
		(getType(obj._read) === "Function" || getType(obj._read) === "AsyncFunction") &&
		getType(obj._readableState) === "Object"
	);
}

// ——————————————————————————————
// HTTP requests
// ——————————————————————————————
function get(url, jar, qs, options, ctx) {
	if (getType(qs) === "Object") {
		for (const prop in qs) {
			if (qs.hasOwnProperty(prop) && getType(qs[prop]) === "Object") {
				qs[prop] = JSON.stringify(qs[prop]);
			}
		}
	}
	const op = {
		headers: getHeaders(url, options, ctx),
		timeout: 60000,
		qs: qs,
		url: url,
		method: "GET",
		jar: jar,
		gzip: true
	};

	return request(op).then(function (res) {
		return Array.isArray(res) ? res[0] : res;
	});
}

function post(url, jar, form, options, ctx, customHeader) {
	const op = {
		headers: getHeaders(url, options, ctx, customHeader),
		timeout: 60000,
		url: url,
		method: "POST",
		form: form,
		jar: jar,
		gzip: true
	};

	return request(op).then(function (res) {
		return Array.isArray(res) ? res[0] : res;
	});
}

function postFormData(url, jar, form, qs, options, ctx) {
	const headers = getHeaders(url, options, ctx);
	headers["Content-Type"] = "multipart/form-data";
	const op = {
		headers: headers,
		timeout: 60000,
		url: url,
		method: "POST",
		formData: form,
		qs: qs,
		jar: jar,
		gzip: true
	};

	return request(op).then(function (res) {
		return Array.isArray(res) ? res[0] : res;
	});
}

// ——————————————————————————————
// ID / Threading ID generators
// ——————————————————————————————
function padZeros(val, len) {
	val = String(val);
	len = len || 2;
	while (val.length < len) val = "0" + val;
	return val;
}

function generateThreadingID(clientID) {
	const k = Date.now();
	const l = Math.floor(Math.random() * 4294967295);
	const m = clientID;
	return "<" + k + ":" + l + "-" + m + "@mail.projektitan.com>";
}

function binaryToDecimal(data) {
	// FIX: empty string infinite loop guard
	if (data === "" || data === "0") return "0";
	let ret = "";
	while (data !== "0" && data !== "") {
		let end = 0;
		let fullName = "";
		let i = 0;
		for (; i < data.length; i++) {
			end = 2 * end + parseInt(data[i], 10);
			if (end >= 10) {
				fullName += "1";
				end -= 10;
			} else {
				fullName += "0";
			}
		}
		ret = end.toString() + ret;
		const idx = fullName.indexOf("1");
		data = idx === -1 ? "0" : fullName.slice(idx);
	}
	return ret;
}

function generateOfflineThreadingID() {
	const ret = Date.now();
	const value = Math.floor(Math.random() * 4294967295);
	const str = ("0000000000000000000000" + value.toString(2)).slice(-22);
	const msgs = ret.toString(2) + str;
	return binaryToDecimal(msgs);
}

// ——————————————————————————————
// Presence encoding
// ——————————————————————————————
let h;
const i = {};
const j = {
	_: "%",
	A: "%2",
	B: "000",
	C: "%7d",
	D: "%7b%22",
	E: "%2c%22",
	F: "%22%3a",
	G: "%2c%22ut%22%3a1",
	H: "%2c%22bls%22%3a",
	I: "%2c%22n%22%3a%22%",
	J: "%22%3a%7b%22i%22%3a0%7d",
	K: "%2c%22pt%22%3a0%2c%22vis%22%3a",
	L: "%2c%22ch%22%3a%7b%22h%22%3a%22",
	M: "%7b%22v%22%3a2%2c%22time%22%3a1",
	N: ".channel%22%2c%22sub%22%3a%5b",
	O: "%2c%22sb%22%3a1%2c%22t%22%3a%5b",
	P: "%2c%22ud%22%3a100%2c%22lc%22%3a0",
	Q: "%5d%2c%22f%22%3anull%2c%22uct%22%3a",
	R: ".channel%22%2c%22sub%22%3a%5b1%5d",
	S: "%22%2c%22m%22%3a0%7d%2c%7b%22i%22%3a",
	T: "%2c%22blc%22%3a1%2c%22snd%22%3a1%2c%22ct%22%3a",
	U: "%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
	V: "%2c%22blc%22%3a0%2c%22snd%22%3a0%2c%22ct%22%3a",
	W: "%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a",
	X: "%2c%22ri%22%3a0%7d%2c%22state%22%3a%7b%22p%22%3a0%2c%22ut%22%3a1",
	Y:
		"%2c%22pt%22%3a0%2c%22vis%22%3a1%2c%22bls%22%3a0%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
	Z:
		"%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a"
};
(function () {
	const l = [];
	for (const m in j) {
		i[j[m]] = m;
		l.push(j[m]);
	}
	l.reverse();
	h = new RegExp(l.join("|"), "g");
})();

function presenceEncode(str) {
	return encodeURIComponent(str)
		.replace(/([_A-Z])|%../g, function (m, n) {
			return n ? "%" + n.charCodeAt(0).toString(16) : m;
		})
		.toLowerCase()
		.replace(h, function (m) {
			return i[m];
		});
}

function presenceDecode(str) {
	return decodeURIComponent(
		str.replace(/[_A-Z]/g, function (m) {
			return j[m];
		})
	);
}

function generatePresence(userID) {
	const time = Date.now();
	return (
		"E" +
		presenceEncode(
			JSON.stringify({
				v: 3,
				time: Math.floor(time / 1000),
				user: userID,
				state: {
					ut: 0,
					t2: [],
					lm2: null,
					uct2: time,
					tr: null,
					tw: Math.floor(Math.random() * 4294967295) + 1,
					at: time
				},
				ch: { ["p_" + userID]: 0 }
			})
		)
	);
}

function generateAccessiblityCookie() {
	const time = Date.now();
	return encodeURIComponent(
		JSON.stringify({
			sr: 0,
			"sr-ts": time,
			jk: 0,
			"jk-ts": time,
			kb: 0,
			"kb-ts": time,
			hcm: 0,
			"hcm-ts": time
		})
	);
}

function getGUID() {
	let sectionLength = Date.now();
	const id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = Math.floor((sectionLength + Math.random() * 16) % 16);
		sectionLength = Math.floor(sectionLength / 16);
		const _guid = (c === "x" ? r : (r & 7) | 8).toString(16);
		return _guid;
	});
	return id;
}

function getExtension(original_extension, fullFileName = "") {
	if (original_extension) return original_extension;
	const extension = String(fullFileName).split(".").pop();
	if (extension === fullFileName) return "";
	return extension;
}

// ——————————————————————————————
// Attachment formatting (safe navigation everywhere)
// ——————————————————————————————
function _formatAttachment(attachment1, attachment2) {
	const fullFileName = attachment1?.filename;
	const fileSize = Number(attachment1?.fileSize || 0);
	const durationVideo = attachment1?.genericMetadata ? Number(attachment1.genericMetadata.videoLength) : undefined;
	const durationAudio = attachment1?.genericMetadata ? Number(attachment1.genericMetadata.duration) : undefined;
	const mimeType = attachment1?.mimeType;

	attachment2 = attachment2 || { id: "", image_data: {} };
	attachment1 = attachment1?.mercury || attachment1 || {};
	let blob = attachment1.blob_attachment || attachment1.sticker_attachment;
	let type = blob && blob.__typename ? blob.__typename : attachment1.attach_type;

	if (!type && attachment1.sticker_attachment) {
		type = "StickerAttachment";
		blob = attachment1.sticker_attachment;
	} else if (!type && attachment1.extensible_attachment) {
		if (
			attachment1.extensible_attachment.story_attachment &&
			attachment1.extensible_attachment.story_attachment.target &&
			attachment1.extensible_attachment.story_attachment.target.__typename &&
			attachment1.extensible_attachment.story_attachment.target.__typename === "MessageLocation"
		) {
			type = "MessageLocation";
		} else {
			type = "ExtensibleAttachment";
		}
		blob = attachment1.extensible_attachment;
	}

	// safe toString helper
	const s = (v) => (v === undefined || v === null ? "" : String(v));

	switch (type) {
		case "sticker":
			return {
				type: "sticker",
				ID: s(attachment1.metadata?.stickerID),
				url: attachment1.url,
				packID: s(attachment1.metadata?.packID),
				spriteUrl: attachment1.metadata?.spriteURI,
				spriteUrl2x: attachment1.metadata?.spriteURI2x,
				width: attachment1.metadata?.width,
				height: attachment1.metadata?.height,
				caption: attachment2?.caption,
				description: attachment2?.description,
				frameCount: attachment1.metadata?.frameCount,
				frameRate: attachment1.metadata?.frameRate,
				framesPerRow: attachment1.metadata?.framesPerRow,
				framesPerCol: attachment1.metadata?.framesPerCol,
				stickerID: s(attachment1.metadata?.stickerID),
				spriteURI: attachment1.metadata?.spriteURI,
				spriteURI2x: attachment1.metadata?.spriteURI2x
			};
		case "file":
			return {
				type: "file",
				ID: s(attachment2?.id),
				fullFileName,
				filename: attachment1.name,
				fileSize,
				original_extension: getExtension(attachment1.original_extension, fullFileName),
				mimeType,
				url: attachment1.url,
				isMalicious: attachment2?.is_malicious,
				contentType: attachment2?.mime_type,
				name: attachment1.name
			};
		case "photo":
			return {
				type: "photo",
				ID: s(attachment1.metadata?.fbid),
				filename: attachment1.fileName,
				fullFileName,
				fileSize,
				original_extension: getExtension(attachment1.original_extension, fullFileName),
				mimeType,
				thumbnailUrl: attachment1.thumbnail_url,
				previewUrl: attachment1.preview_url,
				previewWidth: attachment1.preview_width,
				previewHeight: attachment1.preview_height,
				largePreviewUrl: attachment1.large_preview_url,
				largePreviewWidth: attachment1.large_preview_width,
				largePreviewHeight: attachment1.large_preview_height,
				url: attachment1.metadata?.url,
				width: attachment1.metadata?.dimensions?.split(",")?.[0],
				height: attachment1.metadata?.dimensions?.split(",")?.[1],
				name: fullFileName
			};
		case "animated_image":
			return {
				type: "animated_image",
				ID: s(attachment2?.id),
				filename: attachment2?.filename,
				fullFileName,
				original_extension: getExtension(attachment2?.original_extension, fullFileName),
				mimeType,
				previewUrl: attachment1.preview_url,
				previewWidth: attachment1.preview_width,
				previewHeight: attachment1.preview_height,
				url: attachment2?.image_data?.url,
				width: attachment2?.image_data?.width,
				height: attachment2?.image_data?.height,
				name: attachment1.name,
				facebookUrl: attachment1.url,
				thumbnailUrl: attachment1.thumbnail_url,
				rawGifImage: attachment2?.image_data?.raw_gif_image,
				rawWebpImage: attachment2?.image_data?.raw_webp_image,
				animatedGifUrl: attachment2?.image_data?.animated_gif_url,
				animatedGifPreviewUrl: attachment2?.image_data?.animated_gif_preview_url,
				animatedWebpUrl: attachment2?.image_data?.animated_webp_url,
				animatedWebpPreviewUrl: attachment2?.image_data?.animated_webp_preview_url
			};
		case "share":
			return {
				type: "share",
				ID: s(attachment1.share?.share_id),
				url: attachment2?.href,
				title: attachment1.share?.title,
				description: attachment1.share?.description,
				source: attachment1.share?.source,
				image: attachment1.share?.media?.image,
				width: attachment1.share?.media?.image_size?.width,
				height: attachment1.share?.media?.image_size?.height,
				playable: attachment1.share?.media?.playable,
				duration: attachment1.share?.media?.duration,
				subattachments: attachment1.share?.subattachments,
				properties: {},
				animatedImageSize: attachment1.share?.media?.animated_image_size,
				facebookUrl: attachment1.share?.uri,
				target: attachment1.share?.target,
				styleList: attachment1.share?.style_list
			};
		case "video":
			return {
				type: "video",
				ID: s(attachment1.metadata?.fbid),
				filename: attachment1.name,
				fullFileName,
				original_extension: getExtension(attachment1.original_extension, fullFileName),
				mimeType,
				duration: durationVideo,
				previewUrl: attachment1.preview_url,
				previewWidth: attachment1.preview_width,
				previewHeight: attachment1.preview_height,
				url: attachment1.url,
				width: attachment1.metadata?.dimensions?.width,
				height: attachment1.metadata?.dimensions?.height,
				videoType: "unknown",
				thumbnailUrl: attachment1.thumbnail_url
			};
		case "error":
			return { type: "error", attachment1, attachment2 };
		case "MessageImage":
			return {
				type: "photo",
				ID: blob?.legacy_attachment_id,
				filename: blob?.filename,
				fullFileName,
				fileSize,
				original_extension: getExtension(blob?.original_extension, fullFileName),
				mimeType,
				thumbnailUrl: blob?.thumbnail?.uri,
				previewUrl: blob?.preview?.uri,
				previewWidth: blob?.preview?.width,
				previewHeight: blob?.preview?.height,
				largePreviewUrl: blob?.large_preview?.uri,
				largePreviewWidth: blob?.large_preview?.width,
				largePreviewHeight: blob?.large_preview?.height,
				url: blob?.large_preview?.uri,
				width: blob?.original_dimensions?.x,
				height: blob?.original_dimensions?.y,
				name: blob?.filename
			};
		case "MessageAnimatedImage":
			return {
				type: "animated_image",
				ID: blob?.legacy_attachment_id,
				filename: blob?.filename,
				fullFileName,
				original_extension: getExtension(blob?.original_extension, fullFileName),
				mimeType,
				previewUrl: blob?.preview_image?.uri,
				previewWidth: blob?.preview_image?.width,
				previewHeight: blob?.preview_image?.height,
				url: blob?.animated_image?.uri,
				width: blob?.animated_image?.width,
				height: blob?.animated_image?.height,
				thumbnailUrl: blob?.preview_image?.uri,
				name: blob?.filename,
				facebookUrl: blob?.animated_image?.uri,
				rawGifImage: blob?.animated_image?.uri,
				animatedGifUrl: blob?.animated_image?.uri,
				animatedGifPreviewUrl: blob?.preview_image?.uri,
				animatedWebpUrl: blob?.animated_image?.uri,
				animatedWebpPreviewUrl: blob?.preview_image?.uri
			};
		case "MessageVideo":
			return {
				type: "video",
				ID: blob?.legacy_attachment_id,
				filename: blob?.filename,
				fullFileName,
				original_extension: getExtension(blob?.original_extension, fullFileName),
				fileSize,
				duration: durationVideo,
				mimeType,
				previewUrl: blob?.large_image?.uri,
				previewWidth: blob?.large_image?.width,
				previewHeight: blob?.large_image?.height,
				url: blob?.playable_url,
				width: blob?.original_dimensions?.x,
				height: blob?.original_dimensions?.y,
				videoType: (blob?.video_type || "").toLowerCase(),
				thumbnailUrl: blob?.large_image?.uri
			};
		case "MessageAudio":
			return {
				type: "audio",
				ID: blob?.url_shimhash,
				filename: blob?.filename,
				fullFileName,
				fileSize,
				duration: durationAudio,
				original_extension: getExtension(blob?.original_extension, fullFileName),
				mimeType,
				audioType: blob?.audio_type,
				url: blob?.playable_url,
				isVoiceMail: blob?.is_voicemail
			};
		case "StickerAttachment":
		case "Sticker":
			return {
				type: "sticker",
				ID: blob?.id,
				url: blob?.url,
				packID: blob?.pack ? blob.pack.id : null,
				spriteUrl: blob?.sprite_image,
				spriteUrl2x: blob?.sprite_image_2x,
				width: blob?.width,
				height: blob?.height,
				caption: blob?.label,
				description: blob?.label,
				frameCount: blob?.frame_count,
				frameRate: blob?.frame_rate,
				framesPerRow: blob?.frames_per_row,
				framesPerCol: blob?.frames_per_column,
				stickerID: blob?.id,
				spriteURI: blob?.sprite_image,
				spriteURI2x: blob?.sprite_image_2x
			};
		case "MessageLocation": {
			const urlAttach = blob?.story_attachment?.url || "";
			const mediaAttach = blob?.story_attachment?.media;

			let u, where1, address, latitude, longitude;
			try {
				u = querystring.parse(url.parse(urlAttach).query).u;
				where1 = querystring.parse(url.parse(u).query).where1;
				address = (where1 || "").split(", ");
				latitude = Number.parseFloat(address[0]);
				longitude = Number.parseFloat(address[1]);
			} catch (_) {}

			let imageUrl, width, height;
			if (mediaAttach && mediaAttach.image) {
				imageUrl = mediaAttach.image.uri;
				width = mediaAttach.image.width;
				height = mediaAttach.image.height;
			}

			return {
				type: "location",
				ID: blob?.legacy_attachment_id,
				latitude,
				longitude,
				image: imageUrl,
				width,
				height,
				url: u || urlAttach,
				address: where1,
				facebookUrl: blob?.story_attachment?.url,
				target: blob?.story_attachment?.target,
				styleList: blob?.story_attachment?.style_list
			};
		}
		case "ExtensibleAttachment": {
			const sa = blob?.story_attachment || {};
			return {
				type: "share",
				ID: blob?.legacy_attachment_id,
				url: sa.url,
				title: sa.title_with_entities?.text,
				description: sa.description?.text,
				source: sa.source ? sa.source.text : null,
				image: sa.media?.image?.uri,
				width: sa.media?.image?.width,
				height: sa.media?.image?.height,
				playable: sa.media?.is_playable,
				duration: sa.media?.playable_duration_in_ms,
				playableUrl: sa.media == null ? null : sa.media.playable_url,
				subattachments: sa.subattachments,
				properties: (sa.properties || []).reduce(function (obj, cur) {
					obj[cur.key] = cur.value?.text;
					return obj;
				}, {}),
				facebookUrl: sa.url,
				target: sa.target,
				styleList: sa.style_list
			};
		}
		case "MessageFile":
			return {
				type: "file",
				ID: blob?.message_file_fbid,
				fullFileName,
				filename: blob?.filename,
				fileSize,
				mimeType: blob?.mimetype,
				original_extension: blob?.original_extension || String(fullFileName || "").split(".").pop(),
				url: blob?.url,
				isMalicious: blob?.is_malicious,
				contentType: blob?.content_type,
				name: blob?.filename
			};
		default:
			throw new Error(
				"unrecognized attach_file of type " +
					type +
					"`" +
					JSON.stringify(attachment1, null, 4) +
					" attachment2: " +
					JSON.stringify(attachment2, null, 4) +
					"`"
			);
	}
}

function formatAttachment(attachments, attachmentIds, attachmentMap, shareMap) {
	attachmentMap = shareMap || attachmentMap;
	if (!attachments || !Array.isArray(attachments)) return [];
	return attachments.map(function (val, i) {
		try {
			if (!attachmentMap || !attachmentIds || !attachmentMap[attachmentIds[i]])
				return _formatAttachment(val);
			return _formatAttachment(val, attachmentMap[attachmentIds[i]]);
		} catch (err) {
			return { type: "error", error: err.message, raw: val };
		}
	});
}

// ——————————————————————————————
// Delta / Message formatters
// ——————————————————————————————
function formatDeltaMessage(m) {
	try {
		const md = m.delta.messageMetadata;
		let mdata = [];
		try {
			if (m.delta.data !== undefined && m.delta.data.prng !== undefined)
				mdata = JSON.parse(m.delta.data.prng);
		} catch (_) {
			mdata = [];
		}
		const m_id = mdata.map(u => u.i);
		const m_offset = mdata.map(u => u.o);
		const m_length = mdata.map(u => u.l);
		const mentions = {};
		for (let i = 0; i < m_id.length; i++) {
			mentions[m_id[i]] = m.delta.body.substring(m_offset[i], m_offset[i] + m_length[i]);
		}
		return {
			type: "message",
			senderID: formatID(md.actorFbId.toString()),
			body: m.delta.body || "",
			threadID: formatID((md.threadKey.threadFbId || md.threadKey.otherUserFbId).toString()),
			messageID: md.messageId,
			attachments: (m.delta.attachments || []).map(v => _formatAttachment(v)),
			mentions: mentions,
			timestamp: md.timestamp,
			isGroup: !!md.threadKey.threadFbId,
			participantIDs: m.delta.participants || (md.cid ? md.cid.canonicalParticipantFbids : []) || []
		};
	} catch (err) {
		return { type: "error", error: err.message, raw: m };
	}
}

function formatID(id) {
	// FIX: handle non-string values
	if (id === undefined || id === null) return id;
	return String(id).replace(/(fb)?id[:.]/, "");
}

function formatMessage(m) {
	const originalMessage = m.message ? m.message : m;
	const senderName = originalMessage.sender_name || "";
	const obj = {
		type: "message",
		senderName: originalMessage.sender_name,
		senderID: formatID((originalMessage.sender_fbid || "").toString()),
		participantNames: originalMessage.group_thread_info
			? originalMessage.group_thread_info.participant_names
			: [senderName.split(" ")[0]],
		participantIDs: originalMessage.group_thread_info
			? originalMessage.group_thread_info.participant_ids.map(v => formatID(v.toString()))
			: [formatID(originalMessage.sender_fbid)],
		body: originalMessage.body || "",
		threadID: formatID(((originalMessage.thread_fbid || originalMessage.other_user_fbid) || "").toString()),
		threadName: originalMessage.group_thread_info
			? originalMessage.group_thread_info.name
			: originalMessage.sender_name,
		location: originalMessage.coordinates ? originalMessage.coordinates : null,
		messageID: originalMessage.mid ? originalMessage.mid.toString() : originalMessage.message_id,
		attachments: formatAttachment(
			originalMessage.attachments,
			originalMessage.attachmentIds,
			originalMessage.attachment_map,
			originalMessage.share_map
		),
		timestamp: originalMessage.timestamp,
		timestampAbsolute: originalMessage.timestamp_absolute,
		timestampRelative: originalMessage.timestamp_relative,
		timestampDatetime: originalMessage.timestamp_datetime,
		tags: originalMessage.tags,
		reactions: originalMessage.reactions ? originalMessage.reactions : [],
		isUnread: originalMessage.is_unread
	};

	if (m.type === "pages_messaging")
		obj.pageID = m.realtime_viewer_fbid.toString();
	obj.isGroup = (obj.participantIDs || []).length > 2;

	return obj;
}

function formatEvent(m) {
	try {
		const originalMessage = m.message ? m.message : m;
		let logMessageType = originalMessage.log_message_type;
		let logMessageData;
		if (logMessageType === "log:generic-admin-text") {
			logMessageData = originalMessage.log_message_data?.untypedData;
			logMessageType = getAdminTextMessageType(originalMessage.log_message_data?.message_type);
		} else {
			logMessageData = originalMessage.log_message_data;
		}

		return Object.assign(formatMessage(originalMessage), {
			type: "event",
			logMessageType: logMessageType,
			logMessageData: logMessageData,
			logMessageBody: originalMessage.log_message_body
		});
	} catch (err) {
		return { type: "error", error: err.message, raw: m };
	}
}

function formatHistoryMessage(m) {
	switch (m.action_type) {
		case "ma-type:log-message":
			return formatEvent(m);
		default:
			return formatMessage(m);
	}
}

function getAdminTextMessageType(type) {
	switch (type) {
		case "change_thread_theme": return "log:thread-color";
		case "change_thread_icon":
		case "change_thread_quick_reaction": return "log:thread-icon";
		case "change_thread_nickname": return "log:user-nickname";
		case "change_thread_admins": return "log:thread-admins";
		case "group_poll": return "log:thread-poll";
		case "change_thread_approval_mode": return "log:thread-approval-mode";
		case "messenger_call_log":
		case "participant_joined_group_call": return "log:thread-call";
		default: return type;
	}
}

function formatDeltaEvent(m) {
	let logMessageType;
	let logMessageData;

	switch (m.class) {
		case "AdminTextMessage":
			logMessageData = m.untypedData;
			logMessageType = getAdminTextMessageType(m.type);
			break;
		case "ThreadName":
			logMessageType = "log:thread-name";
			logMessageData = { name: m.name };
			break;
		case "ParticipantsAddedToGroupThread":
			logMessageType = "log:subscribe";
			logMessageData = { addedParticipants: m.addedParticipants };
			break;
		case "ParticipantLeftGroupThread":
			logMessageType = "log:unsubscribe";
			logMessageData = { leftParticipantFbId: m.leftParticipantFbId };
			break;
		case "ApprovalQueue":
			logMessageType = "log:approval-queue";
			logMessageData = {
				approvalQueue: {
					action: m.action,
					recipientFbId: m.recipientFbId,
					requestSource: m.requestSource,
					...m.messageMetadata
				}
			};
	}

	const mm = m.messageMetadata || {};
	return {
		type: "event",
		threadID: formatID(((mm.threadKey?.threadFbId || mm.threadKey?.otherUserFbId) || "").toString()),
		messageID: mm.messageId ? mm.messageId.toString() : undefined,
		logMessageType: logMessageType,
		logMessageData: logMessageData,
		logMessageBody: mm.adminText,
		timestamp: mm.timestamp,
		author: mm.actorFbId,
		participantIDs: (m.participants || []).map(p => p.toString())
	};
}

function formatTyp(event) {
	return {
		isTyping: !!event.st,
		from: event.from.toString(),
		threadID: formatID((event.to || event.thread_fbid || event.from).toString()),
		fromMobile: event.hasOwnProperty("from_mobile") ? event.from_mobile : true,
		userID: (event.realtime_viewer_fbid || event.from).toString(),
		type: "typ"
	};
}

function formatDeltaReadReceipt(delta) {
	return {
		reader: (delta.threadKey.otherUserFbId || delta.actorFbId).toString(),
		time: delta.actionTimestampMs,
		threadID: formatID((delta.threadKey.otherUserFbId || delta.threadKey.threadFbId).toString()),
		type: "read_receipt"
	};
}

function formatReadReceipt(event) {
	return {
		reader: event.reader.toString(),
		time: event.time,
		threadID: formatID((event.thread_fbid || event.reader).toString()),
		type: "read_receipt"
	};
}

function formatRead(event) {
	return {
		threadID: formatID(
			((event.chat_ids && event.chat_ids[0]) || (event.thread_fbids && event.thread_fbids[0]) || "").toString()
		),
		time: event.timestamp,
		type: "read"
	};
}

// ——————————————————————————————
// String helpers (fixes)
// ——————————————————————————————
function getFrom(str, startToken, endToken) {
	const start = str.indexOf(startToken) + startToken.length;
	// FIX: if startToken not found, indexOf returns -1 → start = length - 1 → wrong
	if (start < startToken.length) return "";

	const lastHalf = str.substring(start);
	const end = lastHalf.indexOf(endToken);
	if (end === -1) {
		throw new Error("Could not find endTime `" + endToken + "` in the given string.");
	}
	return lastHalf.substring(0, end);
}

function makeParsable(html) {
	const withoutForLoop = html.replace(/for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");
	// FIX: handle both \r\n and \n (Linux/Mac/Windows)
	const maybeMultipleObjects = withoutForLoop.split(/\}\r?\n *\{/);
	if (maybeMultipleObjects.length === 1) return maybeMultipleObjects;
	return "[" + maybeMultipleObjects.join("},{") + "]";
}

function arrToForm(form) {
	return arrayToObject(
		form,
		v => v.name,
		v => v.val
	);
}

function arrayToObject(arr, getKey, getValue) {
	return arr.reduce(function (acc, val) {
		acc[getKey(val)] = getValue(val);
		return acc;
	}, {});
}

function getSignatureID() {
	return Math.floor(Math.random() * 2147483648).toString(16);
}

function generateTimestampRelative() {
	const d = new Date();
	return d.getHours() + ":" + padZeros(d.getMinutes());
}

// ——————————————————————————————
// makeDefaults
// ——————————————————————————————
function makeDefaults(html, userID, ctx) {
	let reqCounter = 1;
	const fb_dtsg = getFrom(html, 'name="fb_dtsg" value="', '"');

	let ttstamp = "2";
	for (let i = 0; i < fb_dtsg.length; i++) {
		ttstamp += fb_dtsg.charCodeAt(i);
	}
	const revision = getFrom(html, 'revision":', ",");

	function mergeWithDefaults(obj) {
		const newObj = {
			__user: userID,
			__req: (reqCounter++).toString(36),
			__rev: revision,
			__a: 1,
			fb_dtsg: ctx.fb_dtsg ? ctx.fb_dtsg : fb_dtsg,
			jazoest: ctx.ttstamp ? ctx.ttstamp : ttstamp
		};

		if (!obj) return newObj;

		for (const prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				if (!newObj[prop]) {
					newObj[prop] = obj[prop];
				}
			}
		}

		return newObj;
	}

	function postWithDefaults(url, jar, form, ctxx, customHeader = {}) {
		return post(url, jar, mergeWithDefaults(form), ctx.globalOptions, ctxx || ctx, customHeader);
	}

	function getWithDefaults(url, jar, qs, ctxx, customHeader = {}) {
		return get(url, jar, mergeWithDefaults(qs), ctx.globalOptions, ctxx || ctx, customHeader);
	}

	function postFormDataWithDefault(url, jar, form, qs, ctxx) {
		return postFormData(
			url,
			jar,
			mergeWithDefaults(form),
			mergeWithDefaults(qs),
			ctx.globalOptions,
			ctxx || ctx
		);
	}

	return {
		get: getWithDefaults,
		post: postWithDefaults,
		postFormData: postFormDataWithDefault
	};
}

// ——————————————————————————————
// parseAndCheckLogin (retry with proper closure)
// ——————————————————————————————
function parseAndCheckLogin(ctx, defaultFuncs, retryCount, sourceCall) {
	if (retryCount === undefined) retryCount = 0;
	if (sourceCall === undefined) {
		try { throw new Error(); }
		catch (e) { sourceCall = e; }
	}
	return function (data) {
		return tryPromise(function () {
			log.verbose("parseAndCheckLogin", data.body);
			if (data.statusCode >= 500 && data.statusCode < 600) {
				if (retryCount >= 5) {
					throw new CustomError({
						message: "Request retry failed. Check the `res` and `statusCode` property on this error.",
						statusCode: data.statusCode,
						res: data.body,
						error: "Request retry failed. Check the `res` and `statusCode` property on this error.",
						sourceCall: sourceCall
					});
				}
				retryCount++;
				const retryTime = Math.floor(Math.random() * 5000);
				log.warn("parseAndCheckLogin", "Got status code " + data.statusCode + " - " + retryCount + ". attempt to retry in " + retryTime + " milliseconds...");
				const reqUrl = data.request.uri.protocol + "//" + data.request.uri.hostname + data.request.uri.pathname;
				const contentType = (data.request.headers["Content-Type"] || "").split(";")[0];

				if (contentType === "multipart/form-data") {
					return delay(retryTime)
						.then(() => defaultFuncs.postFormData(reqUrl, ctx.jar, data.request.formData, {}))
						.then(parseAndCheckLogin(ctx, defaultFuncs, retryCount, sourceCall));
				} else {
					return delay(retryTime)
						.then(() => defaultFuncs.post(reqUrl, ctx.jar, data.request.formData))
						.then(parseAndCheckLogin(ctx, defaultFuncs, retryCount, sourceCall));
				}
			}
			if (data.statusCode !== 200)
				throw new CustomError({
					message: "parseAndCheckLogin got status code: " + data.statusCode + ". Bailing out of trying to parse response.",
					statusCode: data.statusCode,
					res: data.body,
					error: "parseAndCheckLogin got status code: " + data.statusCode + ". Bailing out of trying to parse response.",
					sourceCall: sourceCall
				});

			let res = null;
			try {
				res = JSON.parse(makeParsable(data.body));
			} catch (e) {
				throw new CustomError({
					message: "JSON.parse error. Check the `detail` property on this error.",
					detail: e,
					res: data.body,
					error: "JSON.parse error. Check the `detail` property on this error.",
					sourceCall: sourceCall
				});
			}

			if (res.redirect && data.request.method === "GET") {
				return defaultFuncs
					.get(res.redirect, ctx.jar)
					.then(parseAndCheckLogin(ctx, defaultFuncs, undefined, sourceCall));
			}

			if (
				res.jsmods &&
				res.jsmods.require &&
				Array.isArray(res.jsmods.require[0]) &&
				res.jsmods.require[0][0] === "Cookie"
			) {
				res.jsmods.require[0][3][0] = res.jsmods.require[0][3][0].replace("_js_", "");
				const cookie = formatCookie(res.jsmods.require[0][3], "facebook");
				const cookie2 = formatCookie(res.jsmods.require[0][3], "messenger");
				ctx.jar.setCookie(cookie, "https://www.facebook.com");
				ctx.jar.setCookie(cookie2, "https://www.messenger.com");
			}

			if (res.jsmods && Array.isArray(res.jsmods.require)) {
				const arr = res.jsmods.require;
				for (const i in arr) {
					if (arr[i][0] === "DTSG" && arr[i][1] === "setToken") {
						ctx.fb_dtsg = arr[i][3][0];
						ctx.ttstamp = "2";
						for (let j = 0; j < ctx.fb_dtsg.length; j++) {
							ctx.ttstamp += ctx.fb_dtsg.charCodeAt(j);
						}
					}
				}
			}

			if (res.error === 1357001) {
				throw new CustomError({
					message: "Facebook blocked login. Please visit https://facebook.com and check your account.",
					error: "Not logged in.",
					res: res,
					statusCode: data.statusCode,
					sourceCall: sourceCall
				});
			}
			return res;
		});
	};
}

// ——————————————————————————————
// checkLiveCookie (fixed)
// ——————————————————————————————
function checkLiveCookie(ctx, defaultFuncs) {
	return defaultFuncs
		.get("https://m.facebook.com/me", ctx.jar)
		.then(function (res) {
			// FIX: guard against undefined i_userID/userID
			const expectedID = ctx.i_userID || ctx.userID;
			if (!expectedID) {
				// can't verify, assume live (avoids false negative)
				return true;
			}
			if (res.body.indexOf(String(expectedID)) === -1) {
				throw new CustomError({
					message: "Not logged in.",
					error: "Not logged in."
				});
			}
			return true;
		});
}

// ——————————————————————————————
// Cookies / dates
// ——————————————————————————————
function saveCookies(jar) {
	return function (res) {
		let cookies = res.headers["set-cookie"] || [];
		if (!Array.isArray(cookies)) cookies = [cookies];
		cookies.forEach(function (c) {
			if (typeof c !== "string") return;
			if (c.indexOf(".facebook.com") > -1) {
				try { jar.setCookie(c, "https://www.facebook.com"); } catch (_) {}
			}
			const c2 = c.replace(/domain=\.facebook\.com/, "domain=.messenger.com");
			try { jar.setCookie(c2, "https://www.messenger.com"); } catch (_) {}
		});
		return res;
	};
}

const NUM_TO_MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NUM_TO_DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function formatDate(date) {
	let d = date.getUTCDate();
	d = d >= 10 ? d : "0" + d;
	let h = date.getUTCHours();
	h = h >= 10 ? h : "0" + h;
	let m = date.getUTCMinutes();
	m = m >= 10 ? m : "0" + m;
	let s = date.getUTCSeconds();
	s = s >= 10 ? s : "0" + s;
	return (
		NUM_TO_DAY[date.getUTCDay()] +
		", " + d + " " +
		NUM_TO_MONTH[date.getUTCMonth()] + " " +
		date.getUTCFullYear() + " " +
		h + ":" + m + ":" + s + " GMT"
	);
}

function formatCookie(arr, urlDomain) {
	// FIX: sanitize semicolon in value to avoid cookie parse failure
	const value = String(arr[1] || "").replace(/;/g, "%3B");
	return arr[0] + "=" + value + "; Path=" + arr[3] + "; Domain=" + urlDomain + ".com";
}

function formatThread(data) {
	return {
		threadID: formatID((data.thread_fbid || "").toString()),
		participants: (data.participants || []).map(formatID),
		participantIDs: (data.participants || []).map(formatID),
		name: data.name,
		nicknames: data.custom_nickname,
		snippet: data.snippet,
		snippetAttachments: data.snippet_attachments,
		snippetSender: formatID((data.snippet_sender || "").toString()),
		unreadCount: data.unread_count,
		messageCount: data.message_count,
		imageSrc: data.image_src,
		timestamp: data.timestamp,
		serverTimestamp: data.server_timestamp,
		muteUntil: data.mute_until,
		isCanonicalUser: data.is_canonical_user,
		isCanonical: data.is_canonical,
		isSubscribed: data.is_subscribed,
		folder: data.folder,
		isArchived: data.is_archived,
		recipientsLoadable: data.recipients_loadable,
		hasEmailParticipant: data.has_email_participant,
		readOnly: data.read_only,
		canReply: data.can_reply,
		cannotReplyReason: data.cannot_reply_reason,
		lastMessageTimestamp: data.last_message_timestamp,
		lastReadTimestamp: data.last_read_timestamp,
		lastMessageType: data.last_message_type,
		emoji: data.custom_like_icon,
		color: data.custom_color,
		adminIDs: data.admin_ids,
		threadType: data.thread_type
	};
}

function getType(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

function formatProxyPresence(presence, userID) {
	if (presence.lat === undefined || presence.p === undefined) return null;
	return { type: "presence", timestamp: presence.lat * 1000, userID, statuses: presence.p };
}

function formatPresence(presence, userID) {
	return { type: "presence", timestamp: presence.la * 1000, userID, statuses: presence.a };
}

// FIX: chunked to avoid stack overflow on large payloads
function decodeClientPayload(payload) {
	const CHUNK = 8192;
	let result = "";
	for (let i = 0; i < payload.length; i += CHUNK) {
		result += String.fromCharCode.apply(null, payload.slice(i, i + CHUNK));
	}
	return JSON.parse(result);
}

function getAppState(jar) {
	return jar
		.getCookies("https://www.facebook.com")
		.concat(jar.getCookies("https://facebook.com"))
		.concat(jar.getCookies("https://www.messenger.com"));
}

module.exports = {
	CustomError,
	isReadableStream,
	get,
	post,
	postFormData,
	generateThreadingID,
	generateOfflineThreadingID,
	getGUID,
	getFrom,
	makeParsable,
	arrToForm,
	getSignatureID,
	getJar: request.jar,
	generateTimestampRelative,
	makeDefaults,
	parseAndCheckLogin,
	saveCookies,
	getType,
	_formatAttachment,
	formatHistoryMessage,
	formatID,
	formatMessage,
	formatDeltaEvent,
	formatDeltaMessage,
	formatProxyPresence,
	formatPresence,
	formatTyp,
	formatDeltaReadReceipt,
	formatCookie,
	formatThread,
	formatReadReceipt,
	formatRead,
	generatePresence,
	generateAccessiblityCookie,
	formatDate,
	decodeClientPayload,
	getAppState,
	getAdminTextMessageType,
	setProxy,
	checkLiveCookie
};
/**
 * Goat Bot V2 - utils.js (Bug-fixed & Powerful Edition)
 * Original: NTKhang03
 * Enhanced: error handling, retry, timeout, performance, memory safety
 */

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const moment = require("moment-timezone");
const mimeDB = require("mime-db");
const _ = require("lodash");
const { google } = require("googleapis");
const ora = require("ora");
const log = require("./logger/log.js");
const { isHexColor, colors } = require("./func/colors.js");
const Prism = require("./func/prism.js");

const { config } = global.GoatBot;
const { gmailAccount = {} } = config.credentials || {};
const { clientId, clientSecret, refreshToken, apiKey: googleApiKey } = gmailAccount;

if (!clientId) {
	log.err("CREDENTIALS", `Please provide a valid clientId in file ${path.normalize(global.client.dirConfig)}`);
	process.exit();
}
if (!clientSecret) {
	log.err("CREDENTIALS", `Please provide a valid clientSecret in file ${path.normalize(global.client.dirConfig)}`);
	process.exit();
}
if (!refreshToken) {
	log.err("CREDENTIALS", `Please provide a valid refreshToken in file ${path.normalize(global.client.dirConfig)}`);
	process.exit();
}

const oauth2ClientForGGDrive = new google.auth.OAuth2(
	clientId, clientSecret, "https://developers.google.com/oauthplayground"
);
oauth2ClientForGGDrive.setCredentials({ refresh_token: refreshToken });

const driveApi = google.drive({ version: "v3", auth: oauth2ClientForGGDrive });

// ============ CONSTANTS ============
const word = [
	'A', 'Á', 'À', 'Ả', 'Ã', 'Ạ', 'a', 'á', 'à', 'ả', 'ã', 'ạ',
	'Ă', 'Ắ', 'Ằ', 'Ẳ', 'Ẵ', 'Ặ', 'ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ',
	'Â', 'Ấ', 'Ầ', 'Ẩ', 'Ẫ', 'Ậ', 'â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ',
	'B', 'b', 'C', 'c', 'D', 'Đ', 'd', 'đ',
	'E', 'É', 'È', 'Ẻ', 'Ẽ', 'Ẹ', 'e', 'é', 'è', 'ẻ', 'ẽ', 'ẹ',
	'Ê', 'Ế', 'Ề', 'Ể', 'Ễ', 'Ệ', 'ê', 'ế', 'ề', 'ể', 'ễ', 'ệ',
	'F', 'f', 'G', 'g', 'H', 'h',
	'I', 'Í', 'Ì', 'Ỉ', 'Ĩ', 'Ị', 'i', 'í', 'ì', 'ỉ', 'ĩ', 'ị',
	'J', 'j', 'K', 'k', 'L', 'l', 'M', 'm', 'N', 'n',
	'O', 'Ó', 'Ò', 'Ỏ', 'Õ', 'Ọ', 'o', 'ó', 'ò', 'ỏ', 'õ', 'ọ',
	'Ô', 'Ố', 'Ồ', 'Ổ', 'Ỗ', 'Ộ', 'ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ',
	'Ơ', 'Ớ', 'Ờ', 'Ở', 'Ỡ', 'Ợ', 'ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ',
	'P', 'p', 'Q', 'q', 'R', 'r', 'S', 's', 'T', 't',
	'U', 'Ú', 'Ù', 'Ủ', 'Ũ', 'Ụ', 'u', 'ú', 'ù', 'ủ', 'ũ', 'ụ',
	'Ư', 'Ứ', 'Ừ', 'Ử', 'Ữ', 'Ự', 'ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự',
	'V', 'v', 'W', 'w', 'X', 'x',
	'Y', 'Ý', 'Ỳ', 'Ỷ', 'Ỹ', 'Ỵ', 'y', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ',
	'Z', 'z', ' '
];
const wordSet = new Set(word);

const regCheckURL = /^(https?:\/\/)([\w-]+(\.[\w-]+)+)(:\d+)?(\/[^\s]*)?$/i;
const DEFAULT_TIMEOUT = 60000; // 60s
const MAX_RETRY = 3;
const TEMP_FILE_CACHE_LIMIT = 500;

// ============ HELPERS ============

class CustomError extends Error {
	constructor(obj) {
		if (typeof obj === "string") obj = { message: obj };
		if (typeof obj !== "object" || obj === null) throw new TypeError("Object required");
		obj.message ? super(obj.message) : super();
		Object.assign(this, obj);
	}
}

function lengthWhiteSpacesEndLine(text) {
	let length = 0;
	for (let i = text.length - 1; i >= 0; i--) {
		if (text[i] === " ") length++;
		else break;
	}
	return length;
}

function lengthWhiteSpacesStartLine(text) {
	let length = 0;
	for (let i = 0; i < text.length; i++) {
		if (text[i] === " ") length++;
		else break;
	}
	return length;
}

function setErrorUptime() {
	global.statusAccountBot = "block spam";
	global.responseUptimeCurrent = global.responseUptimeError;
}

const defaultStderrClearLine = process.stderr.clearLine;

/**
 * Retry wrapper for async functions
 * @param {Function} fn async function
 * @param {number} retries
 * @param {number} delay ms
 */
async function retryAsync(fn, retries = MAX_RETRY, delay = 1000) {
	let lastErr;
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			// don't retry on client errors (4xx)
			if (err?.response?.status && err.response.status < 500) break;
			if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
		}
	}
	throw lastErr;
}

// ============ TIME / FORMAT ============

function convertTime(
	miliSeconds,
	replaceSeconds = "s",
	replaceMinutes = "m",
	replaceHours = "h",
	replaceDays = "d",
	replaceMonths = "M",
	replaceYears = "y",
	notShowZero = false
) {
	if (typeof replaceSeconds === "boolean") {
		notShowZero = replaceSeconds;
		replaceSeconds = "s";
	}
	if (typeof miliSeconds !== "number" || isNaN(miliSeconds)) miliSeconds = 0;

	const second = Math.floor((miliSeconds / 1000) % 60);
	const minute = Math.floor((miliSeconds / 1000 / 60) % 60);
	const hour = Math.floor((miliSeconds / 1000 / 60 / 60) % 24);
	const day = Math.floor((miliSeconds / 1000 / 60 / 60 / 24) % 30);
	const month = Math.floor((miliSeconds / 1000 / 60 / 60 / 24 / 30) % 12);
	const year = Math.floor(miliSeconds / 1000 / 60 / 60 / 24 / 30 / 12);
	let formattedDate = "";

	const dateParts = [
		{ value: year, replace: replaceYears },
		{ value: month, replace: replaceMonths },
		{ value: day, replace: replaceDays },
		{ value: hour, replace: replaceHours },
		{ value: minute, replace: replaceMinutes },
		{ value: second, replace: replaceSeconds }
	];

	for (let i = 0; i < dateParts.length; i++) {
		const { value, replace } = dateParts[i];
		if (value) formattedDate += value + replace;
		else if (formattedDate !== "") formattedDate += "00" + replace;
		else if (i === dateParts.length - 1) formattedDate += "0" + replace;
	}

	if (formattedDate === "") formattedDate = "0" + replaceSeconds;
	if (notShowZero) formattedDate = formattedDate.replace(/(^| )00\w+/g, "").trim();

	return formattedDate || ("0" + replaceSeconds);
}

function createOraDots(text) {
	const spin = new ora({
		text,
		spinner: {
			interval: 80,
			frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
		}
	});
	spin._start = () => {
		utils.enableStderrClearLine(false);
		spin.start();
	};
	spin._stop = () => {
		utils.enableStderrClearLine(true);
		spin.stop();
	};
	return spin;
}

// ============ TASK QUEUE ============

class TaskQueue {
	constructor(callback) {
		this.queue = [];
		this.running = null;
		this.callback = callback;
	}
	push(task) {
		this.queue.push(task);
		if (this.queue.length === 1) this.next();
	}
	next() {
		if (this.queue.length === 0) return;
		const task = this.queue[0];
		this.running = task;
		try {
			this.callback(task, async () => {
				this.running = null;
				this.queue.shift();
				this.next();
			});
		} catch (err) {
			// isolate errors so queue never gets stuck
			this.running = null;
			this.queue.shift();
			setImmediate(() => this.next());
		}
	}
	length() {
		return this.queue.length;
	}
	clear() {
		this.queue = [];
		this.running = null;
	}
}

function enableStderrClearLine(isEnable = true) {
	process.stderr.clearLine = isEnable ? defaultStderrClearLine : () => {};
}

// ============ NUMBER / STRING ============

function formatNumber(number) {
	const regionCode = global.GoatBot?.config?.language || "en-US";
	if (typeof number !== "number" && typeof number !== "string") {
		throw new Error("The first argument (number) must be a number");
	}
	if (isNaN(Number(number))) {
		throw new Error("The first argument (number) must be a number");
	}
	return Number(number).toLocaleString(regionCode || "en-US");
}

function getExtFromAttachmentType(type) {
	switch (type) {
		case "photo": return "png";
		case "animated_image": return "gif";
		case "video": return "mp4";
		case "audio": return "mp3";
		default: return "txt";
	}
}

function getExtFromMimeType(mimeType = "") {
	return mimeDB[mimeType]?.extensions?.[0] || "unknown";
}

function getExtFromUrl(url = "") {
	if (!url || typeof url !== "string") throw new Error("The first argument (url) must be a string");
	try {
		const pathname = new URL(url).pathname;
		const base = pathname.split("/").pop() || "";
		const ext = base.includes(".") ? base.split(".").pop() : "";
		if (ext && /^[a-zA-Z0-9]+$/.test(ext)) return ext;
	} catch (_) {}
	// fallback regex (facebook cdn patterns)
	const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/);
	return match ? match[1] : "bin";
}

function getPrefix(threadID) {
	if (!threadID || isNaN(threadID)) throw new Error("The first argument (threadID) must be a number");
	threadID = String(threadID);
	let prefix = global.GoatBot.config.prefix;
	const threadData = global.db?.allThreadData?.find(t => t.threadID == threadID);
	if (threadData) prefix = threadData.data?.prefix || prefix;
	return prefix;
}

function getTime(timestamps, format) {
	if (!format && typeof timestamps === "string") {
		format = timestamps;
		timestamps = undefined;
	}
	return moment(timestamps).tz(config.timeZone).format(format);
}

function getType(value) {
	return Object.prototype.toString.call(value).slice(8, -1);
}

function isNumber(value) {
	return !isNaN(parseFloat(value)) && isFinite(value);
}

function jsonStringifyColor(obj, filter, indent, level) {
	indent = indent || 0;
	level = level || 0;
	let output = "";

	if (typeof obj === "string") output += colors.green(`"${obj}"`);
	else if (typeof obj === "number" || typeof obj === "boolean") output += colors.yellow(String(obj));
	else if (obj === null) output += colors.yellow("null");
	else if (obj === undefined) output += colors.gray("undefined");
	else if (typeof obj === "function") output += colors.green(obj.toString());
	else if (typeof obj === "object") {
		if (Array.isArray(obj)) {
			if (obj.length === 0) output += "[]";
			else {
				output += colors.gray("[\n");
				obj.forEach(subObj => {
					output += " ".repeat(indent + level * indent)
						+ utils.jsonStringifyColor(subObj, filter, indent, level + 1) + ",\n";
				});
				output = output.replace(/,\n$/, "\n");
				output += " ".repeat(level * indent) + colors.gray("]");
			}
		} else {
			const keys = Object.keys(obj);
			if (keys.length === 0) output += "{}";
			else {
				output += colors.gray("{\n");
				keys.forEach(key => {
					let value = obj[key];
					if (filter) {
						if (typeof filter === "function") value = filter(key, value);
						else if (Array.isArray(filter) && !filter.includes(key)) return;
					}
					if (!isNaN(Number(key[0])) || /[^a-zA-Z0-9_]/.test(key)) {
						key = colors.green(JSON.stringify(key));
					}
					output += " ".repeat(indent + level * indent)
						+ `${key}:${indent ? " " : ""}`;
					output += utils.jsonStringifyColor(value, filter, indent, level + 1) + ",\n";
				});
				output = output.replace(/,\n$/, "\n");
				output += " ".repeat(level * indent) + colors.gray("}");
			}
		}
	}

	output = output.replace(/,$/gm, colors.gray(","));
	if (indent === 0) return output.replace(/\n/g, "");
	return output;
}

// ============ MESSAGE SENDER ============

function message(api, event) {
	async function sendMessageError(err) {
		if (typeof err === "object" && !err.stack) {
			try {
				err = utils.removeHomeDir(JSON.stringify(err, null, 2));
			} catch (_) {
				err = String(err);
			}
		} else {
			err = utils.removeHomeDir(`${err?.name || err?.error || "Error"}: ${err?.message || err}`);
		}
		try {
			return await api.sendMessage(utils.getText("utils", "errorOccurred", err), event.threadID, event.messageID);
		} catch (_) {
			return null;
		}
	}

	const handleSpam = (err) => {
		if (JSON.stringify(err).includes("spam")) {
			setErrorUptime();
			throw err;
		}
		throw err;
	};

	return {
		send: async (form, callback) => {
			try {
				global.statusAccountBot = "good";
				return await api.sendMessage(form, event.threadID, callback);
			} catch (err) {
				return handleSpam(err);
			}
		},
		reply: async (form, callback) => {
			try {
				global.statusAccountBot = "good";
				return await api.sendMessage(form, event.threadID, callback, event.messageID);
			} catch (err) {
				return handleSpam(err);
			}
		},
		unsend: async (messageID, callback) => api.unsendMessage(messageID, callback),
		reaction: async (emoji, messageID, callback) => {
			try {
				global.statusAccountBot = "good";
				return await api.setMessageReaction(emoji, messageID, callback, true);
			} catch (err) {
				return handleSpam(err);
			}
		},
		err: async (err) => sendMessageError(err),
		error: async (err) => sendMessageError(err)
	};
}

// ============ RANDOM ============

function randomString(max, onlyOnce = false, possible) {
	if (!max || isNaN(max)) max = 10;
	max = Math.floor(max);
	let text = "";
	possible = possible || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	if (onlyOnce && max > possible.length) max = possible.length;
	const used = new Set();
	for (let i = 0; i < max; i++) {
		let random = Math.floor(Math.random() * possible.length);
		if (onlyOnce) {
			let guard = 0;
			while (used.has(possible[random]) && guard < 1000) {
				random = Math.floor(Math.random() * possible.length);
				guard++;
			}
		}
		used.add(possible[random]);
		text += possible[random];
	}
	return text;
}

function randomNumber(min, max) {
	if (max === undefined || max === null) {
		max = min;
		min = 0;
	}
	if (min === null || min === undefined || isNaN(min))
		throw new Error("The first argument (min) must be a number");
	if (max === null || max === undefined || isNaN(max))
		throw new Error("The second argument (max) must be a number");
	min = Number(min);
	max = Number(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function removeHomeDir(fullPath) {
	if (!fullPath || typeof fullPath !== "string")
		throw new Error("The first argument (fullPath) must be a string");
	while (fullPath.includes(process.cwd()))
		fullPath = fullPath.replace(process.cwd(), "");
	return fullPath;
}

function splitPage(arr, limit) {
	const allPage = _.chunk(arr, limit);
	return { totalPage: allPage.length, allPage };
}

// ============ TRANSLATE ============

async function translateAPI(text, lang) {
	if (!text || typeof text !== "string") return text;
	return retryAsync(async () => {
		const res = await axios.get(
			`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`,
			{ timeout: DEFAULT_TIMEOUT }
		);
		return res.data[0][0][0];
	}, MAX_RETRY, 800).catch(err => {
		throw new CustomError(err.response ? err.response.data : err);
	});
}

async function translate(text, lang) {
	if (typeof text !== "string") throw new Error("The first argument (text) must be a string");
	if (!lang) lang = "en";
	if (typeof lang !== "string") throw new Error("The second argument (lang) must be a string");

	const wordTranslate = [""];
	const wordNoTranslate = [""];
	let lastPosition = "wordTranslate";

	if (!wordSet.has(text.charAt(0))) wordNoTranslate.splice(0, 1);

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (wordSet.has(char)) {
			const lengNoTrans = wordNoTranslate.length - 1;
			const lastNoTrans = wordNoTranslate[lengNoTrans];
			if (lastNoTrans && lastNoTrans.includes("{") && !lastNoTrans.includes("}")) {
				wordNoTranslate[lengNoTrans] += char;
				continue;
			}
			const lengTrans = wordTranslate.length - 1;
			if (lastPosition === "wordTranslate") {
				wordTranslate[lengTrans] += char;
			} else {
				wordTranslate.push(char);
				lastPosition = "wordTranslate";
			}
		} else {
			const lengNoTrans = wordNoTranslate.length - 1;
			const twoWordLast = wordNoTranslate[lengNoTrans]?.slice(-2) || "";
			if (lastPosition === "wordNoTranslate") {
				if (twoWordLast === "}}") {
					wordTranslate.push("");
					wordNoTranslate.push(char);
				} else {
					wordNoTranslate[lengNoTrans] += char;
				}
			} else {
				wordNoTranslate.push(char);
				lastPosition = "wordNoTranslate";
			}
		}
	}

	const promises = wordTranslate.map(t =>
		/[^\s]/.test(t) ? utils.translateAPI(t, lang) : Promise.resolve(t)
	);
	const wordTransAfter = await Promise.all(promises);

	let output = "";
	for (let i = 0; i < wordTransAfter.length; i++) {
		let wordTrans = wordTransAfter[i];
		if (typeof wordTrans !== "string" || wordTrans.trim().length === 0) {
			output += wordTrans || "";
			if (wordNoTranslate[i] != undefined) output += wordNoTranslate[i];
			continue;
		}
		wordTrans = wordTrans.trim();
		const startSp = lengthWhiteSpacesStartLine(wordTranslate[i]);
		const endSp = lengthWhiteSpacesEndLine(wordTranslate[i]);
		output += " ".repeat(startSp) + wordTrans + " ".repeat(endSp);
		if (wordNoTranslate[i] != undefined) output += wordNoTranslate[i];
	}
	return output;
}

async function shortenURL(url) {
	try {
		const result = await axios.get(
			`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
			{ timeout: DEFAULT_TIMEOUT }
		);
		return result.data;
	} catch (err) {
		if (err.response) {
			const error = new Error();
			Object.assign(error, err.response.data);
			throw error;
		}
		throw new Error(err.message);
	}
}

// ============ FILE UTILS ============

async function downloadFile(url = "", savePath = "") {
	if (!url || typeof url !== "string") throw new Error("The first argument (url) must be a string");
	if (!savePath || typeof savePath !== "string") throw new Error("The second argument (path) must be a string");

	const tmpPath = `${savePath}.tmp-${Date.now()}`;
	try {
		const response = await retryAsync(
			() => axios.get(url, { responseType: "stream", timeout: DEFAULT_TIMEOUT, httpsAgent: agent }),
			MAX_RETRY
		);
		await new Promise((resolve, reject) => {
			const writer = fs.createWriteStream(tmpPath);
			response.data.pipe(writer);
			writer.on("finish", resolve);
			writer.on("error", reject);
			response.data.on("error", reject);
		});
		await fs.move(tmpPath, savePath, { overwrite: true });
		return savePath;
	} catch (err) {
		try { if (await fs.pathExists(tmpPath)) await fs.remove(tmpPath); } catch (_) {}
		throw new CustomError(err.response ? err.response.data : err);
	}
}

async function findUid(link) {
	if (!link || typeof link !== "string") throw new Error("The first argument (link) must be a string");

	// Method 1: seomagnifier
	try {
		const response = await axios.post(
			"https://seomagnifier.com/fbid",
			new URLSearchParams({ facebook: "1", sitelink: link }),
			{
				headers: {
					"content-type": "application/x-www-form-urlencoded; charset=UTF-8",
					Cookie: "PHPSESSID=0d8feddd151431cf35ccb0522b056dc6"
				},
				timeout: DEFAULT_TIMEOUT
			}
		);
		const id = response.data;
		if (!isNaN(id) && String(id).length > 3) return String(id).trim();
	} catch (_) {}

	// Method 2: scrape from page
	try {
		const html = await axios.get(link, {
			timeout: DEFAULT_TIMEOUT,
			headers: {
				"user-agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
			}
		});
		const $ = cheerio.load(html.data);
		const el = $('meta[property="al:android:url"]').attr("content");
		if (el) {
			const number = el.split("/").pop();
			if (number && !isNaN(number)) return number;
		}
		const uid = html.data.match(/"userID":"(\d+)"/) || html.data.match(/"entity_id":"(\d+)"/);
		if (uid) return uid[1];
	} catch (_) {}

	throw new Error("UID not found. Please try again with a valid link.");
}

async function getStreamsFromAttachment(attachments = []) {
	const streams = [];
	for (const attachment of attachments) {
		try {
			const url = attachment.url;
			if (!url) continue;
			const ext = utils.getExtFromUrl(url);
			const fileName = `${utils.randomString(10)}.${ext}`;
			const response = await axios({
				url,
				method: "GET",
				responseType: "stream",
				timeout: DEFAULT_TIMEOUT,
				httpsAgent: agent
			});
			response.data.path = fileName;
			streams.push(response.data);
		} catch (err) {
			// skip failed attachment but continue
			log.warn?.("ATTACHMENT", `Failed to get stream: ${err.message}`);
		}
	}
	return streams;
}

async function getStreamFromURL(url = "", pathName = "", options = {}) {
	if (!options && typeof pathName === "object") {
		options = pathName;
		pathName = "";
	}
	if (!url || typeof url !== "string") throw new Error("The first argument (url) must be a string");

	const response = await retryAsync(
		() =>
			axios({
				url,
				method: "GET",
				responseType: "stream",
				timeout: DEFAULT_TIMEOUT,
				httpsAgent: agent,
				...options
			}),
		MAX_RETRY
	);

	if (!pathName) {
		pathName =
			utils.randomString(10) +
			(response.headers["content-type"]
				? "." + utils.getExtFromMimeType(response.headers["content-type"])
				: ".noext");
	}
	response.data.path = pathName;
	return response.data;
}

// ============ UPLOAD ============

async function uploadImgbb(file) {
	let type = "file";
	try {
		if (!file) throw new Error("The first argument (file) must be a stream or a image url");
		if (typeof file === "string" && regCheckURL.test(file)) type = "url";

		const isStream = file && typeof file._read === "function" && typeof file._readableState === "object";
		if ((type === "url" && !regCheckURL.test(file)) || (type !== "url" && !isStream)) {
			throw new Error("The first argument (file) must be a stream or an image URL");
		}

		const res_ = await axios.get("https://imgbb.com", { timeout: DEFAULT_TIMEOUT });
		const auth_token = res_.data.match(/auth_token="([^"]+)"/)[1];
		const timestamp = Date.now();

		const res = await axios({
			method: "POST",
			url: "https://imgbb.com/json",
			headers: { "content-type": "multipart/form-data" },
			data: { source: file, type, action: "upload", timestamp, auth_token },
			timeout: DEFAULT_TIMEOUT
		});

		return res.data;
	} catch (err) {
		throw new CustomError(err.response ? err.response.data : err);
	}
}

async function uploadZippyshare(stream) {
	try {
		const res = await axios({
			method: "POST",
			url: "https://api.zippysha.re/upload",
			httpsAgent: agent,
			headers: { "Content-Type": "multipart/form-data" },
			data: { file: stream },
			timeout: DEFAULT_TIMEOUT
		});
		const fullUrl = res.data.data.file.url.full;
		const res_ = await axios({
			method: "GET",
			url: fullUrl,
			httpsAgent: agent,
			headers: {
				"user-agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
			},
			timeout: DEFAULT_TIMEOUT
		});
		const downloadUrl = res_.data.match(/id="download-url"(?:.|\n)*?href="(.+?)"/)[1];
		res.data.data.file.url.download = downloadUrl;
		return res.data;
	} catch (err) {
		throw new CustomError(err.response ? err.response.data : err);
	}
}

// ============ GOOGLE DRIVE ============

const drive = {
	default: driveApi,
	parentID: "",

	async uploadFile(fileName, mimeType, file) {
		if (!file && typeof fileName === "string") {
			file = mimeType;
			mimeType = undefined;
		}
		let response;
		try {
			response = (
				await driveApi.files.create({
					resource: { name: fileName, parents: [this.parentID] },
					media: { mimeType, body: file },
					fields: "*"
				})
			).data;
		} catch (err) {
			throw new Error((err.errors || [err]).map(e => e.message || e).join("\n"));
		}
		await utils.drive.makePublic(response.id).catch(() => {});
		return response;
	},

	async deleteFile(id) {
		if (!id || typeof id !== "string") throw new Error("The first argument (id) must be a string");
		try {
			await driveApi.files.delete({ fileId: id });
			return true;
		} catch (err) {
			throw new Error((err.errors || [err]).map(e => e.message || e).join("\n"));
		}
	},

	getUrlDownload(id = "") {
		if (!id || typeof id !== "string") throw new Error("The first argument (id) must be a string");
		return `https://docs.google.com/uc?id=${id}&export=download&confirm=t${googleApiKey ? `&key=${googleApiKey}` : ""}`;
	},

	async getFile(id, responseType) {
		if (!id || typeof id !== "string") throw new Error("The first argument (id) must be a string");
		if (!responseType) responseType = "arraybuffer";
		if (typeof responseType !== "string") throw new Error("The second argument (responseType) must be a string");

		const response = await driveApi.files.get(
			{ fileId: id, alt: "media" },
			{ responseType }
		);
		const headersResponse = response.headers;
		const fileName =
			headersResponse["content-disposition"]?.split('filename="')[1]?.split('"')[0] ||
			`${utils.randomString(10)}.${utils.getExtFromMimeType(headersResponse["content-type"])}`;

		if (responseType === "arraybuffer") return Buffer.from(response.data);
		if (responseType === "stream") {
			response.data.path = fileName;
			return response.data;
		}
		return response.data;
	},

	async getFileName(id) {
		if (!id || typeof id !== "string") throw new Error("The first argument (id) must be a string");
		if (!global.temp.filesOfGoogleDrive) global.temp.filesOfGoogleDrive = { fileNames: {} };
		if (!global.temp.filesOfGoogleDrive.fileNames) global.temp.filesOfGoogleDrive.fileNames = {};

		const cache = global.temp.filesOfGoogleDrive.fileNames;
		if (cache[id]) return cache[id];
		try {
			const { data: response } = await driveApi.files.get({ fileId: id, fields: "name" });
			cache[id] = response.name;
			// prevent unbounded memory growth
			const keys = Object.keys(cache);
			if (keys.length > TEMP_FILE_CACHE_LIMIT) {
				delete cache[keys[0]];
			}
			return response.name;
		} catch (err) {
			throw new Error((err.errors || [err]).map(e => e.message || e).join("\n"));
		}
	},

	async makePublic(id) {
		if (!id || typeof id !== "string") throw new Error("The first argument (id) must be a string");
		try {
			await driveApi.permissions.create({
				fileId: id,
				requestBody: { role: "reader", type: "anyone" }
			});
			return id;
		} catch (err) {
			const error = new Error((err.errors || [err]).map(e => e.message || e).join("\n"));
			error.name = "CAN'T_MAKE_PUBLIC";
			throw error;
		}
	},

	async checkAndCreateParentFolder(folderName) {
		if (!folderName || typeof folderName !== "string")
			throw new Error("The first argument (folderName) must be a string");
		let parentID;
		const { data: findParentFolder } = await driveApi.files.list({
			q: `name="${folderName}" and mimeType="application/vnd.google-apps.folder" and trashed=false`,
			fields: "*"
		});
		const parentFolder = findParentFolder.files.find(i => i.ownedByMe);
		if (!parentFolder) {
			const { data } = await driveApi.files.create({
				requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder" }
			});
			await driveApi.permissions.create({
				fileId: data.id,
				requestBody: { role: "reader", type: "anyone" }
			});
			parentID = data.id;
		} else if (!parentFolder.shared) {
			await driveApi.permissions.create({
				fileId: parentFolder.id,
				requestBody: { role: "reader", type: "anyone" }
			});
			parentID = parentFolder.data ? parentFolder.data.id : parentFolder.id;
		} else {
			parentID = parentFolder.id;
		}
		return parentID;
	}
};

// ============ GOATBOT API ============

class GoatBotApis {
	constructor(apiKey) {
		this.apiKey = apiKey;
		const url = "https://goatbot.tk/api";
		this.api = axios.create({
			baseURL: url,
			headers: { "x-api-key": apiKey },
			timeout: DEFAULT_TIMEOUT
		});

		this.api.interceptors.response.use(
			(response) => ({
				status: response.status,
				statusText: response.statusText,
				responseHeaders: {
					"x-remaining-requests": parseInt(response.headers["x-remaining-requests"] || 0),
					"x-free-remaining-requests": parseInt(response.headers["x-free-remaining-requests"] || 0),
					"x-used-requests": parseInt(response.headers["x-used-requests"] || 0)
				},
				data: response.data
			}),
			async (error) => {
				if (!error.response) return Promise.reject(error);
				let responseDataError;

				if (error.response.config?.responseType === "arraybuffer") {
					responseDataError = Buffer.from(error.response.data, "binary").toString("utf8");
				} else if (error.response.config?.responseType === "stream") {
					responseDataError = await new Promise((resolve) => {
						let data = "";
						error.response.data.on("data", (chunk) => (data += chunk));
						error.response.data.on("end", () => resolve(data));
						error.response.data.on("error", () => resolve(data));
					});
				} else {
					responseDataError = error.response.data;
				}

				try {
					responseDataError = JSON.parse(responseDataError);
				} catch (_) {}

				return Promise.reject({
					status: error.response.status,
					statusText: error.response.statusText,
					responseHeaders: {
						"x-remaining-requests": parseInt(error.response.headers["x-remaining-requests"] || 0),
						"x-free-remaining-requests": parseInt(error.response.headers["x-free-remaining-requests"] || 0),
						"x-used-requests": parseInt(error.response.headers["x-used-requests"] || 0)
					},
					data: responseDataError
				});
			}
		);
	}

	isSetApiKey() {
		return this.apiKey && typeof this.apiKey === "string";
	}

	getApiKey() {
		return this.apiKey;
	}

	async getAccountInfo() {
		const { data } = await this.api.get("/info");
		return data;
	}
}

// ============ EXPORTS ============

const utils = {
	CustomError,
	TaskQueue,

	colors,
	convertTime,
	createOraDots,
	defaultStderrClearLine,
	enableStderrClearLine,
	formatNumber,
	getExtFromAttachmentType,
	getExtFromMimeType,
	getExtFromUrl,
	getPrefix,
	getText: require("./languages/makeFuncGetLangs.js"),
	getTime,
	getType,
	isHexColor,
	isNumber,
	jsonStringifyColor,
	loading: require("./logger/loading.js"),
	log,
	logColor: require("./logger/logColor.js"),
	message,
	randomString,
	randomNumber,
	removeHomeDir,
	splitPage,
	translateAPI,

	// async
	downloadFile,
	findUid,
	getStreamsFromAttachment,
	getStreamFromURL,
	getStreamFromUrl: getStreamFromURL,
	Prism,
	translate,
	shortenURL,
	uploadZippyshare,
	uploadImgbb,
	drive,

	GoatBotApis,

	// helpers
	retryAsync
};

module.exports = utils;
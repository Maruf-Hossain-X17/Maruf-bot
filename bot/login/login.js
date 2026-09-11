// set bash title
process.stdout.write("\x1b]2;Maruf Bot - Based on Goat Bot V2 by NTKhang\x1b\x5c");
const defaultRequire = require;

const gradient = defaultRequire("gradient-string");
const axios = defaultRequire("axios");
const path = defaultRequire("path");
const readline = defaultRequire("readline");
const fs = defaultRequire("fs-extra");
const toptp = defaultRequire("totp-generator");
const login = defaultRequire(`${process.cwd()}/fb-chat-api`);
const qr = new (defaultRequire("qrcode-reader"))();
const Canvas = defaultRequire("canvas");
const https = defaultRequire("https");

// ============ CONFIG: disable external checks for fork ============
const ENABLE_EXTERNAL_GBAN_CHECK = false; // set true to enable
const ENABLE_EXTERNAL_NOTIFICATION = false;
const ENABLE_VERSION_TOO_OLD_CHECK = false; // fork overrides package version
const MAX_STARTBOT_DEPTH = 5;             // prevent infinite recursion
const CALLBACK_LISTEN_MAX = 50;           // cap on callbackListenTime

async function getName(userID) {
	try {
		// modern endpoint
		const { data } = await axios.get(
			`https://graph.facebook.com/${userID}?fields=name&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
			{ timeout: 10000 }
		);
		return data?.name || null;
	} catch {
		return null;
	}
}

function compareVersion(version1, version2) {
	const v1 = String(version1 || "0").split(".").map((n) => parseInt(n, 10) || 0);
	const v2 = String(version2 || "0").split(".").map((n) => parseInt(n, 10) || 0);
	const len = Math.max(v1.length, v2.length, 3);
	for (let i = 0; i < len; i++) {
		const a = v1[i] || 0;
		const b = v2[i] || 0;
		if (a > b) return 1;
		if (a < b) return -1;
	}
	return 0;
}

const { writeFileSync, readFileSync, existsSync, watch } = require("fs-extra");
const handlerWhenListenHasError = require("./handlerWhenListenHasError.js");
const checkLiveCookie = require("./checkLiveCookie.js");
const { callbackListenTime, storage5Message } = global.GoatBot;
const {
	log, logColor, getPrefix, createOraDots, jsonStringifyColor,
	getText, convertTime, colors, randomString
} = global.utils;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const currentVersion = require(`${process.cwd()}/package.json`).version;

function centerText(text, length) {
	const width = process.stdout.columns || 80;
	const textLen = length || text.length;
	const leftPadding = Math.floor((width - textLen) / 2);
	const rightPadding = width - leftPadding - textLen;
	const padded = " ".repeat(Math.max(0, leftPadding)) + text + " ".repeat(Math.max(0, rightPadding));
	console.log(padded);
}

// logo
const titles = [
	[
		"██████╗  ██████╗  █████╗ ████████╗    ██╗   ██╗██████╗",
		"██╔════╝ ██╔═══██╗██╔══██╗╚══██╔══╝    ██║   ██║╚════██╗",
		"██║  ███╗██║   ██║███████║   ██║       ██║   ██║ █████╔╝",
		"██║   ██║██║   ██║██╔══██║   ██║       ╚██╗ ██╔╝██╔═══╝",
		"╚██████╔╝╚██████╔╝██║  ██║   ██║        ╚████╔╝ ███████╗",
		"╚═════╝  ╚═════╝ ╚═╝  ╚═╝   ╚═╝         ╚═══╝  ╚══════╝"
	],
	[
		"█▀▀ █▀█ ▄▀█ ▀█▀  █▄▄ █▀█ ▀█▀  █░█ ▀█",
		"█▄█ █▄█ █▀█ ░█░  █▄█ █▄█ ░█░  ▀▄▀ █▄"
	],
	["G O A T B O T  V 2 @" + currentVersion],
	["GOATBOT V2"]
];

let widthConsole = process.stdout.columns || 80;
if (widthConsole > 50) widthConsole = 50;

function createLine(content, isMaxWidth = false) {
	if (!content) return Array(isMaxWidth ? (process.stdout.columns || 80) : widthConsole).fill("─").join("");
	content = ` ${content.trim()} `;
	const lengthContent = content.length;
	const lengthLine = (isMaxWidth ? (process.stdout.columns || 80) - lengthContent : widthConsole - lengthContent);
	let left = Math.floor(lengthLine / 2);
	if (left < 0 || isNaN(left)) left = 0;
	const lineOne = Array(left).fill("─").join("");
	return lineOne + content + lineOne;
}

const maxWidth = process.stdout.columns || 80;
const title = maxWidth > 58 ? titles[0] : maxWidth > 36 ? titles[1] : maxWidth > 26 ? titles[2] : titles[3];

console.log(gradient("#f5af19", "#f12711")(createLine(null, true)));
console.log();
for (const text of title) {
	const textColor = gradient("#FA8BFF", "#2BD2FF", "#2BFF88")(text);
	centerText(textColor, text.length);
}

let subTitle = `GoatBot V2@${currentVersion}- A simple Bot chat messenger use personal account`;
const subTitleArray = [];
if (subTitle.length > maxWidth) {
	while (subTitle.length > maxWidth) {
		let lastSpace = subTitle.slice(0, maxWidth).lastIndexOf(" ");
		lastSpace = lastSpace === -1 ? maxWidth : lastSpace;
		subTitleArray.push(subTitle.slice(0, lastSpace).trim());
		subTitle = subTitle.slice(lastSpace).trim();
	}
	if (subTitle) subTitleArray.push(subTitle);
} else subTitleArray.push(subTitle);

const author = "Created by NTKhang with ♡";
for (const t of subTitleArray) centerText(gradient("#9F98E8", "#AFF6CF")(t), t.length);
centerText(gradient("#9F98E8", "#AFF6CF")(author), author.length);

const character = createLine();

const clearLines = (n) => {
	try {
		for (let i = 0; i < n; i++) {
			const y = i === 0 ? null : -1;
			process.stdout.moveCursor(0, y);
			process.stdout.clearLine(1);
		}
		process.stdout.cursorTo(0);
		process.stdout.write("");
	} catch (_) {}
};

async function input(prompt, isPassword = false) {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	if (isPassword) {
		rl.input.on("keypress", function () {
			const len = rl.line.length;
			try {
				readline.moveCursor(rl.output, -len, 0);
				readline.clearLine(rl.output, 1);
			} catch (_) {}
			for (let i = 0; i < len; i++) rl.output.write("*");
		});
	}

	return new Promise((resolve) =>
		rl.question(prompt, (ans) => {
			rl.close();
			resolve(ans);
		})
	);
}

qr.readQrCode = async function (filePath) {
	const image = await Canvas.loadImage(filePath);
	const canvas = Canvas.createCanvas(image.width, image.height);
	const ctx = canvas.getContext("2d");
	ctx.drawImage(image, 0, 0);
	const data = ctx.getImageData(0, 0, image.width, image.height);
	return new Promise((resolve, reject) => {
		qr.callback = function (error, result) {
			if (error) reject(error);
			else resolve(result.result);
		};
		qr.decode(data);
	});
};

const { dirAccount } = global.client;
const { facebookAccount } = global.GoatBot.config;

function responseUptimeSuccess(req, res) {
	res.type("json").send({ status: "success", uptime: process.uptime(), unit: "seconds" });
}

function responseUptimeError(req, res) {
	res.status(500).type("json").send({
		status: "error",
		uptime: process.uptime(),
		statusAccountBot: global.statusAccountBot
	});
}

function checkAndTrimString(string) {
	return typeof string === "string" ? string.trim() : string;
}

function filterKeysAppState(appState) {
	return appState.filter((item) => ["c_user", "xs", "datr", "fr", "sb", "i_user"].includes(item.key));
}

global.responseUptimeCurrent = responseUptimeSuccess;
global.responseUptimeSuccess = responseUptimeSuccess;
global.responseUptimeError = responseUptimeError;

global.statusAccountBot = "good";
let changeFbStateByCode = false;
let latestChangeContentAccount = fs.statSync(dirAccount).mtimeMs;
let dashBoardIsRunning = false;
let accountWatcher = null; // single watcher, not duplicated
let startBotDepth = 0;

// ————— CACHE handlerAction (fix #1) —————
let cachedHandlerAction = null;
function getHandlerAction(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
	if (cachedHandlerAction) return cachedHandlerAction;
	cachedHandlerAction = require("../handler/handlerAction.js")(
		api, threadModel, userModel, dashBoardModel, globalModel,
		usersData, threadsData, dashBoardData, globalData
	);
	return cachedHandlerAction;
}

// ————— spin helper (fix #3) —————
function startSpin(text) {
	const spin = createOraDots(text);
	try { spin._start(); } catch (_) {}
	return spin;
}

async function getAppStateFromEmail(spin, fbAccount) {
	const { email, password, userAgent, proxy } = fbAccount;
	const getFbstate = require("./getFbstate1.js");
	let code2FATemp;
	let appState;

	try {
		try {
			appState = await getFbstate(checkAndTrimString(email), checkAndTrimString(password), userAgent, proxy);
			spin?._stop();
		} catch (err) {
			if (err.continue) {
				let tryNumber = 0;
				let isExit = false;

				await (async function submitCode(message) {
					if (message && isExit) {
						spin?._stop();
						log.error("LOGIN FACEBOOK", message);
						process.exit();
					}
					if (message) {
						spin?._stop();
						log.warn("LOGIN FACEBOOK", message);
					}

					if (fbAccount["2FASecret"] && tryNumber === 0) {
						if ([".png", ".jpg", ".jpeg"].some((i) => fbAccount["2FASecret"].endsWith(i))) {
							const qrResult = await qr.readQrCode(`${process.cwd()}/${fbAccount["2FASecret"]}`);
							code2FATemp = qrResult.replace(/.*secret=(.*)&digits.*/g, "$1");
						} else code2FATemp = fbAccount["2FASecret"];
					} else {
						spin?._stop();
						code2FATemp = await input("> Enter 2FA code or secret: ");
						try {
							readline.moveCursor(process.stderr, 0, -1);
							readline.clearScreenDown(process.stderr);
						} catch (_) {}
					}

					const code2FA = isNaN(code2FATemp)
						? toptp(
								String(code2FATemp)
									.normalize("NFD")
									.toLowerCase()
									.replace(/[\u0300-\u036f]/g, "")
									.replace(/[đ|Đ]/g, (x) => (x === "đ" ? "d" : "D"))
									.replace(/\(|\)|\,/g, "")
									.replace(/ /g, "")
							)
						: code2FATemp;
					spin?._start();
					try {
						appState = JSON.parse(JSON.stringify(await err.continue(code2FA)));
						appState = appState
							.map((item) => ({
								key: item.key,
								value: item.value,
								domain: item.domain,
								path: item.path,
								hostOnly: item.hostOnly,
								creation: item.creation,
								lastAccessed: item.lastAccessed
							}))
							.filter((item) => item.key);
						spin?._stop();
					} catch (err2) {
						tryNumber++;
						if (!err2.continue) isExit = true;
						await submitCode(err2.message);
					}
				})(err.message);
			} else throw err;
		}
	} catch (err) {
		const loginMbasic = require("./loginMbasic.js");
		if (fbAccount["2FASecret"]) {
			if ([".png", ".jpg", ".jpeg"].some((i) => fbAccount["2FASecret"].endsWith(i))) {
				const qrResult = await qr.readQrCode(`${process.cwd()}/${fbAccount["2FASecret"]}`);
				code2FATemp = qrResult.replace(/.*secret=(.*)&digits.*/g, "$1");
			} else code2FATemp = fbAccount["2FASecret"];
		}

		appState = await loginMbasic({
			email,
			pass: password,
			twoFactorSecretOrCode: code2FATemp,
			userAgent,
			proxy
		});

		appState = appState.map((item) => {
			item.key = item.name;
			delete item.name;
			return item;
		});
		appState = filterKeysAppState(appState);
	}

	global.GoatBot.config.facebookAccount["2FASecret"] = code2FATemp || "";
	writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
	return appState;
}

function isNetScapeCookie(cookie) {
	if (typeof cookie !== "string") return false;
	return /(.+)\t(1|TRUE|true)\t([\w\/.-]*)\t(1|TRUE|true)\t\d+\t([\w-]+)\t(.+)/i.test(cookie);
}

function netScapeToCookies(cookieData) {
	const cookies = [];
	const lines = cookieData.split("\n");
	lines.forEach((line) => {
		if (line.trim().startsWith("#")) return;
		const fields = line.split("\t").map((f) => f.trim()).filter((f) => f.length > 0);
		if (fields.length < 7) return;
		cookies.push({
			key: fields[5],
			value: fields[6],
			domain: fields[0],
			path: fields[2],
			hostOnly: fields[1] === "TRUE",
			creation: new Date(fields[4] * 1000).toISOString(),
			lastAccessed: new Date().toISOString()
		});
	});
	return cookies;
}

function pushI_user(appState, value) {
	// remove existing i_user first to avoid duplicates
	appState = appState.filter((c) => c.key !== "i_user");
	appState.push({
		key: "i_user",
		value: value || facebookAccount.i_user,
		domain: "facebook.com",
		path: "/",
		hostOnly: false,
		creation: new Date().toISOString(),
		lastAccessed: new Date().toISOString()
	});
	return appState;
}

let spin;
async function getAppStateToLogin(loginWithEmail) {
	let appState = [];
	if (loginWithEmail) return await getAppStateFromEmail(undefined, facebookAccount);

	if (!existsSync(dirAccount))
		return log.error("LOGIN FACEBOOK", getText("login", "notFoundDirAccount", colors.green(dirAccount)));

	const accountText = readFileSync(dirAccount, "utf8");

	try {
		const splitAccountText = accountText.replace(/\|/g, "\n").split("\n").map((i) => i.trim()).filter((i) => i);

		if (accountText.startsWith("EAAAA")) {
			try {
				spin = startSpin(getText("login", "loginToken"));
				appState = await require("./getFbstate.js")(accountText);
			} catch (err) {
				err.name = "TOKEN_ERROR";
				throw err;
			}
		} else if (accountText.match(/^(?:\s*\w+\s*=\s*[^;]*;?)+/)) {
			spin = startSpin(getText("login", "loginCookieString"));
			appState = accountText
				.split(";")
				.map((i) => {
					const [key, ...rest] = i.split("=");
					return {
						key: (key || "").trim(),
						value: rest.join("=").trim(),
						domain: "facebook.com",
						path: "/",
						hostOnly: true,
						creation: new Date().toISOString(),
						lastAccessed: new Date().toISOString()
					};
				})
				.filter((i) => i.key && i.value && i.key !== "x-referer");
		} else if (isNetScapeCookie(accountText)) {
			spin = startSpin(getText("login", "loginCookieNetscape"));
			appState = netScapeToCookies(accountText);
		} else if (
			(splitAccountText.length === 2 || splitAccountText.length === 3) &&
			!splitAccountText.slice(0, 2).map((i) => i.trim()).some((i) => i.includes(" "))
		) {
			// email/password format
			global.GoatBot.config.facebookAccount.email = splitAccountText[0];
			global.GoatBot.config.facebookAccount.password = splitAccountText[1];
			if (splitAccountText[2]) {
				const code2FATemp = splitAccountText[2].replace(/ /g, "");
				global.GoatBot.config.facebookAccount["2FASecret"] = code2FATemp;
			}
			writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
		} else {
			try {
				spin = startSpin(getText("login", "loginCookieArray"));
				appState = JSON.parse(accountText);
			} catch (err) {
				const error = new Error(`${path.basename(dirAccount)} is invalid`);
				error.name = "ACCOUNT_ERROR";
				throw error;
			}
			if (appState.some((i) => i.name)) {
				appState = appState.map((i) => {
					i.key = i.name;
					delete i.name;
					return i;
				});
			} else if (!appState.some((i) => i.key)) {
				const error = new Error(`${path.basename(dirAccount)} is invalid`);
				error.name = "ACCOUNT_ERROR";
				throw error;
			}
			appState = appState
				.map((item) => ({
					...item,
					domain: "facebook.com",
					path: "/",
					hostOnly: false,
					creation: new Date().toISOString(),
					lastAccessed: new Date().toISOString()
				}))
				.filter((i) => i.key && i.value && i.key !== "x-referer");
		}

		if (!(await checkLiveCookie(appState.map((i) => i.key + "=" + i.value).join("; "), facebookAccount.userAgent))) {
			const error = new Error("Cookie is invalid");
			error.name = "COOKIE_INVALID";
			throw error;
		}
	} catch (err) {
		spin?._stop();
		let { email, password } = facebookAccount;

		if (err.name === "TOKEN_ERROR")
			log.err("LOGIN FACEBOOK", getText("login", "tokenError", colors.green("EAAAA..."), colors.green(dirAccount)));
		else if (err.name === "COOKIE_INVALID")
			log.err("LOGIN FACEBOOK", getText("login", "cookieError"));

		if (!email || !password) {
			log.warn("LOGIN FACEBOOK", getText("login", "cannotFindAccount"));
			const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
			const options = [
				getText("login", "chooseAccount"),
				getText("login", "chooseToken"),
				getText("login", "chooseCookieString"),
				getText("login", "chooseCookieArray")
			];
			let currentOption = 0;

			await new Promise((resolve) => {
				const character = ">";
				function showOptions() {
					rl.output.write(
						`\r${options
							.map((option, index) => (index === currentOption ? colors.blueBright(`${character} (${index + 1}) ${option}`) : `  (${index + 1}) ${option}`))
							.join("\n")}\u001B`
					);
					rl.write("\u001B[?25l");
				}
				rl.input.on("keypress", (_, key) => {
					if (key.name === "up") currentOption = (currentOption - 1 + options.length) % options.length;
					else if (key.name === "down") currentOption = (currentOption + 1) % options.length;
					else if (!isNaN(key.name)) {
						const number = parseInt(key.name, 10);
						if (number >= 0 && number <= options.length) currentOption = number - 1;
						process.stdout.write("\033[1D");
					} else if (key.name === "enter" || key.name === "return") {
						rl.input.removeAllListeners("keypress");
						rl.close();
						clearLines(options.length + 1);
						showOptions();
						resolve();
					} else process.stdout.write("\033[1D");
					clearLines(options.length);
					showOptions();
				});
				showOptions();
			});

			rl.write("\u001B[?25h\n");
			clearLines(options.length + 1);
			log.info("LOGIN FACEBOOK", getText("login", "loginWith", options[currentOption]));

			if (currentOption === 0) {
				email = await input(`${getText("login", "inputEmail")} `);
				password = await input(`${getText("login", "inputPassword")} `, true);
				const twoFactorAuth = await input(`${getText("login", "input2FA")} `);
				facebookAccount.email = email || "";
				facebookAccount.password = password || "";
				facebookAccount["2FASecret"] = twoFactorAuth || "";
				writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
			} else if (currentOption === 1) {
				const token = await input(getText("login", "inputToken") + " ");
				writeFileSync(global.client.dirAccount, token);
			} else if (currentOption === 2) {
				const cookie = await input(getText("login", "inputCookieString") + " ");
				writeFileSync(global.client.dirAccount, cookie);
			} else {
				const cookie = await input(getText("login", "inputCookieArray") + " ");
				writeFileSync(global.client.dirAccount, JSON.stringify(JSON.parse(cookie), null, 2));
			}
			return await getAppStateToLogin();
		}

		log.info("LOGIN FACEBOOK", getText("login", "loginPassword"));
		log.info("ACCOUNT INFO", `Email: ${facebookAccount.email}, I_User: ${facebookAccount.i_user || "(empty)"}`);
		spin = startSpin(getText("login", "loginPassword"));

		try {
			appState = await getAppStateFromEmail(spin, facebookAccount);
			spin._stop();
		} catch (err) {
			spin._stop();
			log.err("LOGIN FACEBOOK", getText("login", "loginError"), err.message, err);
			process.exit();
		}
	}
	return appState;
}

function stopListening(keyListen) {
	keyListen = keyListen || Object.keys(callbackListenTime).pop();
	return new Promise((resolve) => {
		const done = () => {
			if (callbackListenTime[keyListen]) callbackListenTime[keyListen] = () => {};
			resolve();
		};
		try {
			if (global.GoatBot.fcaApi?.stopListening) global.GoatBot.fcaApi.stopListening(done);
			else done();
		} catch (_) {
			done();
		}
	});
}

// prune old listeners
function pruneCallbackListen() {
	const keys = Object.keys(callbackListenTime);
	if (keys.length <= CALLBACK_LISTEN_MAX) return;
	for (let i = 0; i < keys.length - CALLBACK_LISTEN_MAX + 10; i++) {
		delete callbackListenTime[keys[i]];
	}
}

async function startBot(loginWithEmail) {
	if (startBotDepth++ > MAX_STARTBOT_DEPTH) {
		log.err("LOGIN", "Max restart depth reached. Exiting.");
		process.exit(2);
	}

	console.log(colors.hex("#f5ab00")(createLine("START LOGGING IN", true)));

	// version too-old check — disabled for fork
	if (ENABLE_VERSION_TOO_OLD_CHECK) {
		try {
			const tooOldVersion = (await axios.get(
				"https://raw.githubusercontent.com/ntkhang03/Goat-Bot-V2-Storage/main/tooOldVersions.txt",
				{ timeout: 10000 }
			)).data || "0.0.0";
			if ([-1, 0].includes(compareVersion(currentVersion, tooOldVersion))) {
				log.err("VERSION", getText("version", "tooOldVersion", colors.yellowBright("node update")));
				process.exit();
			}
		} catch (_) {}
	}

	if (global.GoatBot.Listening) await stopListening();

	log.info("LOGIN FACEBOOK", getText("login", "currentlyLogged"));

	let appState = await getAppStateToLogin(loginWithEmail);
	changeFbStateByCode = true;
	appState = filterKeysAppState(appState);
	writeFileSync(dirAccount, JSON.stringify(appState, null, 2));
	setTimeout(() => (changeFbStateByCode = false), 1000);

	// ——————————————————— LOGIN ———————————————————— //
	(function loginBot(appState) {
		global.GoatBot.commands = new Map();
		global.GoatBot.eventCommands = new Map();
		global.GoatBot.aliases = new Map();
		global.GoatBot.onChat = [];
		global.GoatBot.onEvent = [];
		global.GoatBot.onReply = new Map();
		global.GoatBot.onReaction = new Map();
		clearInterval(global.intervalRestartListenMqtt);
		delete global.intervalRestartListenMqtt;

		if (facebookAccount.i_user) appState = pushI_user(appState, facebookAccount.i_user);

		let isSendNotiErrorMessage = false;

		login({ appState }, global.GoatBot.config.optionsFca, async function (error, api) {
			// refresh cookie scheduler
			if (!isNaN(facebookAccount.intervalGetNewCookie) && facebookAccount.intervalGetNewCookie > 0) {
				if (facebookAccount.email && facebookAccount.password) {
					spin?._stop();
					log.info("REFRESH COOKIE", getText("login", "refreshCookieAfter", convertTime(facebookAccount.intervalGetNewCookie * 60 * 1000, true)));
					setTimeout(async function refreshCookie() {
						try {
							log.info("REFRESH COOKIE", getText("login", "refreshCookie"));
							let newAppState = await getAppStateFromEmail(undefined, facebookAccount);
							if (facebookAccount.i_user) newAppState = pushI_user(newAppState, facebookAccount.i_user);
							changeFbStateByCode = true;
							writeFileSync(dirAccount, JSON.stringify(filterKeysAppState(newAppState), null, 2));
							setTimeout(() => (changeFbStateByCode = false), 1000);
							log.info("REFRESH COOKIE", getText("login", "refreshCookieSuccess"));
							return startBot(newAppState);
						} catch (err) {
							log.err("REFRESH COOKIE", getText("login", "refreshCookieError"), err.message, err);
							setTimeout(refreshCookie, facebookAccount.intervalGetNewCookie * 60 * 1000);
						}
					}, facebookAccount.intervalGetNewCookie * 60 * 1000);
				} else {
					spin?._stop();
					log.warn("REFRESH COOKIE", getText("login", "refreshCookieWarning"));
				}
			}
			spin?._stop();

			if (error) {
				log.err("LOGIN FACEBOOK", getText("login", "loginError"), error);
				global.statusAccountBot = "can't login";
				if (facebookAccount.email && facebookAccount.password) return startBot(true);
				return;
			}

			global.GoatBot.fcaApi = api;
			global.GoatBot.botID = api.getCurrentUserID();
			global.botID = global.GoatBot.botID;
			log.info("LOGIN FACEBOOK", getText("login", "loginSuccess"));

			let hasBanned = false;
			logColor("#f5ab00", createLine("BOT INFO"));
			log.info("NODE VERSION", process.version);
			log.info("PROJECT VERSION", currentVersion);
			log.info("BOT ID", `${global.botID} - ${await getName(global.botID)}`);
			log.info("PREFIX", global.GoatBot.config.prefix);
			log.info("LANGUAGE", global.GoatBot.config.language);
			log.info("BOT NICK NAME", global.GoatBot.config.nickNameBot || "GOAT BOT");

			// ———————————————————— GBAN ————————————————————— //
			let dataGban = {};

			if (ENABLE_EXTERNAL_GBAN_CHECK) {
				try {
					const item = await axios.get(
						"https://raw.githubusercontent.com/ntkhang03/Goat-Bot-V2-Gban/master/gban.json",
						{ timeout: 10000 }
					);
					dataGban = item.data || {};

					const botID = api.getCurrentUserID();
					const checkBan = (id) => {
						if (!dataGban.hasOwnProperty(id)) return false;
						const info = dataGban[id];
						if (!info.toDate) {
							log.err("GBAN", getText("login", "gbanMessage", info.date, info.reason, info.date));
							return true;
						}
						return false;
					};
					if (checkBan(botID)) hasBanned = true;
					for (const idad of global.GoatBot.config.adminBot) if (checkBan(idad)) hasBanned = true;
					if (hasBanned) process.exit();
				} catch (e) {
					log.warn("GBAN", getText("login", "checkGbanError"));
				}
			}

			// ———————————————— NOTIFICATIONS ———————————————— //
			let notification = "";
			if (ENABLE_EXTERNAL_NOTIFICATION) {
				try {
					const getNoti = await axios.get(
						"https://raw.githubusercontent.com/ntkhang03/Goat-Bot-V2-Gban/master/notification.txt",
						{ timeout: 10000 }
					);
					notification = getNoti.data;
				} catch (_) {
					notification = "";
				}
			}

			if (global.GoatBot.config.autoRefreshFbstate === true) {
				changeFbStateByCode = true;
				try {
					writeFileSync(dirAccount, JSON.stringify(filterKeysAppState(api.getAppState()), null, 2));
					log.info("REFRESH FBSTATE", getText("login", "refreshFbstateSuccess", path.basename(dirAccount)));
				} catch (err) {
					log.warn("REFRESH FBSTATE", getText("login", "refreshFbstateError", path.basename(dirAccount)), err);
				}
				setTimeout(() => (changeFbStateByCode = false), 1000);
			}

			if (hasBanned) {
				log.err("GBAN", getText("login", "youAreBanned"));
				process.exit();
			}

			// ————————————— LOAD DATA / SCRIPTS ————————————— //
			const {
				threadModel, userModel, dashBoardModel, globalModel,
				threadsData, usersData, dashBoardData, globalData, sequelize
			} = await require("./loadData.js")(api, createLine);

			await require("../custom.js")({
				api, threadModel, userModel, dashBoardModel, globalModel,
				threadsData, usersData, dashBoardData, globalData, getText
			});

			await require("./loadScripts.js")(
				api, threadModel, userModel, dashBoardModel, globalModel,
				threadsData, usersData, dashBoardData, globalData, createLine
			);

			// ————— AUTO LOAD SCRIPTS ————— //
			if (global.GoatBot.config.autoLoadScripts?.enable === true) {
				const ignoreCmds = (global.GoatBot.config.autoLoadScripts.ignoreCmds || "").replace(/[ ,]+/g, " ").trim().split(" ").filter(Boolean);
				const ignoreEvents = (global.GoatBot.config.autoLoadScripts.ignoreEvents || "").replace(/[ ,]+/g, " ").trim().split(" ").filter(Boolean);

				watch(`${process.cwd()}/scripts/cmds`, async (event, filename) => {
					if (!filename?.endsWith(".js")) return;
					if (ignoreCmds.includes(filename) || filename.endsWith(".eg.js")) return;
					if ((event === "change" || event === "rename") && existsSync(`${process.cwd()}/scripts/cmds/${filename}`)) {
						try {
							const contentCommand = global.temp.contentScripts.cmds[filename] || "";
							const currentContent = readFileSync(`${process.cwd()}/scripts/cmds/${filename}`, "utf-8");
							if (contentCommand === currentContent) return;
							global.temp.contentScripts.cmds[filename] = currentContent;
							filename = filename.replace(".js", "");
							const infoLoad = global.utils.loadScripts(
								"cmds", filename, log, global.GoatBot.configCommands, api,
								threadModel, userModel, dashBoardModel, globalModel,
								threadsData, usersData, dashBoardData, globalData
							);
							if (infoLoad.status === "success")
								log.master("AUTO LOAD SCRIPTS", `Command ${filename}.js (${infoLoad.command.config.name}) reloaded`);
							else log.err("AUTO LOAD SCRIPTS", `Error reload ${filename}.js`, infoLoad.error);
						} catch (err) {
							log.err("AUTO LOAD SCRIPTS", `Error ${filename}.js`, err);
						}
					}
				});

				watch(`${process.cwd()}/scripts/events`, async (event, filename) => {
					if (!filename?.endsWith(".js")) return;
					if (ignoreEvents.includes(filename) || filename.endsWith(".eg.js")) return;
					if ((event === "change" || event === "rename") && existsSync(`${process.cwd()}/scripts/events/${filename}`)) {
						try {
							const contentEvent = global.temp.contentScripts.events[filename] || "";
							const currentContent = readFileSync(`${process.cwd()}/scripts/events/${filename}`, "utf-8");
							if (contentEvent === currentContent) return;
							global.temp.contentScripts.events[filename] = currentContent;
							filename = filename.replace(".js", "");
							const infoLoad = global.utils.loadScripts(
								"events", filename, log, global.GoatBot.configCommands, api,
								threadModel, userModel, dashBoardModel, globalModel,
								threadsData, usersData, dashBoardData, globalData
							);
							if (infoLoad.status === "success")
								log.master("AUTO LOAD SCRIPTS", `Event ${filename}.js (${infoLoad.command.config.name}) reloaded`);
							else log.err("AUTO LOAD SCRIPTS", `Error reload ${filename}.js`, infoLoad.error);
						} catch (err) {
							log.err("AUTO LOAD SCRIPTS", `Error ${filename}.js`, err);
						}
					}
				});
			}

			// ——————————————— DASHBOARD ——————————————— //
			if (global.GoatBot.config.dashBoard?.enable === true && dashBoardIsRunning === false) {
				logColor("#f5ab00", createLine("DASHBOARD"));
				try {
					await require("../../dashboard/app.js")(api);
					log.info("DASHBOARD", getText("login", "openDashboardSuccess"));
					dashBoardIsRunning = true;
				} catch (err) {
					log.err("DASHBOARD", getText("login", "openDashboardError"), err);
				}
			}

			// ——————————————— ADMIN BOT LIST ——————————————— //
			logColor("#f5ab00", character);
			let i = 0;
			const adminBot = global.GoatBot.config.adminBot.filter((item) => !isNaN(item)).map(String);
			for (const uid of adminBot) {
				try {
					const userName = await usersData.getName(uid);
					log.master("ADMINBOT", `[${++i}] ${uid} | ${userName}`);
				} catch {
					log.master("ADMINBOT", `[${++i}] ${uid}`);
				}
			}
			log.master("NOTIFICATION", (notification || "").trim());
			log.master("SUCCESS", getText("login", "runBot"));
			log.master("LOAD TIME", `${convertTime(Date.now() - global.GoatBot.startTime)}`);
			logColor("#f5ab00", createLine("COPYRIGHT"));
			console.log(
				`\x1b[1m\x1b[33m${"COPYRIGHT:"}\x1b[0m\x1b[1m\x1b[37m \x1b[0m\x1b[1m\x1b[36m${"Project GoatBot v2 created by ntkhang03 (https://github.com/ntkhang03), please do not sell this source code or claim it as your own. Thank you!"}\x1b[0m`
			);
			logColor("#f5ab00", character);
			global.GoatBot.config.adminBot = adminBot;
			writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
			writeFileSync(global.client.dirConfigCommands, JSON.stringify(global.GoatBot.configCommands, null, 2));

			const { restartListenMqtt } = global.GoatBot.config;
			let intervalCheckLiveCookieAndRelogin = false;

			// —————————————— CALLBACK LISTEN —————————————— //
			async function callBackListen(error, event) {
				if (error) {
					global.responseUptimeCurrent = responseUptimeError;

					if (
						error.error === "Not logged in" ||
						error.error === "Not logged in." ||
						error.error === "Connection refused: Server unavailable"
					) {
						log.err("NOT LOGGEG IN", getText("login", "notLoggedIn"), error);
						global.responseUptimeCurrent = responseUptimeError;
						global.statusAccountBot = "can't login";
						if (!isSendNotiErrorMessage) {
							await handlerWhenListenHasError({
								api, threadModel, userModel, dashBoardModel, globalModel,
								threadsData, usersData, dashBoardData, globalData, error
							});
							isSendNotiErrorMessage = true;
						}

						if (global.GoatBot.config.autoRestartWhenListenMqttError) process.exit(2);
						else {
							const keyListen = Object.keys(callbackListenTime).pop();
							if (callbackListenTime[keyListen]) callbackListenTime[keyListen] = () => {};
							const cookieString = appState.map((i) => i.key + "=" + i.value).join("; ");

							let times = 5;
							const spinLocal = createOraDots(getText("login", "retryCheckLiveCookie", times));
							const countTimes = setInterval(() => {
								times--;
								if (times === 0) times = 5;
								spinLocal.text = getText("login", "retryCheckLiveCookie", times);
							}, 1000);

							if (intervalCheckLiveCookieAndRelogin === false) {
								intervalCheckLiveCookieAndRelogin = true;
								const interval = setInterval(async () => {
									const cookieIsLive = await checkLiveCookie(cookieString, facebookAccount.userAgent);
									if (cookieIsLive) {
										clearInterval(interval);
										clearInterval(countTimes);
										spinLocal._stop?.();
										intervalCheckLiveCookieAndRelogin = false;
										const keyListen2 = Date.now();
										isSendNotiErrorMessage = false;
										global.GoatBot.Listening = api.listenMqtt(createCallBackListen(keyListen2));
									}
								}, 5000);
							}
						}
						return;
					} else if (error === "Connection closed." || error === "Connection closed by user.") {
						return;
					} else {
						await handlerWhenListenHasError({
							api, threadModel, userModel, dashBoardModel, globalModel,
							threadsData, usersData, dashBoardData, globalData, error
						});
						return log.err("LISTEN_MQTT", getText("login", "callBackError"), error);
					}
				}

				global.responseUptimeCurrent = responseUptimeSuccess;
				global.statusAccountBot = "good";
				const configLog = global.GoatBot.config.logEvents;
				if (isSendNotiErrorMessage) isSendNotiErrorMessage = false;

				// whitelist checks (with safe array access)
				const wlMode = global.GoatBot.config.whiteListMode;
				const wlThread = global.GoatBot.config.whiteListModeThread;
				const adminList = global.GoatBot.config.adminBot || [];
				const isAdmin = adminList.includes(event.senderID);

				if (!isAdmin) {
					if (
						wlMode?.enable === true && wlThread?.enable === true &&
						!wlMode.whiteListIds?.includes(event.senderID) &&
						!wlThread.whiteListThreadIds?.includes(event.threadID)
					) return;
					else if (wlMode?.enable === true && !wlMode.whiteListIds?.includes(event.senderID)) return;
					else if (wlThread?.enable === true && !wlThread.whiteListThreadIds?.includes(event.threadID)) return;
				}

				// listen loop detection
				if (event.messageID && event.type === "message") {
					if (storage5Message.includes(event.messageID)) {
						Object.keys(callbackListenTime).slice(0, -1).forEach((key) => {
							callbackListenTime[key] = () => {};
						});
					} else storage5Message.push(event.messageID);
					if (storage5Message.length > 5) storage5Message.shift();
				}

				if (configLog.disableAll === false && configLog[event.type] !== false) {
					const participantIDs_ = [...(event.participantIDs || [])];
					if (event.participantIDs) event.participantIDs = "Array(" + event.participantIDs.length + ")";
					console.log(colors.green((event.type || "").toUpperCase() + ":"), jsonStringifyColor(event, null, 2));
					if (event.participantIDs) event.participantIDs = participantIDs_;
				}

				if ((event.senderID && dataGban[event.senderID]) || (event.userID && dataGban[event.userID])) {
					if (event.body && event.threadID) {
						const prefix = getPrefix(event.threadID);
						if (event.body.startsWith(prefix)) return api.sendMessage(getText("login", "userBanned"), event.threadID);
						return;
					}
					return;
				}

				// cached handlerAction (fix #1)
				const handlerAction = getHandlerAction(
					api, threadModel, userModel, dashBoardModel, globalModel,
					usersData, threadsData, dashBoardData, globalData
				);

				if (hasBanned === false) handlerAction(event);
				else return log.err("GBAN", getText("login", "youAreBanned"));
			}

			function createCallBackListen(key) {
				key = randomString(10) + (key || Date.now());
				callbackListenTime[key] = callBackListen;
				pruneCallbackListen();
				return function (error, event) {
					const cb = callbackListenTime[key];
					if (typeof cb === "function") cb(error, event);
				};
			}

			await stopListening();
			global.GoatBot.Listening = api.listenMqtt(createCallBackListen());
			global.GoatBot.callBackListen = callBackListen;

			// ————————————— UPTIME SERVER ————————————— //
			if (
				global.GoatBot.config.serverUptime.enable === true &&
				!global.GoatBot.config.dashBoard?.enable &&
				!global.serverUptimeRunning
			) {
				const http = require("http");
				const express = require("express");
				const app = express();
				const server = http.createServer(app);
				const PORT = global.GoatBot.config.dashBoard?.port || (!isNaN(global.GoatBot.config.serverUptime.port) && global.GoatBot.config.serverUptime.port) || 3001;
				app.get("/uptime", (req, res) => global.responseUptimeCurrent(req, res));
				try {
					if (global.GoatBot.config.serverUptime.socket?.enable === true) require("./socketIO.js")(server);
					server.listen(PORT, () => log.info("UPTIME", `Server running on port ${PORT}`));
					global.serverUptimeRunning = true;
				} catch (err) {
					log.err("UPTIME", getText("login", "openServerUptimeError"), err);
				}
			}

			// ————————————— RESTART LISTEN ————————————— //
			if (restartListenMqtt.enable === true) {
				if (restartListenMqtt.logNoti === true) {
					log.info("LISTEN_MQTT", getText("login", "restartListenMessage", convertTime(restartListenMqtt.timeRestart, true)));
					log.info("BOT_STARTED", getText("login", "startBotSuccess"));
					logColor("#f5ab00", character);
				}
				const restart = setInterval(async function () {
					if (restartListenMqtt.enable === false) {
						clearInterval(restart);
						return log.warn("LISTEN_MQTT", getText("login", "stopRestartListenMessage"));
					}
					try {
						await stopListening();
						await sleep(1000);
						global.GoatBot.Listening = api.listenMqtt(createCallBackListen());
						log.info("LISTEN_MQTT", getText("login", "restartListenMessage2"));
					} catch (e) {
						log.err("LISTEN_MQTT", getText("login", "restartListenMessageError"), e);
					}
				}, restartListenMqtt.timeRestart);
				global.intervalRestartListenMqtt = restart;
			}
			require("../autoUptime.js");
		});
	})(appState);

	// ————— single account watcher (fix #2) ————— //
	if (global.GoatBot.config.autoReloginWhenChangeAccount && !accountWatcher) {
		setTimeout(() => {
			accountWatcher = watch(dirAccount, async (type) => {
				if (
					type === "change" &&
					changeFbStateByCode === false &&
					latestChangeContentAccount !== fs.statSync(dirAccount).mtimeMs
				) {
					clearInterval(global.intervalRestartListenMqtt);
					global.compulsoryStopLisening = true;
					latestChangeContentAccount = fs.statSync(dirAccount).mtimeMs;
					startBot();
				}
			});
		}, 10000);
	}
}

global.GoatBot.reLoginBot = startBot;
startBot();
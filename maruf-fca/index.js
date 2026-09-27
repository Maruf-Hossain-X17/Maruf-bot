"use strict";

/**
 * @original fca-unofficial based on Schmavery's facebook-chat-api
 * Adapted by NTKhang for Goat Bot V2
 * Enhanced by Maruf — bug fixes, robustness, no globals
 * Original credits preserved as required.
 */

var utils = require("./utils");
var cheerio = require("cheerio");
var log = require("npmlog");
var fs = require("fs");
var path = require("path");

log.maxRecordSize = 100;

// ——————————————————————————————
// constants
// ——————————————————————————————
const Boolean_Option = [
        "online", "selfListen", "listenEvents", "updatePresence", "forceLogin",
        "autoMarkDelivery", "autoMarkRead", "listenTyping", "autoReconnect", "emitReady"
];

const DEFAULT_USER_AGENT =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const MOBILE_PATTERN = /MPageLoadClientMetrics/;

// FIX #2: no global mutated flag — keep it local to login flow
// (removed global.ditconmemay)

// ——————————————————————————————
// setOptions
// ——————————————————————————————
function setOptions(globalOptions, options) {
        if (!options || typeof options !== "object") return globalOptions;

        Object.keys(options).forEach(function (key) {
                try {
                        if (Boolean_Option.includes(key)) {
                                globalOptions[key] = Boolean(options[key]);
                                return;
                        }
                        switch (key) {
                                case "pauseLog":
                                        if (options.pauseLog) log.pause();
                                        else log.resume();
                                        break;
                                case "logLevel":
                                        log.level = options.logLevel;
                                        globalOptions.logLevel = options.logLevel;
                                        break;
                                case "logRecordSize":
                                        log.maxRecordSize = options.logRecordSize;
                                        globalOptions.logRecordSize = options.logRecordSize;
                                        break;
                                case "pageID":
                                        if (options.pageID !== undefined && options.pageID !== null)
                                                globalOptions.pageID = options.pageID.toString();
                                        break;
                                case "userAgent":
                                        globalOptions.userAgent = options.userAgent || DEFAULT_USER_AGENT;
                                        break;
                                case "proxy":
                                        if (typeof options.proxy !== "string") {
                                                delete globalOptions.proxy;
                                                utils.setProxy();
                                        } else {
                                                globalOptions.proxy = options.proxy;
                                                utils.setProxy(globalOptions.proxy);
                                        }
                                        break;
                                default:
                                        log.warn("setOptions", "Unrecognized option given to setOptions: " + key);
                                        break;
                        }
                } catch (err) {
                        log.warn("setOptions", `Failed to apply option "${key}": ${err.message}`);
                }
        });
        return globalOptions;
}

// ——————————————————————————————
// DTSG extraction helper (used by buildAPI + getFreshDtsg)
// ——————————————————————————————
function extractDtsgFromHtml(html, $) {
        if (!$) $ = cheerio.load(html);
        let fb_dtsg = null;

        const patterns = [
                /\["DTSGInitialData",\[\],\{"token":"([^"]+)"}/,
                /\["DTSGInitData",\[\],\{"token":"([^"]+)"/,
                /"token":"([^"]+)"/,
                /{\\"token\\":\\"([^\\]+)\\"/,
                /,\{"token":"([^"]+)"\},\d+\]/,
                /"async_get_token":"([^"]+)"/,
                /"dtsg":\{"token":"([^"]+)"/,
                /DTSGInitialData[^>]+>([^<]+)/
        ];

        $("script").each((_, script) => {
                if (fb_dtsg) return false; // break
                const scriptText = $(script).html() || "";
                for (const pattern of patterns) {
                        const match = scriptText.match(pattern);
                        if (match && match[1]) {
                                try {
                                        const possibleJson = match[1].replace(/\\"/g, '"');
                                        const parsed = JSON.parse(possibleJson);
                                        fb_dtsg = parsed.token || parsed;
                                } catch {
                                        fb_dtsg = match[1];
                                }
                                if (fb_dtsg) break;
                        }
                }
        });

        if (!fb_dtsg) {
                const dtsgInput = $('input[name="fb_dtsg"]').val();
                if (dtsgInput) fb_dtsg = dtsgInput;
        }

        if (!fb_dtsg) {
                try {
                        const jsonMatches = html.match(/\{"dtsg":({[^}]+})/);
                        if (jsonMatches && jsonMatches[1]) {
                                const dtsgData = JSON.parse(jsonMatches[1]);
                                if (dtsgData.token) fb_dtsg = dtsgData.token;
                        }
                } catch (_) {}
        }

        return fb_dtsg;
}

// ——————————————————————————————
// buildAPI
// ——————————————————————————————
function buildAPI(globalOptions, html, jar) {
        let fb_dtsg = null;
        let irisSeqID = null;

        try {
                const $ = cheerio.load(html);
                fb_dtsg = extractDtsgFromHtml(html, $);
                if (fb_dtsg) log.info("✅ | Found fb_Dtsg");

                const seqMatches = html.match(/irisSeqID":"([^"]+)"/);
                if (seqMatches && seqMatches[1]) irisSeqID = seqMatches[1];
        } catch (e) {
                console.log("Error finding fb_dtsg:", e?.message || e);
        }

        // ——— cookies ———
        const cookies = jar.getCookies("https://www.facebook.com") || [];

        // FIX #9: c_user is the correct bot user ID; i_user is the target user
        const userCookie = cookies.find(c => String(c.cookieString()).startsWith("c_user="));
        const iUserCookie = cookies.find(c => String(c.cookieString()).startsWith("i_user="));

        if (!userCookie && !iUserCookie) {
                log.error("login", "No cookie found for user, please check login information again");
                return null;
        }

        if (html.includes("/checkpoint/block/?next")) {
                log.error("login", "Appstate dead, please replace with a new one!", "error");
                return null;
        }

        // Prefer c_user (real bot ID) over i_user
        const userID = (userCookie || iUserCookie).cookieString().split("=")[1];

        // FIX #1: guard against null endpointMatch
        const clientID = ((Math.random() * 2147483648) | 0).toString(16);
        let mqttEndpoint = `wss://edge-chat.facebook.com/chat?region=prn&sid=${userID}`;
        let region = "PRN";

        try {
                const endpointMatch = html.match(/"endpoint":"([^"]+)"/);
                if (endpointMatch && endpointMatch[1]) {
                        mqttEndpoint = endpointMatch[1].replace(/\\\//g, "/");
                        try {
                                const u = new URL(mqttEndpoint);
                                const r = u.searchParams.get("region");
                                if (r) region = r.toUpperCase();
                        } catch (_) {}
                }
        } catch (_) {
                console.log("Using default MQTT endpoint");
        }

        const ctx = {
                userID,
                jar,
                clientID,
                globalOptions,
                loggedIn: true,
                access_token: "NONE",
                clientMutationId: 0,
                mqttClient: undefined,
                lastSeqId: irisSeqID,
                syncToken: undefined,
                mqttEndpoint,
                region,
                firstListen: true,
                fb_dtsg,
                req_ID: 0,
                callback_Task: {},
                wsReqNumber: 0,
                wsTaskNumber: 0,
                reqCallbacks: {}
        };

        const api = {
                setOptions: setOptions.bind(null, globalOptions),
                getAppState: () => utils.getAppState(jar),
                postFormData: (url, body) => utils.makeDefaults(html, userID, ctx).postFormData(url, ctx.jar, body)
        };

        const defaultFuncs = utils.makeDefaults(html, userID, ctx);

        // refresh DTSG on demand
        api.getFreshDtsg = async function () {
                try {
                        const res = await defaultFuncs.get("https://www.facebook.com/", jar, null, globalOptions);
                        const $ = cheerio.load(res.body);
                        return extractDtsgFromHtml(res.body, $) || null;
                } catch (e) {
                        console.log("Error getting fresh dtsg:", e?.message || e);
                        return null;
                }
        };

        // load src/*.js as API methods (with collision detection)
        try {
                const srcDir = path.join(__dirname, "src");
                if (fs.existsSync(srcDir)) {
                        const files = fs.readdirSync(srcDir).filter(v => v.endsWith(".js"));
                        for (const file of files) {
                                const name = file.replace(".js", "");
                                if (api[name] !== undefined) {
                                        log.warn("buildAPI", `Method "${name}" already exists — skipping src/${file}`);
                                        continue;
                                }
                                try {
                                        api[name] = require(`./src/${file}`)(
                                                utils.makeDefaults(html, userID, ctx),
                                                api,
                                                ctx
                                        );
                                } catch (err) {
                                        log.error("buildAPI", `Failed to load src/${file}: ${err.message}`);
                                }
                        }
                }
        } catch (err) {
                log.error("buildAPI", `Can't read src folder: ${err.message}`);
        }

        api.listen = api.listenMqtt;
        return { ctx, defaultFuncs, api };
}

// ——————————————————————————————
// makeLogin
// ——————————————————————————————
function makeLogin(jar, email, password, loginOptions, callback /*, prCallback*/) {
        return async function (res) {
                try {
                        const html = res.body;
                        let $ = cheerio.load(html);

                        let arr = [];
                        $("#login_form input").each((_, v) => {
                                const val = $(v).val();
                                if (val && val.length) arr.push({ val, name: $(v).attr("name") });
                        });
                        const form = utils.arrToForm(arr);

                        form.lsd = utils.getFrom(html, '["LSD",[],{"token":"', '"}');
                        form.lgndim = Buffer.from(JSON.stringify({ w: 1440, h: 900, aw: 1440, ah: 834, c: 24 })).toString("base64");
                        form.email = email;
                        form.pass = password;
                        form.default_persistent = "0";
                        form.lgnrnd = utils.getFrom(html, 'name="lgnrnd" value="', '"');
                        form.locale = "en_US";
                        form.timezone = "240";
                        form.lgnjs = Math.floor(Date.now() / 1000);

                        const willBeCookies = html.split('"_js_');
                        willBeCookies.slice(1).forEach(val => {
                                try {
                                        const cookieData = JSON.parse('["' + utils.getFrom(val, "", "]") + "]");
                                        jar.setCookie(utils.formatCookie(cookieData, "facebook"), "https://www.facebook.com");
                                } catch (_) {}
                        });

                        log.info("login", "Logging in...");

                        const loginRes = await utils.post(
                                "https://www.facebook.com/login/device-based/regular/login/?login_attempt=1&lwv=110",
                                jar,
                                form,
                                loginOptions
                        );
                        await utils.saveCookies(jar)(loginRes);

                        const headers = loginRes.headers || {};
                        if (!headers.location) throw new Error("Wrong username/password.");

                        // ——— checkpoint / 2FA ———
                        if (headers.location.includes("https://www.facebook.com/checkpoint/")) {
                                log.info("login", "You have login approvals turned on.");
                                const checkpointRes = await utils.get(headers.location, jar, null, loginOptions);
                                await utils.saveCookies(jar)(checkpointRes);

                                const checkpointHtml = checkpointRes.body;
                                // FIX #4: fresh cheerio + new local var names to avoid shadowing
                                const $cp = cheerio.load(checkpointHtml);
                                let cpInputs = [];
                                $cp("form input").each((_, v) => {
                                        const val = $cp(v).val();
                                        if (val && val.length) cpInputs.push({ val, name: $cp(v).attr("name") });
                                });
                                const cpForm = utils.arrToForm(cpInputs);

                                if (checkpointHtml.includes("checkpoint/?next")) {
                                        return new Promise((resolve, reject) => {
                                                const submit2FA = async (code) => {
                                                        try {
                                                                cpForm.approvals_code = code;
                                                                const submitBtn = $cp("#checkpointSubmitButton").html();
                                                                cpForm["submit[Continue]"] = submitBtn || "Continue";

                                                                const approvalRes = await utils.post(
                                                                        "https://www.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.facebook.com%2Fhome.php",
                                                                        jar,
                                                                        cpForm,
                                                                        loginOptions
                                                                );
                                                                await utils.saveCookies(jar)(approvalRes);

                                                                // check error indicator
                                                                const approvalError = $cp("#approvals_code").parent().attr("data-xui-error");
                                                                if (approvalError) throw new Error("Invalid 2FA code.");

                                                                cpForm.name_action_selected = "dont_save";
                                                                const finalRes = await utils.post(
                                                                        "https://www.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.facebook.com%2Fhome.php",
                                                                        jar,
                                                                        cpForm,
                                                                        loginOptions
                                                                );
                                                                await utils.saveCookies(jar)(finalRes);

                                                                const appState = utils.getAppState(jar);
                                                                resolve(await loginHelper(appState, email, password, loginOptions, callback));
                                                        } catch (error) {
                                                                reject(error);
                                                        }
                                                };
                                                throw { error: "login-approval", continue: submit2FA };
                                        });
                                }

                                if (!loginOptions.forceLogin)
                                        throw new Error("Couldn't login. Facebook might have blocked this account.");

                                cpForm["submit[This was me]"] = checkpointHtml.includes("Suspicious Login Attempt")
                                        ? "This was me"
                                        : "This Is Okay";

                                await utils.post(
                                        "https://www.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.facebook.com%2Fhome.php",
                                        jar,
                                        cpForm,
                                        loginOptions
                                );
                                cpForm.name_action_selected = "save_device";
                                const reviewRes = await utils.post(
                                        "https://www.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.facebook.com%2Fhome.php",
                                        jar,
                                        cpForm,
                                        loginOptions
                                );
                                const appState = utils.getAppState(jar);
                                return await loginHelper(appState, email, password, loginOptions, callback);
                        }

                        await utils.get("https://www.facebook.com/", jar, null, loginOptions);
                        return await utils.saveCookies(jar)(loginRes);
                } catch (error) {
                        callback(error);
                }
        };
}

// ——————————————————————————————
// loginHelper
// ——————————————————————————————
function loginHelper(appState, email, password, globalOptions, callback /*, prCallback */) {
        let mainPromise = null;
        const jar = utils.getJar();

        if (appState) {
                let parsed = appState;
                if (typeof appState === "string") {
                        try { parsed = JSON.parse(appState); }
                        catch (_) { /* keep original string? no — error */ }
                }

                if (!Array.isArray(parsed)) {
                        return callback(new Error("Failed to parse appState: must be an array"));
                }
                if (parsed.length === 0) {
                        return callback(new Error("Failed to parse appState: empty array"));
                }

                try {
                        for (const c of parsed) {
                                // FIX #17: don't write "expires=undefined"
                                const parts = [`${c.key}=${c.value}`];
                                if (c.expires !== undefined && c.expires !== null && c.expires !== "undefined")
                                        parts.push(`expires=${c.expires}`);
                                parts.push(`domain=${c.domain || ".facebook.com"}`);
                                parts.push(`path=${c.path || "/"}`);
                                const str = parts.join("; ") + ";";
                                try {
                                        jar.setCookie(str, "http://" + (c.domain || "facebook.com"));
                                } catch (_) {}
                        }

                        mainPromise = utils
                                .get("https://www.facebook.com/", jar, null, globalOptions, { noRef: true })
                                .then(utils.saveCookies(jar));
                } catch (e) {
                        // FIX #5: don't silently process.exit
                        log.error("loginHelper", `Failed to set cookies: ${e.message}`);
                        return callback(e);
                }
        } else {
                mainPromise = utils
                        .get("https://www.facebook.com/", null, null, globalOptions, { noRef: true })
                        .then(utils.saveCookies(jar))
                        .then(makeLogin(jar, email, password, globalOptions, callback))
                        .then(() => utils.get("https://www.facebook.com/", jar, null, globalOptions).then(utils.saveCookies(jar)));
        }

        function handleRedirect(res) {
                const reg = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/;
                const redirect = reg.exec(res.body);
                if (redirect && redirect[1]) {
                        return utils.get(redirect[1], jar, null, globalOptions).then(utils.saveCookies(jar));
                }
                return res;
        }

        let ctx, api;

        mainPromise = mainPromise
                .then(handleRedirect)
                .then(res => {
                        // FIX #8: don't use /g flag — stateful lastIndex bug
                        if (!MOBILE_PATTERN.test(res.body)) {
                                globalOptions.userAgent =
                                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
                                return utils
                                        .get("https://www.facebook.com/", jar, null, globalOptions, { noRef: true })
                                        .then(utils.saveCookies(jar));
                        }
                        return res;
                })
                .then(handleRedirect)
                .then(res => {
                        const html = res.body;
                        const Obj = buildAPI(globalOptions, html, jar);
                        if (!Obj) throw new Error("buildAPI failed — check appstate or account status");
                        ctx = Obj.ctx;
                        api = Obj.api;
                        return res;
                });

        if (globalOptions.pageID) {
                mainPromise = mainPromise
                        .then(() =>
                                utils.get(
                                        `https://www.facebook.com/${globalOptions.pageID}/messages/?section=messages&subsection=inbox`,
                                        jar,
                                        null,
                                        globalOptions
                                )
                        )
                        .then(resData => {
                                let url = utils
                                        .getFrom(resData.body, 'window.location.replace("https:\\/\\/www.facebook.com\\', '");')
                                        .split("\\")
                                        .join("");
                                url = url.substring(0, url.length - 1);
                                return utils.get("https://www.facebook.com" + url, jar, null, globalOptions);
                        });
        }

        mainPromise
                .then(async () => {
                        log.info("login", "Login successful");
                        callback(null, api);
                })
                .catch(e => {
                        log.error("loginHelper", `Login failed: ${e?.message || e}`);
                        callback(e);
                });
}

// ——————————————————————————————
// login (main export)
// ——————————————————————————————
function login(loginData, options, callback) {
        if (utils.getType(options) === "Function" || utils.getType(options) === "AsyncFunction") {
                callback = options;
                options = {};
        }
        if (!options || typeof options !== "object") options = {};

        // FIX #11: fresh object each call (no shared reference)
        const globalOptions = {
                selfListen: false,
                listenEvents: false,
                listenTyping: false,
                updatePresence: false,
                forceLogin: false,
                autoMarkDelivery: false,
                autoMarkRead: false,
                autoReconnect: true,
                logRecordSize: 100,
                online: true,
                emitReady: false,
                userAgent: DEFAULT_USER_AGENT
        };

        // FIX #6: always return a promise when callback is absent
        let returnPromise;
        let prCallback = null;
        if (utils.getType(callback) !== "Function" && utils.getType(callback) !== "AsyncFunction") {
                let resolveFunc = null;
                let rejectFunc = null;
                returnPromise = new Promise(function (resolve, reject) {
                        resolveFunc = resolve;
                        rejectFunc = reject;
                });
                prCallback = function (error, api) {
                        if (error) return rejectFunc(error);
                        return resolveFunc(api);
                };
                callback = prCallback;
        }

        if (!loginData || typeof loginData !== "object") {
                const err = new Error("loginData is required");
                if (callback) callback(err);
                return returnPromise;
        }

        try {
                if (loginData.email && loginData.password) {
                        setOptions(globalOptions, {
                                logLevel: "silent",
                                forceLogin: true,
                                userAgent: DEFAULT_USER_AGENT
                        });
                        loginHelper(loginData.appState, loginData.email, loginData.password, globalOptions, callback);
                } else if (loginData.appState) {
                        setOptions(globalOptions, options);
                        loginHelper(loginData.appState, loginData.email, loginData.password, globalOptions, callback);
                } else {
                        const err = new Error("You must provide either appState OR email+password");
                        if (callback) callback(err);
                }
        } catch (err) {
                if (callback) callback(err);
        }

        return returnPromise;
}

module.exports = login;
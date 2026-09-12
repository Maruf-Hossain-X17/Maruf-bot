/**
 * @author Maruf Hossain
 * ! Original Goat Bot V2 by NTKhang03 (https://github.com/ntkhang03)
 * ! MIT License — original credits preserved
 * --------------------------------------------------------------------------
 * BBY AI Chatbot — Ultra Smart Chat
 * Updated: removed autotrain/status/clone, added MongoDB fallback,
 *          fixed deprecated mongoose options, safer admin check
 * --------------------------------------------------------------------------
 */

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const mongoose = require("mongoose");

// ==========================================
//          API & SECURITY SETTINGS
// ==========================================
const RAW_URL = "https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json";
const ADMIN_PASS = "sorry";
const FALLBACK_API = "https://bby-api-vshv.onrender.com";
const API_TIMEOUT = 15000;

let cachedApiUrl = null;
async function getApiUrl() {
    if (cachedApiUrl) return cachedApiUrl;
    try {
        const res = await axios.get(RAW_URL, { timeout: 10000 });
        cachedApiUrl = res.data?.apis?.main?.url || FALLBACK_API;
    } catch (err) {
        console.error("[BBY] Raw URL fetch failed:", err.message);
        cachedApiUrl = FALLBACK_API;
    }
    return cachedApiUrl;
}

// ==========================================
//        CONFIG & ADMIN
// ==========================================
let adminBots = [];

try {
    const configPath = path.join(process.cwd(), "config.json");
    if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        adminBots = cfg.ADMINBOT || cfg.adminBot || [];
        if (!Array.isArray(adminBots)) adminBots = [adminBots];
        adminBots = adminBots.map(String);
    }
} catch (err) {
    console.error("[BBY] Config read error:", err.message);
}

function isAdminUser(uid) {
    if (!uid) return false;
    const uidStr = String(uid);
    const fromGlobal = global.GoatBot?.config?.adminBot;
    if (Array.isArray(fromGlobal) && fromGlobal.map(String).includes(uidStr)) return true;
    if (Array.isArray(global.config?.ADMINBOT) && global.config.ADMINBOT.map(String).includes(uidStr)) return true;
    return adminBots.includes(uidStr);
}

// ==========================================
//      In-memory fallback (no MongoDB required)
// ==========================================
const memTeachers = new Map();       // uid -> { uid, name, count }
const memThreadSettings = new Map(); // threadID -> { threadID, autoChat }

function memGetTeacher(uid, name) {
    if (!memTeachers.has(uid)) memTeachers.set(uid, { uid, name: name || "Unknown Boss", count: 0 });
    const t = memTeachers.get(uid);
    if (name) t.name = name;
    return t;
}
function memGetThreadSetting(tid) {
    if (!memThreadSettings.has(tid)) memThreadSettings.set(tid, { threadID: tid, autoChat: true });
    return memThreadSettings.get(tid);
}

// ==========================================
//        MongoDB Connection (optional)
// ==========================================
let USE_MONGO = false;
let Teacher = null;
let ThreadSetting = null;

try {
    let mongoUri = "";
    const configPath = path.join(process.cwd(), "config.json");
    if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        mongoUri = cfg.mongodbUri || cfg.database?.uriMongodb || "";
    }

    if (mongoose.connection.readyState === 1) {
        USE_MONGO = true;
    } else if (mongoUri && mongoose.connection.readyState === 0) {
        mongoose.connect(mongoUri)  // ✅ deprecated options removed
            .then(() => {
                console.log("✅ [BBY] MongoDB connected");
                USE_MONGO = true;
            })
            .catch((err) => {
                console.error("❌ [BBY] MongoDB failed:", err.message);
                USE_MONGO = false;
            });
    }

    // Define schemas (used only if MongoDB connects)
    const teacherSchema = new mongoose.Schema({
        uid: { type: String, required: true, unique: true },
        name: { type: String, default: "Unknown Boss" },
        count: { type: Number, default: 0 }
    });
    Teacher = mongoose.models.MarufTeacher || mongoose.model("MarufTeacher", teacherSchema);

    const settingSchema = new mongoose.Schema({
        threadID: { type: String, required: true, unique: true },
        autoChat: { type: Boolean, default: true }
    });
    ThreadSetting = mongoose.models.MarufSetting || mongoose.model("MarufSetting", settingSchema);
} catch (err) {
    console.error("[BBY] MongoDB init error:", err.message);
    USE_MONGO = false;
}

// ==========================================
//        Teacher helpers (Mongo or memory)
// ==========================================
async function getTeacher(uid, name) {
    if (USE_MONGO && Teacher) {
        try {
            let t = await Teacher.findOne({ uid });
            if (!t) t = new Teacher({ uid, name: name || "Unknown Boss", count: 0 });
            if (name && t.name !== name) t.name = name;
            return t;
        } catch (err) {
            console.error("[BBY] Teacher read failed:", err.message);
        }
    }
    return memGetTeacher(uid, name);
}

async function saveTeacher(t) {
    if (USE_MONGO && t && typeof t.save === "function") {
        try { await t.save(); return true; }
        catch (err) { console.error("[BBY] Teacher save failed:", err.message); }
    }
    if (t && t.uid) memTeachers.set(String(t.uid), { uid: t.uid, name: t.name, count: t.count });
    return true;
}

async function getTopTeachers(limit = 5) {
    if (USE_MONGO && Teacher) {
        try { return await Teacher.find().sort({ count: -1 }).limit(limit); }
        catch (err) { console.error("[BBY] Teacher list failed:", err.message); }
    }
    return [...memTeachers.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

async function getThreadSetting(tid) {
    if (USE_MONGO && ThreadSetting) {
        try {
            let s = await ThreadSetting.findOne({ threadID: tid });
            if (!s) s = new ThreadSetting({ threadID: tid, autoChat: true });
            return s;
        } catch (err) { console.error("[BBY] Thread read failed:", err.message); }
    }
    return memGetThreadSetting(tid);
}

async function saveThreadSetting(s) {
    if (USE_MONGO && s && typeof s.save === "function") {
        try { await s.save(); return true; }
        catch (err) { console.error("[BBY] Thread save failed:", err.message); }
    }
    if (s && s.threadID) memThreadSettings.set(String(s.threadID), { threadID: s.threadID, autoChat: s.autoChat });
    return true;
}

// ==========================================
//             TRIGGER WORDS
// ==========================================
const triggersWords = [
    "baby", "bby", "babu", "bbu", "jan", "bot",
    "জান", "জানু", "বেবি", "wifey", "bbe"
];

function getTeacherBadge(count) {
    if (count >= 100) return "👑 𝐀𝐈 𝐆𝐎𝐃";
    if (count >= 50)  return "💎 𝐌𝐀𝐒𝐓𝐄𝐑 𝐓𝐄𝐀𝐂𝐇𝐄𝐑";
    if (count >= 25)  return "🥇 𝐒𝐄𝐍𝐈𝐎𝐑 𝐓𝐄𝐀𝐂𝐇𝐄𝐑";
    if (count >= 10)  return "🥈 𝐀𝐃𝐕𝐀𝐍𝐂𝐄𝐃 𝐓𝐄𝐀𝐂𝐇𝐄𝐑";
    if (count >= 5)   return "🥉 𝐍𝐎𝐕𝐈𝐂𝐄 𝐓𝐄𝐀𝐂𝐇𝐄𝐑";
    return "🌱 𝐁𝐄𝐆𝐈𝐍𝐍𝐄𝐑";
}

function normalizeText(text) {
    if (!text) return "";
    return String(text).toLowerCase().trim().replace(/(.)\1{2,}/g, "$1");
}

// ==========================================
//             MODULE CONFIG
// ==========================================
module.exports.config = {
    name: "baby",
    aliases: ["bby", "bbr", "jan", "janu", "wifey", "bot", "babu"],
    version: "4.4.0",
    author: "Maruf Hossain",
    countDown: 0,
    role: 0,
    description: "Ultra Smart AI Chatbot — updated (autotrain/status/clone removed)",
    category: "chat",
    guide: {
        en:
            "╭─────────✦─────────╮\n" +
            "│  🤖 BBY 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒  │\n" +
            "├─────────✦─────────┤\n" +
            "│ 🗣️ 𝐂𝐡𝐚𝐭: {pn} [text]\n" +
            "│ 📚 𝐓𝐞𝐚𝐜𝐡: {pn} teach [trigger] - [reply1, reply2] (Admin)\n" +
            "│ 🗑️ 𝐑𝐞𝐦𝐨𝐯𝐞: {pn} remove [trigger] (Admin)\n" +
            "│ 🔍 𝐒𝐞𝐚𝐫𝐜𝐡: {pn} search [trigger] (Admin)\n" +
            "│ 💬 𝐌𝐬𝐠: {pn} msg [word] (Admin)\n" +
            "│ 🏆 𝐑𝐚𝐧𝐤𝐢𝐧𝐠: {pn} list (Admin)\n" +
            "│ 👤 𝐏𝐫𝐨𝐟𝐢𝐥𝐞: {pn} me\n" +
            "│ ⚙️ 𝐀𝐮𝐭𝐨-𝐂𝐡𝐚𝐭: {pn} off / on (Admin)\n" +
            "╰─────────✦─────────╯"
    }
};

// ==========================================
//         BOT RESPONSE HELPER
// ==========================================
async function getBotResponse(text) {
    try {
        const API_URL = await getApiUrl();
        const res = await axios.post(`${API_URL}/api/maruf`, { text }, { timeout: API_TIMEOUT });
        return res.data?.message || res.data?.reply || res.data || "দুঃখিত বস, আমি কথাটা ঠিক বুঝতে পারিনি। 🥺";
    } catch (error) {
        console.error("[BBY] API error:", error.message);
        return "সার্ভার এখন ঘুমাচ্ছে বা একটু ওভারলোডেড আছে! একটু পর আবার চেষ্টা করো প্লিজ। 🥺";
    }
}

// ==========================================
//             ON START
// ==========================================
module.exports.onStart = async ({ api, event, args, usersData }) => {
    const uid = event.senderID;
    const tid = event.threadID;
    const msg = args.join(" ").trim();

    let userName = "Unknown Boss";
    try {
        userName = (await usersData.getName(uid)) || "Unknown Boss";
    } catch (_) {}

    const isAdmin = isAdminUser(uid);

    if (!msg) {
        const rand = [
            "বলো বস, আমি শুনছি! ❤️",
            "I love you 🙈",
            "আমাকে ডাকলে কেনো? কোনো দরকারে? 😘",
            "কী গো জান, কিছু বলবা নাকি? 🤭"
        ];
        return api.sendMessage(`✨ ${rand[Math.floor(Math.random() * rand.length)]}`, tid, event.messageID);
    }

    const command = args[0].toLowerCase();

    // Admin-only commands
    const adminCommands = ["teach", "remove", "rm", "search", "find", "msg", "list", "top", "off", "on"];

    if (adminCommands.includes(command) && !isAdmin) {
        return api.sendMessage(
            "⚠️ বস, এই ফিচারটি শুধুমাত্র আমার ডেভেলপার বা এডমিনদের জন্য! 🚫\nআপনি চাইলে আমার সাথে এমনিতে গল্প করতে পারেন। ❤️",
            tid, event.messageID
        );
    }

    try {
        const API_URL = await getApiUrl();

        // 🟢 1. Teach
        if (command === "teach") {
            const textToTeach = msg.substring(6).trim();
            const [rawTrigger, responseStr] = textToTeach.split(" - ");
            if (!rawTrigger || !responseStr)
                return api.sendMessage(
                    "⚠️ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐅𝐨𝐫𝐦𝐚𝐭!\nসঠিক নিয়ম: !baby teach hi - ki, bolo",
                    tid, event.messageID
                );

            const trigger = normalizeText(rawTrigger);
            const responsesList = responseStr.split(/[,|]/).map(r => r.trim()).filter(Boolean);

            await axios.post(`${API_URL}/api/maruf/teach`, {
                trigger,
                responses: responsesList.length === 1 ? responsesList[0] : responsesList
            }, { timeout: API_TIMEOUT });

            let teacher = await getTeacher(uid, userName);
            teacher.count = (teacher.count || 0) + responsesList.length;
            teacher.name = userName;
            await saveTeacher(teacher);

            return api.sendMessage(
                `✅ 𝐓𝐞𝐚𝐜𝐡 𝐒𝐮𝐜𝐜𝐞𝐬𝐬:\n🗣️ 𝐓𝐫𝐢𝐠𝐠𝐞𝐫: ${trigger}\n💬 𝐑𝐞𝐩𝐥𝐢𝐞𝐬: ${responsesList.join(" | ")}`,
                tid, event.messageID
            );
        }

        // 🔴 2. Remove
        if (command === "remove" || command === "rm") {
            const trigger = msg.substring(args[0].length + 1).trim();
            if (!trigger)
                return api.sendMessage("⚠️ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐅𝐨𝐫𝐦𝐚𝐭!\nনিয়ম: !baby remove [trigger]", tid, event.messageID);

            const res = await axios.delete(`${API_URL}/api/maruf/remove`, {
                data: { trigger, password: ADMIN_PASS },
                timeout: API_TIMEOUT
            });
            return api.sendMessage(`🗑️ 𝐀𝐜𝐭𝐢𝐨𝐧 𝐒𝐮𝐜𝐜𝐞𝐬𝐬:\n${res.data?.message || "Data removed successfully!"}`, tid, event.messageID);
        }

        // 🔍 3. Search
        if (command === "search" || command === "find") {
            const searchWord = args.slice(1).join(" ").trim();
            const res = await axios.get(`${API_URL}/api/maruf/search?q=${encodeURIComponent(searchWord)}`, { timeout: API_TIMEOUT });
            return api.sendMessage(`🔍 𝐒𝐞𝐚𝐫𝐜𝐡 𝐑𝐞𝐬𝐮𝐥𝐭:\n${JSON.stringify(res.data?.data || res.data, null, 2)}`, tid, event.messageID);
        }

        // 💬 4. MSG
        if (command === "msg") {
            const queryWord = args.slice(1).join(" ").trim();
            const res = await axios.get(`${API_URL}/bby/msg?text=${encodeURIComponent(queryWord)}`, { timeout: API_TIMEOUT });
            return api.sendMessage(res.data, tid, event.messageID);
        }

        // 👤 5. My Profile
        if (command === "me" || command === "myrank") {
            const teacher = await getTeacher(uid, userName);
            const count = teacher.count || 0;
            return api.sendMessage(
                `👤 𝐏𝐑𝐎𝐅𝐈𝐋𝐄\n📛 𝐍𝐚𝐦𝐞: ${teacher.name || userName}\n📚 𝐓𝐞𝐚𝐜𝐡: ${count}\n🎖️ 𝐓𝐢𝐭𝐥𝐞: ${getTeacherBadge(count)}`,
                tid, event.messageID
            );
        }

        // 📋 6. Leaderboard
        if (command === "list" || command === "top") {
            let totalMemory = 0;
            try {
                const res = await axios.get(`${API_URL}/api/maruf/list`, { timeout: API_TIMEOUT });
                totalMemory = Object.keys(res.data?.data || res.data || {}).length;
            } catch (_) {}

            const top = await getTopTeachers(5);
            let board = `🏆 𝐓𝐎𝐏 𝐓𝐄𝐀𝐂𝐇𝐄𝐑𝐒 (Total Memory: ${totalMemory})\n`;
            top.forEach((t, i) => { board += `${i + 1}. ${t.name} — ${t.count} w\n`; });
            return api.sendMessage(board, tid, event.messageID);
        }

        // 🔕 7. Auto-Chat Toggle
        if (command === "off" || command === "on") {
            const status = command === "on";
            const setting = await getThreadSetting(tid);
            setting.autoChat = status;
            await saveThreadSetting(setting);
            return api.sendMessage(status ? "🔊 Auto-Chat চালু!" : "🔇 Auto-Chat বন্ধ!", tid, event.messageID);
        }

        // 💬 8. Default Smart Chat (everyone)
        const triggerWord = normalizeText(msg);
        const replyMessage = await getBotResponse(triggerWord);
        api.sendMessage(replyMessage, tid, (err, info) => {
            if (!err && info) {
                global.GoatBot.onReply.set(info.messageID, {
                    commandName: module.exports.config.name,
                    type: "reply",
                    messageID: info.messageID,
                    author: uid,
                    triggerWord
                });
            }
        }, event.messageID);

    } catch (error) {
        console.error("[BBY onStart]", error);
        const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
        api.sendMessage(`❌ 𝐄𝐫𝐫𝐨𝐫: ${errMsg}`, tid, event.messageID);
    }
};

// ==========================================
//        ON-REPLY SYSTEM
// ==========================================
module.exports.onReply = async ({ api, event, Reply }) => {
    if (event.type !== "message_reply") return;

    try {
        const API_URL = await getApiUrl();
        const fullMsg = (event.body || "").trim();
        const replyArgs = fullMsg.split(/\s+/);
        const replyCmd = (replyArgs[0] || "").toLowerCase();
        const isAdmin = isAdminUser(event.senderID);

        // 🔴 DYNAMIC DELETE (Admin only)
        if (replyCmd === "delete" || replyCmd === "rm") {
            if (!isAdmin) {
                return api.sendMessage(
                    "⚠️ ডাটাবেস থেকে ডিলিট করার পারমিশন শুধু এডমিনদের আছে!",
                    event.threadID, event.messageID
                );
            }

            const triggerToDelete = Reply?.triggerWord;
            const passwordToUse = replyArgs[1] || ADMIN_PASS;

            if (!triggerToDelete)
                return api.sendMessage("⚠️ আগের ট্রিগারটি খুঁজে পাওয়া যায়নি!", event.threadID, event.messageID);

            try {
                const res = await axios.delete(`${API_URL}/api/maruf/remove`, {
                    data: { trigger: triggerToDelete, password: passwordToUse },
                    timeout: API_TIMEOUT
                });
                return api.sendMessage(`🗑️ ${res.data?.message || "ডিলিট করা হয়েছে!"}`, event.threadID, event.messageID);
            } catch (err) {
                return api.sendMessage(`❌ 𝐄𝐫𝐫𝐨𝐫: ${err.message}`, event.threadID, event.messageID);
            }
        }

        // 🟢 Normal chat reply (everyone)
        const userMsg = normalizeText(fullMsg);
        const replyMessage = await getBotResponse(userMsg);
        api.sendMessage(replyMessage, event.threadID, (err, info) => {
            if (!err && info) {
                global.GoatBot.onReply.set(info.messageID, {
                    commandName: module.exports.config.name,
                    type: "reply",
                    messageID: info.messageID,
                    author: event.senderID,
                    triggerWord: userMsg
                });
            }
        }, event.messageID);

    } catch (err) {
        console.error("[BBY onReply]", err);
    }
};

// ==========================================
//        AUTO-CHAT SYSTEM (No Prefix)
// ==========================================
module.exports.onChat = async ({ api, event }) => {
    try {
        const tid = event.threadID;
        if (!tid) return;

        const setting = await getThreadSetting(tid);
        if (setting && setting.autoChat === false) return;

        const message = (event.body || "").toLowerCase();
        if (!message) return;

        const isTriggered = triggersWords.some((word) => message.startsWith(word));
        if (event.type === "message_reply" || !isTriggered) return;

        // React + typing
        const reactions = ["💖", "😘", "🥰", "🙈", "🤖", "✨", "🦋"];
        api.setMessageReaction(
            reactions[Math.floor(Math.random() * reactions.length)],
            event.messageID,
            () => {},
            true
        );
        api.sendTypingIndicator(tid, true);

        // Extract text after trigger
        let userText = message;
        for (const prefix of triggersWords) {
            if (message.startsWith(prefix)) {
                userText = message.substring(prefix.length).trim();
                break;
            }
        }

        if (!userText) {
            const rand = ["Babu khuda lagse 🥺", "বলো কি বলবা? 🤭", "Bolo Babu? 🙈"];
            return api.sendMessage(
                `✨ ${rand[Math.floor(Math.random() * rand.length)]}`,
                tid,
                (err, info) => {
                    if (!err && info) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName: module.exports.config.name,
                            type: "reply",
                            messageID: info.messageID,
                            author: event.senderID,
                            triggerWord: "bby"
                        });
                    }
                },
                event.messageID
            );
        }

        const triggerWord = normalizeText(userText);
        const replyMessage = await getBotResponse(triggerWord);
        api.sendMessage(replyMessage, tid, (err, info) => {
            if (!err && info) {
                global.GoatBot.onReply.set(info.messageID, {
                    commandName: module.exports.config.name,
                    type: "reply",
                    messageID: info.messageID,
                    author: event.senderID,
                    triggerWord
                });
            }
        }, event.messageID);

    } catch (err) {
        console.error("[BBY onChat]", err);
    }
};
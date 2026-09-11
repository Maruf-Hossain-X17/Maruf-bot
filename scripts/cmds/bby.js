const axios = require("axios");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// ==========================================
//          API & SECURITY SETTINGS
// ==========================================
const RAW_URL = "https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json";
const ADMIN_PASS = "Maruf@12345"; // 🔑 আপনার API এর সঠিক পাসওয়ার্ড এখানে দিন

// ডাইনামিক API URL আনার ফাংশন
let cachedApiUrl = null;
async function getApiUrl() {
    if (cachedApiUrl) return cachedApiUrl;
    try {
        const res = await axios.get(RAW_URL);
        cachedApiUrl = res.data.apis.main.url; // Raw link থেকে main bby api url নিবে
        return cachedApiUrl;
    } catch (error) {
        console.error("❌ Raw JSON থেকে API URL আনতে সমস্যা হয়েছে:", error);
        return "https://bby-api-vshv.onrender.com"; // Fallback URL
    }
}

// ==========================================
//        CONFIG, ADMIN & MONGODB CONNECTION
// ==========================================
let mongoUri = "";
let adminBots = []; // এডমিনদের লিস্ট সেভ রাখার ভেরিয়েবল

try {
    const rootConfigPath = path.join(process.cwd(), "config.json");
    if (fs.existsSync(rootConfigPath)) {
        const rootConfig = JSON.parse(fs.readFileSync(rootConfigPath, "utf-8"));
        mongoUri = rootConfig.mongodbUri || rootConfig.database?.uri || global.config?.mongodbUri;
        
        // অত্যন্ত নিরাপদে config.json থেকে এডমিন লিস্ট বের করা
        adminBots = rootConfig.ADMINBOT || rootConfig.adminBot || [];
        if (!Array.isArray(adminBots)) adminBots = [adminBots];
    }
} catch (error) {
    console.error("❌ Config থেকে ডাটা পড়তে সমস্যা হয়েছে:", error);
}

// 🟢 Safe Admin Check Helper
function isAdminUser(uid) {
    const uidStr = String(uid);
    // Optional chaining ব্যবহার করা হয়েছে যাতে ক্র্যাশ না করে
    if (global.config?.ADMINBOT?.includes(uidStr)) return true;
    if (global.GoatBot?.config?.adminBot?.includes(uidStr)) return true;
    if (adminBots.includes(uidStr)) return true;
    return false;
}

if (mongoUri && mongoose.connection.readyState === 0) {
    mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log("✅ Baby AI: MongoDB Connected Successfully!");
    }).catch(err => {
        console.error("❌ MongoDB Connection Failed:", err);
    });
}

// ==========================================
//            MONGODB SCHEMAS & MODELS
// ==========================================
const teacherSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    name: { type: String, default: "Unknown Boss" },
    count: { type: Number, default: 0 }
});
const Teacher = mongoose.models.MarufTeacher || mongoose.model("MarufTeacher", teacherSchema);

const settingSchema = new mongoose.Schema({
    threadID: { type: String, required: true, unique: true },
    autoChat: { type: Boolean, default: true }
});
const ThreadSetting = mongoose.models.MarufSetting || mongoose.model("MarufSetting", settingSchema);

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
    return text.toLowerCase().trim().replace(/(.)\1{2,}/g, '$1');
}

// ==========================================
//             MODULE CONFIG
// ==========================================
module.exports.config = {
    name: "baby",
    aliases: ["bby", "bbr", "jan", "janu", "wifey", "bot", "babu"],
    version: "4.3.1",
    author: "Maruf Hossain",
    countDown: 0,
    role: 0,
    description: "Ultra Smart AI Chatbot - Full API Endpoints + Admin Restriction (Crash Fix)",
    category: "chat",
    guide: {
        en: "╭─────────✦─────────╮\n" +
            "│  🤖 BBY 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒  │\n" +
            "├─────────✦─────────┤\n" +
            "│ 🗣️ 𝐂𝐡𝐚𝐭: {pn} [text]\n" +
            "│ 📚 𝐓𝐞𝐚𝐜𝐡: {pn} teach [trigger] - [reply1, reply2] (Admin)\n" +
            "│ 🗑️ 𝐑𝐞𝐦𝐨𝐯𝐞: {pn} remove [trigger] (Admin)\n" +
            "│ 🔍 𝐒𝐞𝐚𝐫𝐜𝐡: {pn} search [trigger] (Admin)\n" +
            "│ 💬 𝐌𝐬𝐠: {pn} msg [word] (Admin)\n" +
            "│ 🏆 𝐑𝐚𝐧𝐤𝐢𝐧𝐠: {pn} list [optional: word] (Admin)\n" +
            "│ 👤 𝐏𝐫𝐨𝐟𝐢𝐥𝐞: {pn} me\n" +
            "│ ⚙️ 𝐀𝐮𝐭𝐨-𝐂𝐡𝐚𝐭: {pn} off / on (Admin)\n" +
            "│ 🤖 𝐀𝐮𝐭𝐨 𝐓𝐫𝐚𝐢𝐧: {pn} autotrain [start/stop] (Admin)\n" +
            "│ 🔄 𝐂𝐥𝐨𝐧𝐞: {pn} clone (Admin)\n" +
            "│ 📊 𝐒𝐭𝐚𝐭𝐮𝐬: {pn} status (Admin)\n" +
            "│ ⏱️ 𝐔𝐩𝐭𝐢𝐦𝐞: {pn} uptime (Admin)\n" +
            "╰─────────✦─────────╯"
    }
};

async function getBotResponse(text) {
    try {
        const API_URL = await getApiUrl();
        const res = await axios.post(`${API_URL}/api/maruf`, { text });
        return res.data.message || res.data.reply || res.data || "দুঃখিত বস, আমি কথাটা ঠিক বুঝতে পারিনি। 🥺";
    } catch (error) {
        return "সার্ভার এখন ঘুমাচ্ছে বা একটু ওভারলোডেড আছে! একটু পর আবার চেষ্টা করো প্লিজ। 🥺";
    }
}

// ==========================================
//             MAIN FUNCTION
// ==========================================
module.exports.onStart = async ({ api, event, args, usersData }) => {
    const API_URL = await getApiUrl();
    const msg = args.join(" ").trim();
    const uid = event.senderID;
    const tid = event.threadID;
    const userName = (await usersData.getName(uid)) || "Unknown Boss";

    // ✅ চেক: ইউজার কি গ্লোবাল এডমিন? (Safe Check)
    const isAdmin = isAdminUser(uid);

    if (!msg) {
        const ran = ["বলো বস, আমি শুনছি! ❤️", "I love you 🙈", "আমাকে ডাকলে কেনো? কোনো দরকারে? 😘", "কী গো জান, কিছু বলবা নাকি? 🤭"];
        return api.sendMessage(`✨ ${ran[Math.floor(Math.random() * ran.length)]}`, tid, event.messageID);
    }

    const command = args[0].toLowerCase();
    
    // যে কমান্ডগুলো শুধুমাত্র এডমিনরা ব্যবহার করতে পারবে
    const adminCommands = ["teach", "remove", "rm", "search", "find", "msg", "list", "top", "off", "on", "autotrain", "clone", "status", "uptime"];

    // 🔒 Admin Restriction Check
    if (adminCommands.includes(command) && !isAdmin) {
        return api.sendMessage("⚠️ বস, এই ফিচারটি শুধুমাত্র আমার ডেভেলপার বা এডমিনদের জন্য! 🚫\nআপনি চাইলে আমার সাথে এমনিতে গল্প করতে পারেন। ❤️", tid, event.messageID);
    }

    try {
        // 🟢 1. Teach Feature
        if (command === "teach") {
            const textToTeach = msg.substring(6).trim();
            const [rawTrigger, responseStr] = textToTeach.split(" - ");
            if (!rawTrigger || !responseStr) return api.sendMessage("⚠️ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐅𝐨𝐫𝐦𝐚𝐭!\nসঠিক নিয়ম: !baby teach hi - ki, bolo", tid, event.messageID);

            const trigger = normalizeText(rawTrigger);
            const rawResponsesList = responseStr.split(/[,|]/).map(res => res.trim()).filter(Boolean);

            await axios.post(`${API_URL}/api/maruf/teach`, { 
                trigger: trigger, 
                responses: rawResponsesList.length === 1 ? rawResponsesList[0] : rawResponsesList 
            });

            let teacher = await Teacher.findOne({ uid }) || new Teacher({ uid, name: userName, count: 0 });
            teacher.count += rawResponsesList.length;
            teacher.name = userName;
            await teacher.save();

            return api.sendMessage(`✅ 𝐓𝐞𝐚𝐜𝐡 𝐒𝐮𝐜𝐜𝐞𝐬𝐬:\n🗣️ 𝐓𝐫𝐢𝐠𝐠𝐞𝐫: ${trigger}\n💬 𝐑𝐞𝐩𝐥𝐢𝐞𝐬: ${rawResponsesList.join(" | ")}`, tid, event.messageID);
        }

        // 🔴 2. Remove Feature
        if (command === "remove" || command === "rm") {
            const trigger = msg.substring(args[0].length + 1).trim();
            if (!trigger) return api.sendMessage("⚠️ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐅𝐨𝐫𝐦𝐚𝐭!\nনিয়ম: !baby remove [trigger]", tid, event.messageID);

            const res = await axios.delete(`${API_URL}/api/maruf/remove`, { data: { trigger: trigger, password: ADMIN_PASS } });
            return api.sendMessage(`🗑️ 𝐀𝐜𝐭𝐢𝐨𝐧 𝐒𝐮𝐜𝐜𝐞𝐬𝐬:\n${res.data.message || "Data removed successfully!"}`, tid, event.messageID);
        }

        // 🔍 3. Search Feature
        if (command === "search" || command === "find") {
            const searchWord = args.slice(1).join(" ").trim();
            const res = await axios.get(`${API_URL}/api/maruf/search?q=${encodeURIComponent(searchWord)}`);
            return api.sendMessage(`🔍 𝐒𝐞𝐚𝐫𝐜𝐡 𝐑𝐞𝐬𝐮𝐥𝐭:\n${JSON.stringify(res.data.data || res.data, null, 2)}`, tid, event.messageID);
        }

        // 💬 4. MSG Feature
        if (command === "msg") {
            const queryWord = args.slice(1).join(" ").trim();
            const res = await axios.get(`${API_URL}/bby/msg?text=${encodeURIComponent(queryWord)}`);
            return api.sendMessage(res.data, tid, event.messageID);
        }

        // 👤 5. My Profile (All users can check their rank)
        if (command === "me" || command === "myrank") {
            const teacher = await Teacher.findOne({ uid }) || { name: userName, count: 0 };
            return api.sendMessage(`👤 𝐏𝐑𝐎𝐅𝐈𝐋𝐄\n📛 𝐍𝐚𝐦𝐞: ${teacher.name}\n📚 𝐓each: ${teacher.count}\n🎖️ 𝐓𝐢𝐭𝐥𝐞: ${getTeacherBadge(teacher.count)}`, tid, event.messageID);
        }

        // 📋 6. List / Leaderboard
        if (command === "list" || command === "top") {
            const res = await axios.get(`${API_URL}/api/maruf/list`);
            const totalMemory = Object.keys(res.data.data || res.data).length;
            const sortedTeachers = await Teacher.find().sort({ count: -1 }).limit(5);
            
            let leaderboardMsg = `🏆 𝐓𝐎𝐏 𝐓𝐄𝐀𝐂𝐇𝐄𝐑𝐒 (Total Memory: ${totalMemory})\n`;
            sortedTeachers.forEach((t, i) => leaderboardMsg += `${i+1}. ${t.name} - ${t.count} w\n`);
            return api.sendMessage(leaderboardMsg, tid, event.messageID);
        }

        // 🔕 7. Auto-Chat Toggle
        if (command === "off" || command === "on") {
            const status = command === "on";
            await ThreadSetting.findOneAndUpdate({ threadID: tid }, { autoChat: status }, { upsert: true, new: true });
            return api.sendMessage(status ? "🔊 Auto-Chat चालू!" : "🔇 Auto-Chat বন্ধ!", tid, event.messageID);
        }

        // ⚙️ 8. Auto Trainer Control
        if (command === "autotrain") {
            const action = args[1]?.toLowerCase();
            const res = await axios.post(`${API_URL}/api/autotrainer/control`, { action: action, password: ADMIN_PASS });
            return api.sendMessage(`🤖 𝐀𝐮𝐭𝐨 𝐓𝐫𝐚𝐢𝐧𝐞𝐫: ${res.data.message || "Success"}`, tid, event.messageID);
        }

        // 🔄 9. Clone Data Endpoint (NEW)
        if (command === "clone") {
            const res = await axios.post(`${API_URL}/api/maruf/clone`, { password: ADMIN_PASS });
            return api.sendMessage(`🔄 𝐂𝐥𝐨𝐧𝐞 𝐒𝐭𝐚𝐭𝐮𝐬:\n${res.data.message || "Database Cloned Successfully!"}`, tid, event.messageID);
        }

        // 📊 10. Status Endpoint (NEW)
        if (command === "status") {
            const res = await axios.get(`${API_URL}/api/autotrainer/status`);
            return api.sendMessage(`📊 𝐀𝐮𝐭𝐨𝐓𝐫𝐚𝐢𝐧𝐞𝐫 𝐒𝐭𝐚𝐭𝐮𝐬:\n${JSON.stringify(res.data, null, 2)}`, tid, event.messageID);
        }

        // ⏱️ 11. Uptime Endpoint (NEW)
        if (command === "uptime") {
            const res = await axios.get(`${API_URL}/uptime`);
            return api.sendMessage(`⏱️ 𝐀𝐏𝐈 𝐔𝐩𝐭𝐢𝐦𝐞:\n${JSON.stringify(res.data, null, 2)}`, tid, event.messageID);
        }

        // 💬 12. Default Smart Chat (Open for ALL users)
        const triggerWord = normalizeText(msg);
        const replyMessage = await getBotResponse(triggerWord);
        api.sendMessage(replyMessage, tid, (err, info) => {
            if (!err) {
                global.GoatBot.onReply.set(info.messageID, { 
                    commandName: module.exports.config.name, 
                    type: "reply", 
                    messageID: info.messageID, 
                    author: uid,
                    triggerWord: triggerWord
                });
            }
        }, event.messageID);

    } catch (error) {
        console.error(error);
        const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
        api.sendMessage(`❌ 𝐄𝐫𝐫𝐨𝐫: ${errMsg}`, tid, event.messageID);
    }
};

// ==========================================
//        ON-REPLY SYSTEM (♻️) + DYNAMIC DELETE
// ==========================================
module.exports.onReply = async ({ api, event, Reply }) => {
    if (event.type !== "message_reply") return;
    try {
        const API_URL = await getApiUrl();
        const fullMsg = (event.body || "").trim();
        const replyArgs = fullMsg.split(/\s+/);
        const replyCmd = replyArgs[0].toLowerCase();
        
        // Check if user is admin safely
        const isAdmin = isAdminUser(event.senderID);

        // 🔴 DYNAMIC REPLY TO DELETE FEATURE (Admin Only)
        if (replyCmd === "delete" || replyCmd === "rm") {
            if (!isAdmin) {
                return api.sendMessage("⚠️ ডাটাবেস থেকে ডিলিট করার পারমিশন শুধু এডমিনদের আছে!", event.threadID, event.messageID);
            }
            
            const triggerToDelete = Reply.triggerWord;
            const passwordToUse = replyArgs[1] || ADMIN_PASS;

            if (!triggerToDelete) return api.sendMessage("⚠️ আগের ট্রিগারটি খুঁজে পাওয়া যায়নি!", event.threadID, event.messageID);

            try {
                const res = await axios.delete(`${API_URL}/api/maruf/remove`, { data: { trigger: triggerToDelete, password: passwordToUse } });
                return api.sendMessage(`🗑️ ${res.data.message || "ডিলিট করা হয়েছে!"}`, event.threadID, event.messageID);
            } catch (err) {
                return api.sendMessage(`❌ 𝐄𝐫𝐫𝐨𝐫: ${err.message}`, event.threadID, event.messageID);
            }
        }

        // 🟢 NORMAL SMART CHAT REPLY (Open for ALL users)
        const userMsg = normalizeText(fullMsg);
        const replyMessage = await getBotResponse(userMsg);
        api.sendMessage(replyMessage, event.threadID, (err, info) => {
            if (!err) {
                global.GoatBot.onReply.set(info.messageID, { 
                    commandName: module.exports.config.name, 
                    type: "reply", 
                    messageID: info.messageID, 
                    author: event.senderID,
                    triggerWord: userMsg 
                });
            }
        }, event.messageID);
    } catch (err) { console.error(err); }
};

// ==========================================
//        AUTO-CHAT SYSTEM (🪄 NO PREFIX)
// ==========================================
module.exports.onChat = async ({ api, event }) => {
    try {
        const tid = event.threadID;

        const threadSetting = await ThreadSetting.findOne({ threadID: tid });
        if (threadSetting && threadSetting.autoChat === false) return;

        const message = event.body?.toLowerCase() || "";
        const isTriggered = triggersWords.some(word => message.startsWith(word));

        if (event.type !== "message_reply" && isTriggered) {

            const reactions = ["💖", "😘", "🥰", "🙈", "🤖", "✨", "🦋"];
            api.setMessageReaction(reactions[Math.floor(Math.random() * reactions.length)], event.messageID, () => {}, true);
            api.sendTypingIndicator(tid, true);

            let userText = message;
            for (const prefix of triggersWords) {
                if (message.startsWith(prefix)) {
                    userText = message.substring(prefix.length).trim();
                    break;
                }
            }

            if (!userText) {
                const randomMessages = ["Babu khuda lagse 🥺", "বলো কি বলবা? 🤭", "Bolo Babu? 🙈"];
                return api.sendMessage(`✨ ${randomMessages[Math.floor(Math.random() * randomMessages.length)]}`, tid, (err, info) => {
                    if (!err) global.GoatBot.onReply.set(info.messageID, { commandName: module.exports.config.name, type: "reply", messageID: info.messageID, author: event.senderID, triggerWord: "bby" });
                }, event.messageID);
            }

            const triggerWord = normalizeText(userText);
            const replyMessage = await getBotResponse(triggerWord);
            api.sendMessage(replyMessage, tid, (err, info) => {
                if (!err) global.GoatBot.onReply.set(info.messageID, { commandName: module.exports.config.name, type: "reply", messageID: info.messageID, author: event.senderID, triggerWord: triggerWord });
            }, event.messageID);
        }
    } catch (err) { console.error(err); }
};
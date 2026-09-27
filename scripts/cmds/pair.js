const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
        config: {
                name: "pair",
                aliases: ["pair2", "pair3", "pair4", "pair5", "pair6", "pair7"],
                version: "2.1",
                author: "Maruf",
                countDown: 10,
                role: 0,
                description: {
                        bn: "গ্রুপের মেম্বারদের সাথে অথবা মেনশন/রিপ্লাই দিয়ে পারফেক্ট ম্যাচ খুঁজুন (স্টাইল ১-৭)",
                        en: "Find your perfect match randomly or with mentioned/replied users (Styles 1-7)",
                        vi: "Tìm mảnh ghép hoàn hảo của bạn (Style 1-7)"
                },
                category: "love",
                guide: {
                        bn: '   {pn}: ডিফল্ট স্টাইল ১ দিয়ে রেন্ডম ম্যাচ\n   {pn} [১-৭]: নির্দিষ্ট স্টাইল (যেমন: pair 2, pair 5, pair2)\n   {pn} @mention [১-৭]: মেনশন/রিপ্লাই করে নির্দিষ্ট স্টাইলে ম্যাচ',
                        en: '   {pn}: Default style 1 random match\n   {pn} [1-7]: Specific style (e.g. pair 2, pair 5, pair2)\n   {pn} @mention [1-7]: Match mentioned/replied user with style',
                        vi: '   {pn}: Ghép đôi'
                }
        },

        langs: {
                bn: {
                        noGender: "× বেবি, আপনার জেন্ডার প্রোফাইলে সেট করা নেই",
                        noMatch: "× দুঃখিত, এই গ্রুপে আপনার জন্য কোনো ম্যাচ পাওয়া যায়নি",
                        selfMatch: "× বোকাসো! নিজের সাথে কি পেয়ার করতে চাও নাকি? 😅",
                        error: "× সমস্যা হয়েছে: %1। প্রয়োজনে Contact Maruf।"
                },
                en: {
                        noGender: "× Baby, your gender is not defined in your profile",
                        noMatch: "× Sorry, no match found for you in this group",
                        selfMatch: "× Silly! You can't pair with yourself! 😅",
                        error: "× API error: %1. Contact Maruf for help."
                },
                vi: {
                        noGender: "× Cưng ơi, giới tính của cưng không được xác định",
                        noMatch: "× Rất tiếc, không tìm thấy mảnh ghép nào cho cưng",
                        selfMatch: "× Ngốc quá! Không thể tự ghép đôi với chính mình! 😅",
                        error: "× Lỗi: %1. Liên hệ Maruf để hỗ trợ."
                }
        },

        onStart: async function ({ api, event, message, getLang, args }) {
                const authorName = "Maruf";
                if (this.config.author !== authorName) {
                        return api.sendMessage("You are not authorized to change the author name.", event.threadID, event.messageID);
                }

                const outputPath = path.join(__dirname, "cache", `pair_${event.senderID}_${Date.now()}.png`);
                if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });

                try {
                        api.setMessageReaction("💖", event.messageID, () => {}, true);

                        const threadData = await api.getThreadInfo(event.threadID);
                        const users = threadData.userInfo;
                        const myData = users.find((u) => u.id === event.senderID);

                        if (!myData || !myData.gender) return message.reply(getLang("noGender"));

                        // 🎯 স্টাইল নম্বর চেক (১ থেকে ৭) — ফাঁকা থাকুক বা না থাকুক দুটোই কাজ করবে
                        let style = "1";
                        const rawBody = (event.body || "").trim();
                        let foundStyle = null;

                        // Step 1: args থেকে try (যেমন: pair 2 @mention)
                        if (args && args.length > 0) {
                                foundStyle = args.find((a) => !isNaN(a) && Number(a) >= 1 && Number(a) <= 7);
                        }

                        // Step 2: args-এ না পেলে raw body থেকে parse (pair2 / Pair2 / pair 2)
                        if (!foundStyle) {
                                const m = rawBody.match(/(?:\D|^)([1-7])(?:\D|$)/);
                                if (m) foundStyle = m[1];
                        }

                        if (foundStyle) style = String(foundStyle);

                        let targetID = null;

                        // Check if replying to a message
                        if (event.messageReply && event.messageReply.senderID) {
                                targetID = event.messageReply.senderID;
                        }
                        // Check if someone is mentioned
                        else if (Object.keys(event.mentions || {}).length > 0) {
                                targetID = Object.keys(event.mentions)[0];
                        }

                        let selectedMatch;

                        if (targetID) {
                                if (targetID === event.senderID) {
                                        api.setMessageReaction("🤔", event.messageID, () => {}, true);
                                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                                        return message.reply(getLang("selfMatch"));
                                }
                                selectedMatch = users.find((u) => u.id === targetID) || { id: targetID, name: "Partner", gender: "UNKNOWN" };
                        } else {
                                // Random match logic based on gender
                                const myGender = myData.gender.toUpperCase();
                                let matchCandidates = [];

                                if (myGender === "MALE") {
                                        matchCandidates = users.filter((u) => u.gender === "FEMALE" && u.id !== event.senderID);
                                } else if (myGender === "FEMALE") {
                                        matchCandidates = users.filter((u) => u.gender === "MALE" && u.id !== event.senderID);
                                } else {
                                        matchCandidates = users.filter((u) => u.id !== event.senderID);
                                }

                                if (matchCandidates.length === 0) {
                                        api.setMessageReaction("🥺", event.messageID, () => {}, true);
                                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                                        return message.reply(getLang("noMatch"));
                                }

                                selectedMatch = matchCandidates[Math.floor(Math.random() * matchCandidates.length)];
                        }

                        const name1 = myData.name || "User";
                        const name2 = selectedMatch.name || "Partner";

                        // 🚀 Gateway Pair API Call
                        const apiUrl = "https://www.maruf-api.abrdns.com/pair/api/pair";
                        const response = await axios.get(apiUrl, {
                                params: {
                                        uid1: event.senderID,
                                        uid2: selectedMatch.id,
                                        name1: name1,
                                        name2: name2,
                                        style: style,
                                        format: "json"
                                }
                        });

                        const apiData = response.data;
                        if (!apiData.success || !apiData.data) {
                                throw new Error(apiData.message || "Failed to generate pair image from API");
                        }

                        const { percentage, loveBar, loveStatus, quote, imageBase64 } = apiData.data;

                        // Base64 ইমেজ সেভ করা
                        fs.writeFileSync(outputPath, Buffer.from(imageBase64, "base64"));

                        // ক্যাপশন তৈরি
                        const caption = `╭─ 💖 𝐒𝐎𝐔𝐋𝐌𝐀𝐓𝐄 𝐌𝐀𝐓𝐂𝐇 
│ 🧑‍💼 ${name1}
│ 👰 ${name2}
╰──────────
📊 𝐋𝐨𝐯𝐞 𝐏𝐞𝐫𝐜𝐞𝐧𝐭𝐚𝐠𝐞: ${percentage}%
💡 𝐒𝐭𝐚𝐭𝐮𝐬: ${loveStatus}
💌 ${quote}`;

                        return message.reply({
                                body: caption,
                                attachment: fs.createReadStream(outputPath)
                        }, () => {
                                api.setMessageReaction("✅", event.messageID, () => {}, true);
                                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        });

                } catch (err) {
                        console.error("Pair Error:", err);
                        api.setMessageReaction("❌", event.messageID, () => {}, true);
                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        return message.reply(getLang("error", err.message));
                }
        }
};
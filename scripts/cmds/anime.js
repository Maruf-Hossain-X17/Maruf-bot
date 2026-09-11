const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const baseApiUrl = async () => {
    const base = await axios.get("https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json");
    return base.data.mahmud;
};

module.exports = {
    config: {
        name: "anime",
        aliases: ["aedit"],
        version: "1.7",
        author: "MahMUD",
        countDown: 10,
        role: 0,
        description: {
            bn: "যেকোনো এনিমে এডিট ভিডিও সার্চ করে ডাউনলোড করুন",
            en: "Search and download any anime edit video",
            vi: "Tìm kiếm và tải xuống bất kỳ video chỉnh sửa anime nào"
        },
        category: "anime",
        guide: {
            bn: '   {pn} <নাম>: (যেমন: {pn} Goku Ultra)',
            en: '   {pn} <keyword>: (Ex: {pn} Goku Ultra)',
            vi: '   {pn} <từ khóa>: (VD: {pn} Goku Ultra)'
        }
    },

    langs: {
        bn: {
            noInput: "× বেবি, কোন এনিমে এডিট ভিডিওটি খুঁজছো? নাম বলো",
            tooLarge: "× ভিডিওটি অনেক বড় (২৫ মেগাবাইটের বেশি)!",
            success: "• 𝐇𝐄𝐑𝐄'𝐒 𝐘𝐎𝐔𝐑 𝐀𝐍𝐈𝐌𝐄 𝐄𝐃𝐈𝐓𝐙 𝐕𝐈𝐃𝐄𝐎\n• 𝐒𝐞𝐚𝐫𝐜𝐡: %1",
            error: "× সমস্যা হয়েছে: %1। প্রয়োজনে Contact MahMUD।"
        },
        en: {
            noInput: "× Baby, what anime edit video are you looking for?",
            tooLarge: "× Video too large (over 25MB)!",
            success: "• 𝐇𝐄𝐑𝐄'𝐒 𝐘𝐎𝐔𝐑 𝐀𝐍𝐈𝐌𝐄 𝐄𝐃𝐈𝐓𝐙 𝐕𝐈𝐃𝐄𝐎\n• 𝐒𝐞𝐚𝐫𝐜𝐡: %1",
            error: "× API error: %1. Contact MahMUD for help."
        },
        vi: {
            noInput: "× Cưng ơi, cưng đang tìm video anime edit nào?",
            tooLarge: "× Video quá lớn (hơn 25MB)!",
            success: "• 𝐕𝐢𝐝𝐞𝐨 𝐀𝐧𝐢𝐦𝐞 𝐄𝐝𝐢𝐭 𝐜𝐮̉𝐚 𝐜𝐮̛𝐧𝐠 đ𝐚̂𝐲\n• 𝐓𝐢̀𝐦 𝐤𝐢𝐞̂́𝐦: %1",
            error: "× Lỗi: %1. Liên hệ MahMUD để hỗ trợ."
        }
    },

    onStart: async function ({ api, event, args, message, getLang }) {
        const authorName = String.fromCharCode(77, 97, 104, 77, 85, 68);
        if (this.config.author !== authorName) {
            return api.sendMessage("You are not authorized to change the author name.", event.threadID, event.messageID);
        }

        const keyword = args.join(" ");
        if (!keyword) return message.reply(getLang("noInput"));

        const cacheDir = path.join(__dirname, "cache");
        const videoPath = path.join(cacheDir, `ani_${Date.now()}.mp4`);
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

        try {
            api.setMessageReaction("⏳", event.messageID, () => {}, true);

            const baseURL = await baseApiUrl();
            const res = await axios({
                method: "GET",
                url: `${baseURL}/api/tiksr`,
                params: { sr: keyword },
                responseType: "stream"
            });

            const writer = fs.createWriteStream(videoPath);
            res.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on("finish", async () => {
                    try {
                        const stats = fs.statSync(videoPath);
                        if (stats.size > 26214400) { // 25MB Limit
                            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                            api.setMessageReaction("⚠️", event.messageID, () => {}, true);
                            return resolve(message.reply(getLang("tooLarge")));
                        }

                        await message.reply({
                            body: getLang("success", keyword),
                            attachment: fs.createReadStream(videoPath)
                        }, () => {
                            api.setMessageReaction("✅", event.messageID, () => {}, true);
                            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                        });
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });

                writer.on("error", (err) => {
                    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                    reject(err);
                });
            });

        } catch (err) {
            console.error("AniEdit Error:", err);
            api.setMessageReaction("❌", event.messageID, () => {}, true);
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            return message.reply(getLang("error", err.message));
        }
    }
};

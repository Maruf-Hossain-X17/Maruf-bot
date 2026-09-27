const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const baseApiUrl = async () => {
        const base = await axios.get("https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json");
        return base.data.mahmud;
};

module.exports = {
        config: {
                name: "art",
                aliases: ["artify", "photoart"],
                version: "1.7",
                author: "MahMUD", // credit Change dile thapramu kintu.
                countDown: 10,
                role: 0,
                description: {
                        en: "Transform your photo into various art styles",
                        bn: "আপনার ছবিকে বিভিন্ন আর্ট স্টাইলে রূপান্তর করুন",
                        vi: "Chuyển đổi ảnh của bạn thành nhiều phong cách nghệ thuật khác nhau"
                },
                category: "TOOLS",
                guide: {
                        en: "{pn} [1-100] Reply to a photo or {pn} list",
                        bn: "{pn} [১-১০০] ছবিতে রিপ্লাই দিন) অথবা {pn} list",
                        vi: "{pn} [1-100] Phản hồi một ảnh hoặc {pn} list"
                }
        },

       langs: {
  bn: {
    list_header: "Available Art Styles:\n\n",
    no_image: "একটি ছবিতে রিপ্লাই দিন।",
    invalid_style: "স্টাইল 1-100 এর মধ্যে হতে হবে।",
    generating: "Processing...",
    error: "%1",
    success: "Here's your art image baby"
  },
  en: {
    list_header: "Available Art Styles:\n\n",
    no_image: "Reply to a photo.",
    invalid_style: "Style must be between 1 and 100.",
    generating: "Processing...",
    error: "%1",
    success: "Here's your art image baby"
  },
  vi: {
    list_header: "Available Art Styles:\n\n",
    no_image: "Reply to a photo.",
    invalid_style: "Style must be between 1 and 100.",
    generating: "Processing...",
    error: "%1",
    success: "Here's your art image baby"
  }
},

        onStart: async function ({ api, event, args, message, getLang }) {
                const authorName = String.fromCharCode(77, 97, 104, 77, 85, 68);
                if (this.config.author !== authorName) {
                        return api.sendMessage("You are not authorized to change the author name.", event.threadID, event.messageID);
                }

                const { threadID, messageID } = event;
                const cacheDir = path.join(__dirname, "cache");
                const cachePath = path.join(cacheDir, `art_${threadID}_${Date.now()}.png`);
                let waitMsg;

                try {
                        const baseUrl = await baseApiUrl();
                        const apiEndpoint = `${baseUrl}/api/art`;

                        if (args[0] === "list") {
                                const res = await axios.get(`${apiEndpoint}/list`);
                                const styles = res.data.styles;
                                let text = getLang("list_header");
                                for (const key in styles) {
                                        text += `${key}: ${styles[key]}\n`;
                                }
                                return message.reply(text);
                        }

                        const replied = event.messageReply?.attachments?.[0];
                        if (!replied || replied.type !== "photo") {
                                return message.reply(getLang("no_image"));
                        }

                        const styleNum = parseInt(args[0] || "1");
                        if (isNaN(styleNum) || styleNum < 1 || styleNum > 100) {
                                return message.reply(getLang("invalid_style"));
                        }

                        const imageUrl = encodeURIComponent(replied.url);

                        let styleName = "Loading...";
                        try {
                                const listRes = await axios.get(`${apiEndpoint}/list`);
                                styleName = listRes.data.styles[styleNum] || "Custom Art";
                        } catch (e) {
                                styleName = "Art";
                        }

                        api.setMessageReaction("⏳", messageID, () => { }, true);
                        
                        waitMsg = await message.reply(getLang("generating", styleNum, styleName));

                        const res = await axios({
                                url: `${apiEndpoint}?imageUrl=${imageUrl}&style=${styleNum}`,
                                method: "GET",
                                responseType: "arraybuffer",
                                timeout: 180000
                        });

                        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                        fs.writeFileSync(cachePath, Buffer.from(res.data, "binary"));
                        
                        if (waitMsg) message.unsend(waitMsg.messageID);

                        const body = getLang("success", styleNum, styleName);

                        return message.reply({
                                body: body,
                                attachment: fs.createReadStream(cachePath)
                        }, () => { 
                                api.setMessageReaction("🕊️", messageID, () => { }, true);
                                if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); 
                        });

                } catch (err) {
                        if (waitMsg) message.unsend(waitMsg.messageID);
                        api.setMessageReaction("❌", messageID, () => { }, true);
                        if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                        return message.reply(getLang("error", err.message || "API Error"));
                }
        }
};
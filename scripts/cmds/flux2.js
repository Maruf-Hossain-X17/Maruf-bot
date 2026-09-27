const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
        config: {
                name: "flux2",
                version: "1.0",
                author: "Maruf",
                countDown: 5,
                role: 0,
                shortDescription: "Generate AI Image",
                longDescription: "Generate AI image using your Render API",
                category: "ai",
                guide: {
                        en: "{pn} <prompt>"
                }
        },

        onStart: async function ({ api, event, args, message }) {
                const prompt = args.join(" ");

                if (!prompt)
                        return message.reply("❌ | Please enter a prompt.");

                try {
                        await message.reply("⏳ | Generating image...");

                        // ১. Raw GitHub লিংক থেকে API Base URL ফেচ করা
                        const rawJsonUrl = "https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json";
                        const jsonResponse = await axios.get(rawJsonUrl);
                        
                        // JSON থেকে 'image-api' এর URL বের করা
                        const baseUrl = jsonResponse.data.apis["image-api"].url;

                        // ২. মেইন ইমেজ জেনারেশন API তৈরি ও কল করা
                        const url = `${baseUrl}/generate?prompt=${encodeURIComponent(prompt)}`;

                        const res = await axios.get(url, {
                                responseType: "arraybuffer",
                                timeout: 120000
                        });

                        const cacheDir = path.join(__dirname, "cache");
                        if (!fs.existsSync(cacheDir))
                                fs.mkdirSync(cacheDir, { recursive: true }); // recursive: true দেওয়া ভালো

                        const filePath = path.join(cacheDir, `flux2_${Date.now()}.jpg`);

                        fs.writeFileSync(filePath, res.data);

                        await message.reply({
                                body: `✅ Generated Successfully\n📝 Prompt: ${prompt}`,
                                attachment: fs.createReadStream(filePath)
                        });

                        fs.unlinkSync(filePath);

                } catch (err) {
                        console.error(err);
                        message.reply(`❌ Error: ${err.message}`);
                }
        }
};
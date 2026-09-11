const axios = require("axios");
const fs = require("fs");
const path = require("path");

const cachePath = path.join(__dirname, "cache");
if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath);

module.exports = {
  config: {
    name: "imgai",
    version: "1.0",
    author: "ChatGPT",
    countDown: 5,
    role: 0,
    shortDescription: "যেকোনো ইংরেজি প্রম্পট দিয়ে AI ছবি তৈরি করো 🎨",
    longDescription: "Pollinations.ai ব্যবহার করে যেকোনো scene, object, বা image description থেকে ছবি তৈরি করো।",
    category: "ai",
    guide: "{pn} a magical forest with glowing mushrooms"
  },

  onStart: async function ({ message, args }) {
    const prompt = args.join(" ");
    if (!prompt) {
      return message.reply("❗ দয়া করে একটি ইংরেজি প্রম্পট দাও।\nউদাহরণ: pollinate a cat flying in space");
    }

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    const imgPath = path.join(cachePath, `pollinate_${Date.now()}.jpg`);

    try {
      const response = await axios.get(imageUrl, { responseType: "stream" });
      const writer = fs.createWriteStream(imgPath);
      response.data.pipe(writer);

      writer.on("finish", () => {
        message.reply({
          body: `🎨 তোমার প্রম্পট: "${prompt}" অনুযায়ী তৈরি ছবি`,
          attachment: fs.createReadStream(imgPath)
        }, () => fs.unlinkSync(imgPath));
      });

      writer.on("error", () => {
        message.reply("❌ ছবি ডাউনলোড করতে সমস্যা হয়েছে।");
      });
    } catch (err) {
      console.error("❌ Pollinations API Error:", err.message);
      message.reply("⚠ কিছু ভুল হয়েছে। পরে আবার চেষ্টা করো।");
    }
  }
};
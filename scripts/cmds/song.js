const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

/**
 * 🌐 রিমোট কনফিগারেশন থেকে API URL সংগ্রহ।
 */
async function getBaseApiUrl() {
  try {
    const { data } = await axios.get(
      "https://raw.githubusercontent.com/Mostakim0978/D1PT0/refs/heads/main/baseApiUrl.json"
    );
    return data.api;
  } catch (error) {
    throw new Error("API endpoint unreachable.");
  }
}

/**
 * ❤️ রিঅ্যাকশন হ্যান্ডেলার।
 */
async function safeReact(message, emoji) {
  try {
    if (typeof message.react === "function") {
      await message.react(emoji);
    } else if (message.api?.setMessageReaction) {
      await message.api.setMessageReaction(emoji, message.messageID, message.threadID);
    }
  } catch (e) { /* Ignore reaction errors */ }
}

module.exports = {
  config: {
    name: "song",
    version: "4.5.0",
    author: "GPT-5 / Refined",
    role: 0,
    category: "media",
    noPrefix: true,
    description: "YouTube থেকে গান ডাউনলোড করে পাঠাবে।"
  },

  onStart: async function () {},

  onChat: async function ({ message, event }) {
    let { body } = event;
    if (!body) return;
    body = body.trim();

    // কমান্ড চেক
    if (body.toLowerCase() === "song") {
      return message.reply("🎵 গান শুনতে চাইলে টাইপ করুন: `song <গানের নাম>`");
    }

    if (!body.toLowerCase().startsWith("song ")) return;

    const keyword = body.slice(5).trim();
    if (!keyword) return message.reply("⚠️ গানের নাম দিতে ভুলে গেছেন!");

    const infoMsg = await message.reply("🔎 গানটি খোঁজা হচ্ছে, দয়া করে অপেক্ষা করুন...");
    const filePath = path.join(__dirname, `tmp_${Date.now()}.mp3`);

    try {
      const apiBase = await getBaseApiUrl();

      // ১. গান সার্চ করা
      const searchRes = await axios.get(`${apiBase}/ytFullSearch?songName=${encodeURIComponent(keyword)}`);
      const song = searchRes.data[0];

      if (!song || !song.id) {
        await message.unsend(infoMsg.messageID);
        return message.reply("❌ দুঃখিত, গানটি পাওয়া যায়নি।");
      }

      // ২. ডাউনলোড লিঙ্ক সংগ্রহ
      await message.unsend(infoMsg.messageID);
      const downloadingMsg = await message.reply(`⬇️ "${song.title}" ডাউনলোড হচ্ছে...`);

      const dlRes = await axios.get(`${apiBase}/ytDl3?link=${song.id}&format=mp3&quality=3`);
      const downloadLink = dlRes.data.downloadLink;

      if (!downloadLink) throw new Error("Download link not found");

      // ৩. ফাইল ডাউনলোড
      const response = await axios({
        method: 'get',
        url: downloadLink,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // ৪. ফাইল পাঠানো
      await message.unsend(downloadingMsg.messageID);
      const sent = await message.reply({
        body: `🎶 গান: ${song.title}\n⏱️ সময়: ${song.duration_raw || 'N/A'}\n👤 শিল্পী: ${song.author.name}`,
        attachment: fs.createReadStream(filePath)
      });

      await safeReact(sent, "✅");

    } catch (error) {
      console.error("Song Error:", error);
      if (infoMsg.messageID) await message.unsend(infoMsg.messageID).catch(() => {});
      message.reply("❌ গানটি প্রসেস করার সময় একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      // ৫. ক্লিনআপ (ফাইল ডিলিট)
      setTimeout(() => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }, 30000); // ৩০ সেকেন্ড পর ফাইল মুছে যাবে
    }
  }
};
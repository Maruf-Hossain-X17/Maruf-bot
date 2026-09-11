const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { pipeline } = require("stream/promises");

// GitHub থেকে ডায়নামিক API ফেচ করার হেলপার ফাংশন
async function fetchBaseApiUrl() {
  const GITHUB_RAW = "https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json";
  
  const response = await axios.get(`${GITHUB_RAW}?t=${Date.now()}`, { timeout: 10000 });
  let data = response.data;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      throw new Error("GitHub JSON ফরম্যাটে ত্রুটি রয়েছে!");
    }
  }

  const endpoint = data?.apis?.sing?.url || data?.apis?.sing?.main?.url;
  if (!endpoint) throw new Error("GitHub JSON ফাইলে API URL পাওয়া যায়নি!");

  return endpoint;
}

module.exports = {
  config: {
    name: "sing",
    version: "4.1.0",
    author: "Maruf Hossain",
    countDown: 8,
    role: 0,
    description: {
      bn: "ইউটিউব থেকে দ্রুত গান সার্চ করুন এবং হাই-কোয়ালিটি অডিও ডাউনলোড করুন",
      en: "Search and stream high-quality audio tracks directly from YouTube",
      vi: "Tìm kiếm và tải xuống bài hát chất lượng cao từ YouTube"
    },
    category: "music",
    guide: {
      bn: "   {pn} <গানের নাম বা লিঙ্ক>",
      en: "   {pn} <song title or URL>",
      vi: "   {pn} <tên bài hát hoặc URL>"
    }
  },

  langs: {
    bn: {
      noInput: "⚠️ বেবি, প্রিয় গানের নাম বা লিঙ্ক দাও!\n\n💡 উদাহরণ: {pn} shape of you",
      success: "🎶 𝐒𝐨𝐧𝐠: %1\n⏱️ 𝐃𝐮𝐫𝐚𝐭𝐢𝐨𝐧: %2\n🎧 𝐐𝐮𝐚𝐥𝐢𝐭𝐲: High Quality Audio\n\n✨ উপভোগ করো তোমার গান বেবি! ❤️",
      error: "❌ গান প্রসেস করতে সমস্যা হয়েছে: %1\nপ্রয়োজনে যোগাযোগ করুন: Maruf Hossain"
    },
    en: {
      noInput: "⚠️ Please provide a song name or YouTube link!\n\n💡 Example: {pn} shape of you",
      success: "🎶 𝐒𝐨𝐧𝐠: %1\n⏱️ 𝐃𝐮𝐫𝐚𝐭𝐢𝐨𝐧: %2\n🎧 𝐐𝐮𝐚𝐥𝐢𝐭𝐲: High Quality Audio\n\n✨ Enjoy your song baby! ❤️",
      error: "❌ Failed to fetch audio: %1\nContact Maruf Hossain for support."
    },
    vi: {
      noInput: "⚠️ Vui lòng nhập tên bài hát hoặc URL!\n\n💡 Ví dụ: {pn} shape of you",
      success: "🎶 𝐁𝐚̀𝐢 𝐡𝐚́𝐭: %1\n⏱️ 𝐓𝐡𝐨̛̀𝐢 𝐥𝐮̛𝐨̛̣𝐧𝐠: %2\n🎧 𝐂𝐡𝐚̂́𝐭 𝐥𝐮̛𝐨̛̣𝐧𝐠: High Quality Audio\n\n✨ Chúc bạn nghe nhạc vui vẻ! ❤️",
      error: "❌ Lỗi: %1. Liên hệ Maruf Hossain để hỗ trợ."
    }
  },

  onStart: async function ({ api, event, args, message, getLang }) {
    // Author Integrity System
    const validAuthor = String.fromCharCode(77, 97, 114, 117, 102, 32, 72, 111, 115, 115, 97, 105, 110);
    if (this.config.author !== validAuthor) {
      return api.sendMessage(
        "⛔ Authorization Error: You are not allowed to modify the author field.",
        event.threadID,
        event.messageID
      );
    }

    const searchQuery = args.join(" ").trim();
    if (!searchQuery) return message.reply(getLang("noInput"));

    const cacheFolder = path.resolve(__dirname, "cache");
    const uniqueFile = `sing_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp3`;
    const tempFilePath = path.join(cacheFolder, uniqueFile);

    try {
      // প্রসেসিং ইমোজি সেটআপ
      api.setMessageReaction("⌛", event.messageID, () => {}, true);

      // ১. গিটহাব থেকে বেস API ইউআরএল সংগ্রহ
      const baseUrl = await fetchBaseApiUrl();
      const apiUrl = `${baseUrl.replace(/\/$/, "")}/ytDl`;

      // ২. অডিও স্ট্রিম তথ্য রিকোয়েস্ট
      const { data: resData } = await axios.get(apiUrl, {
        params: { url: searchQuery },
        timeout: 30000
      });

      if (!resData || (!resData.status && !resData.success) || !resData.downloadLink) {
        throw new Error(resData?.error || resData?.message || "অডিও লিঙ্ক তৈরি করা সম্ভব হয়নি!");
      }

      // ৩. ক্যাশ ডিরেক্টরি সুনিশ্চিত করা
      await fs.ensureDir(cacheFolder);

      // ৪. সরাসরি ইউটিউবের ডাউনলোড লিংক থেকে ফাস্ট ও রিলায়েবল ডাউনলোড (403 এড়ানোর জন্য)
      const streamResponse = await axios({
        method: "GET",
        url: resData.downloadLink,
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://www.youtube.com/"
        },
        timeout: 90000
      });

      // ফাইল পলিফিল স্ট্রিমিং
      await pipeline(streamResponse.data, fs.createWriteStream(tempFilePath));

      const title = resData.title || searchQuery;
      const duration = resData.duration || resData.time || "N/A";

      // ৫. মেসেঞ্জারে অডিও রেসপন্স সেন্ড করা
      await message.reply({
        body: getLang("success", title, duration),
        attachment: fs.createReadStream(tempFilePath)
      });

      api.setMessageReaction("🎵", event.messageID, () => {}, true);

    } catch (error) {
      console.error("[Sing Command Error]:", error.message);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      
      const errMsg = error.response?.data?.error || error.message || "Unknown error occurred";
      return message.reply(getLang("error", errMsg));

    } finally {
      // ৬. মেমোরি সেভ করার জন্য টেম্পোরারি ফাইল অটো রিমুভ
      if (await fs.pathExists(tempFilePath)) {
        await fs.remove(tempFilePath).catch(() => {});
      }
    }
  }
};
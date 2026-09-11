const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { shortenURL } = global.utils;

// Primary & fallback APIs
const primaryApi = "https://api.noobs-api.rf.gd/dipto/alldl";
const fallbackApi = "https://api.noobs-api.rf.gd/dipto/m/alldl";

module.exports = {
  config: {
    name: "autodl",
    version: "1.2.0",
    author: "404 + Optimized",
    countDown: 0,
    role: 0,
    description: {
      en: "Automatically download videos from TikTok, Facebook, Instagram, YouTube, Twitter, and more.",
    },
    category: "media",
    guide: {
      en: "[video_link]",
    },
  },

  onStart: async function () {},

  onChat: async function ({ api, event }) {
    const messageText = event.body?.trim();
    if (!messageText) return;

    // Supported platform prefixes
    const supportedPlatforms = [
      "https://vt.tiktok.com",
      "https://vm.tiktok.com",
      "https://www.tiktok.com/",
      "https://www.facebook.com",
      "https://fb.watch",
      "https://www.instagram.com/",
      "https://youtu.be/",
      "https://youtube.com/",
      "https://x.com/",
      "https://twitter.com/"
    ];

    const isSupported = supportedPlatforms.some(prefix =>
      messageText.startsWith(prefix)
    );
    if (!isSupported) return;

    api.setMessageReaction("🤪", event.messageID, () => {}, true);

    // Ensure cache folder exists
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
    }

    const filePath = path.join(cacheDir, `video_${Date.now()}.mp4`);

    try {
      // Try primary API first
      let videoUrl, videoTitle;
      try {
        const { data } = await axios.get(
          `${primaryApi}?url=${encodeURIComponent(messageText)}`
        );
        if (!data?.result) throw new Error("Primary API returned no result");
        videoUrl = data.result;
        videoTitle = data.cp || "🎥 Downloaded Video";
      } catch (err) {
        console.warn("Primary API failed, trying fallback...");
        const { data } = await axios.get(
          `${fallbackApi}?url=${encodeURIComponent(messageText)}`
        );
        if (!data?.url) throw new Error("Fallback API returned no result");
        videoUrl = data.url;
        videoTitle = "🎥 Downloaded Video";
      }

      // Download video
      const videoResponse = await axios.get(videoUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(filePath, Buffer.from(videoResponse.data, "binary"));

      // Shorten video URL (optional)
      let shortUrl;
      try {
        shortUrl = await shortenURL(videoUrl);
      } catch {
        shortUrl = null;
      }

      // Send video
      await api.sendMessage(
        {
          body: `${videoTitle}\n🔗 Link: ${shortUrl || videoUrl}`,
          attachment: fs.createReadStream(filePath),
        },
        event.threadID,
        () => fs.unlink(filePath, () => {}), // delete after sending
        event.messageID
      );

      api.setMessageReaction("✅", event.messageID, () => {}, true);

    } catch (error) {
      console.error("AutoDL Error:", error);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      api.sendMessage(
        `⚠️ Could not download this video.\nReason: ${error.message}\n👉 Try another link or make sure the video is public.`,
        event.threadID,
        event.messageID
      );
    }
  },
};
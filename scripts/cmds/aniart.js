const axios = require("axios");
const fs = require("fs");
const path = require("path");

const baseApiUrl = async () => {
  try {
    const { data } = await axios.get(
      "https://gitlab.com/Rakib-Adil-69/shizuoka-command-store/-/raw/main/apiUrls.json"
    );
    return data.aniart;
  } catch (error) {
    console.error("Failed to fetch API URL:", error);
    return null;
  }
};

module.exports = {
  config: {
    name: "aniart",
    aliases: ["anigen", "animeart"],
    author: "Maruf",
    version: "1.1.2",
    countDown: 10,
    description: "Generate anime art image from a prompt",
    guide: "{pn} <prompt>",
    category: "Ai"
  },

  onStart: async function ({ api, args, event, message }) {
    if (!args.length) {
      return api.sendMessage(
        "⚠️ Please provide a prompt.\n\nExample:\n{pn} cyberpunk anime girl",
        event.threadID,
        event.messageID
      );
    }

    const prompt = args.join(" ");
    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    const loading = await message.reply(
      "⏳ 𝙒𝙖𝙞𝙩 𝙗𝙗𝙮, 𝙮𝙤𝙪𝙧 𝙖𝙣𝙞𝙢𝙚 𝙖𝙧𝙩 𝙞𝙨 𝙗𝙚𝙞𝙣𝙜 𝙜𝙚𝙣𝙚𝙧𝙖𝙩𝙚𝙙...\n\n👨‍💻 Author: Maruf"
    );

    try {
      const baseUrl = await baseApiUrl();
      if (!baseUrl) throw new Error("API URL configuration not available.");

      const requestId = `rakib-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      const { data } = await axios.post(
        `${baseUrl}/rakib`,
        { inputText: prompt, requestId },
        { timeout: 120000, headers: { "Content-Type": "application/json" } }
      );

      const imageUrl = data.resultUrl || data.response || data.image || data.url;
      if (!imageUrl) throw new Error("Image URL not found in API response.");

      // Ensure cache directory exists
      const cacheDir = path.join(__dirname, "cache");
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

      const filePath = path.join(cacheDir, `${requestId}.png`);
      
      // Download the image to a local file with .png extension
      const writer = fs.createWriteStream(filePath);
      const response = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream'
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          if (loading?.messageID) api.unsendMessage(loading.messageID);
          api.setMessageReaction("✅", event.messageID, () => {}, true);

          await api.sendMessage(
            {
              body: `✨ 𝘼𝙣𝙞𝙢𝙚 𝘼𝙧𝙩 𝙂𝙚𝙣𝙚𝙧𝙖𝙩𝙚𝙙 Successfully!\n\n📝 Prompt: ${prompt}`,
              attachment: fs.createReadStream(filePath)
            },
            event.threadID,
            () => fs.unlinkSync(filePath), // Delete after sending
            event.messageID
          );
          resolve();
        });

        writer.on('error', (err) => {
          if (loading?.messageID) api.unsendMessage(loading.messageID);
          api.setMessageReaction("❌", event.messageID, () => {}, true);
          reject(err);
        });
      });

    } catch (err) {
      console.error("AniArt Error:", err.message);
      if (loading?.messageID) api.unsendMessage(loading.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);

      return api.sendMessage(
        "❌ Failed to generate anime art. The API might be busy, please try again later.",
        event.threadID,
        event.messageID
      );
    }
  }
};
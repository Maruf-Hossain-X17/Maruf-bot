const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "sing2",
    version: "2.1.0",
    author: "Maruf",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "YouTube Video/Audio Downloader"
    },
    longDescription: {
      en: "Download YouTube videos or audio using custom API gateway"
    },
    category: "media",
    guide: {
      en: "{pref}sing2 [-a|-v] <url/query>"
    }
  },

  onStart: async function ({ message, args }) {
    let filePath = null;

    try {
      if (!args[0]) {
        return message.reply(
          "❌ Please provide a YouTube link or search query!\n\n" +
          "Examples:\n" +
          "• !sing2 -a Faded Alan Walker\n" +
          "• !sing2 -v Faded Alan Walker\n" +
          "• !sing2 -a <YouTube link>\n" +
          "• !sing2 -v <YouTube link>"
        );
      }

      let isAudio = true; // Default = Audio
      let inputArgs = [...args];

      // Audio
      if (
        inputArgs.includes("-a") ||
        inputArgs.includes("--audio")
      ) {
        isAudio = true;

        inputArgs = inputArgs.filter(
          arg => arg !== "-a" && arg !== "--audio"
        );
      }

      // Video
      else if (
        inputArgs.includes("-v") ||
        inputArgs.includes("--video")
      ) {
        isAudio = false;

        inputArgs = inputArgs.filter(
          arg => arg !== "-v" && arg !== "--video"
        );
      }

      const searchQuery = inputArgs.join(" ").trim();

      if (!searchQuery) {
        return message.reply(
          "❌ YouTube link or search query not found!"
        );
      }

      const type = isAudio ? "Audio" : "Video";

      message.reply(
        `⏳ Processing ${type}, please wait...`
      );

      // API
      const apiUrl =
        `https://api.maruf-api.abrdns.com/ytdl/ytDl?url=${encodeURIComponent(searchQuery)}`;

      const response = await axios.get(apiUrl, {
        timeout: 60000
      });

      const data = response.data;

      if (!data || !data.status || !data.streamUrl) {
        return message.reply(
          `❌ ${type} extraction failed: ${
            data?.error || "Unknown Error"
          }`
        );
      }

      const title = data.title || "media";
      const streamUrl = data.streamUrl;
      const duration = data.duration || null;

      // File extension
      const ext = isAudio ? "mp3" : "mp4";

      // Clean title
      const cleanTitle = title
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, " ")
        .trim();

      const cacheDir = path.join(__dirname, "cache");

      await fs.ensureDir(cacheDir);

      filePath = path.join(
        cacheDir,
        `${Date.now()}_${cleanTitle}.${ext}`
      );

      // Download stream
      const fileResponse = await axios({
        method: "GET",
        url: streamUrl,
        responseType: "stream",
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const writer = fs.createWriteStream(filePath);

      fileResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
        fileResponse.data.on("error", reject);
      });

      // Check file
      if (!await fs.pathExists(filePath)) {
        throw new Error("Downloaded file was not found.");
      }

      const stats = await fs.stat(filePath);
      const fileSizeInMB =
        stats.size / (1024 * 1024);

      // Messenger 45MB limit
      if (fileSizeInMB > 45) {
        await fs.remove(filePath);
        filePath = null;

        return message.reply(
          `⚠️ File is too large (${fileSizeInMB.toFixed(1)} MB).\n\n` +
          `${isAudio ? "🎵" : "🎬"} ${title}\n` +
          `⏱️ Duration: ${
            duration ? duration + "s" : "N/A"
          }\n\n` +
          `📥 Direct download:\n${streamUrl}`
        );
      }

      // Send file
      await message.reply({
        body:
          `${isAudio ? "🎵" : "🎬"} ${title}\n` +
          `⏱️ Duration: ${
            duration ? duration + "s" : "N/A"
          }\n` +
          `📌 Size: ${fileSizeInMB.toFixed(1)} MB\n` +
          `📁 Format: ${ext.toUpperCase()}`,

        attachment: fs.createReadStream(filePath)
      });

    } catch (err) {
      console.error("SING2 ERROR:", err);

      return message.reply(
        `❌ Error: ${
          err.response?.data?.error ||
          err.message ||
          "Server is not responding"
        }`
      );

    } finally {
      // Delete cache after sending
      if (
        filePath &&
        await fs.pathExists(filePath)
      ) {
        try {
          await fs.remove(filePath);
        } catch (error) {
          console.error(
            "Cleanup error:",
            error
          );
        }
      }
    }
  }
};
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "edit",
    version: "2.0.0",
    author: "Bokkor x69",
    countDown: 5,
    role: 0,
    description: "AI image edit using prompt",
    category: "Tools",
    guide: {
      en: "{pn} <prompt> (reply to image)"
    }
  },

  onStart: async function ({ message, event, args, api }) {
    const prompt = args.join(" ");

    if (!prompt) {
      return message.reply("Please provide a prompt");
    }

    const reply = event.messageReply;
    const img = reply?.attachments?.[0];

    // ✅ safe validation (no type restriction)
    if (!img || !img.url) {
      return message.reply("Please reply to an image");
    }

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);

    const imgPath = path.join(cacheDir, `${Date.now()}_edit.jpg`);

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      // base API
      const baseURL = (
        await axios.get(
          "https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json"
        )
      ).data.mahmud;

      // edit request
      const res = await axios.post(
        `${baseURL}/api/edit`,
        {
          prompt,
          imageUrl: img.url
        },
        { responseType: "arraybuffer" }
      );

      await fs.writeFile(imgPath, Buffer.from(res.data));

      api.setMessageReaction("✅", event.messageID, () => {}, true);

      return message.reply({
        body: `𝐇𝐞𝐫𝐞 𝐘𝐨𝐮𝐫 𝐄𝐝𝐢𝐭𝐞𝐝 𝐈𝐦𝐚𝐠𝐞 𝐁𝐚𝐛𝐲 ✅ `,
        attachment: fs.createReadStream(imgPath)
      });

    } catch (err) {
      console.error(err);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      return message.reply("Failed to edit image");
    } finally {
      setTimeout(() => {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }, 10000);
    }
  }
};
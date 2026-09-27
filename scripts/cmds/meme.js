const axios = require("axios");

module.exports = {
  config: {
    name: "meme",
    aliases: [],
    version: "1.4",
    author: "Bokkor",
    countDown: 3,
    role: 0,
    shortDescription: { en: "Add or get random meme" },
    category: "fun",
    guide: { en: "!meme - random meme\n!meme add (reply imgs or URLs) - add meme(s)\n!meme list - show total memes" }
  },

  onStart: async function({ event, message, args }) {
    const baseUrl = "https://meme-api-8ni9.onrender.com/api/meme";

    if (args[0] === "add") {
      let urlsToAdd = [];

      if (event.messageReply && event.messageReply.attachments.length) {
        for (const att of event.messageReply.attachments) {
          if (att.type === "photo" || att.type === "image") {
            urlsToAdd.push(att.url);
          }
        }
      }

      if (args.length > 1) {
        for (let i = 1; i < args.length; i++) {
          if (/^https?:\/\//.test(args[i])) {
            urlsToAdd.push(args[i]);
          }
        }
      }

      if (urlsToAdd.length === 0) {
        return message.reply("⚠️ Please reply with images or provide URLs to add memes.");
      }

      let addedCount = 0, duplicateCount = 0, failedCount = 0;

      for (const url of urlsToAdd) {
        try {
          const res = await axios.get(`${baseUrl}/add?url=${encodeURIComponent(url)}`);

          addedCount += res.data.addedCount || 0;
          duplicateCount += res.data.duplicateCount || 0;
          failedCount += res.data.failedCount || 0;
        } catch (err) {
          failedCount++;
        }
      }

      return message.reply(
        `✅ Added ${addedCount} meme(s) successfully!\n` +
        `⚠️ Duplicate: ${duplicateCount}\n` +
        `❌ Failed: ${failedCount}`
      );

    } else if (args[0] === "list") {
      try {
        const res = await axios.get(`${baseUrl}/list`);
        const total = res.data.total || 0;
        return message.reply(`📊 Total memes: ${total}`);
      } catch (err) {
        return message.reply("❌ Couldn't fetch meme list.");
      }

    } else {
      try {
        const res = await axios.get(baseUrl);
        if (!res.data.meme || !res.data.meme.url) {
          return message.reply("❌ Invalid meme data received.");
        }

        return message.reply({
          body: " Here's a random meme for you!",
          attachment: await axios.get(res.data.meme.url, { responseType: "stream" }).then(r => r.data)
        });

      } catch (err) {
        return message.reply("❌ Couldn't load meme.");
      }
    }
  }
};
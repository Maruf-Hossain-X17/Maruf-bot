const axios = require("axios");
const fs = require("fs");
const path = require("path");

// 🌐 Base API
const baseApiUrl = async () => {
  const res = await axios.get(
    "https://raw.githubusercontent.com/Mostakim0978/D1PT0/refs/heads/main/baseApiUrl.json"
  );
  return res.data.api;
};

module.exports = {
  config: {
    name: "ytb",
    version: "2.3.0",
    author: "dipto (UX flow fixed by GPT-5)",
    countDown: 5,
    role: 0,
    shortDescription: { en: "YouTube downloader" },
    category: "media"
  },

  // ▶️ START
  onStart: async function ({ message, args, event }) {
    if (!args[0])
      return message.reply("❌ Use -v / -a / -i");

    const action = args[0].toLowerCase();
    const ytRegex =
      /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([\w-]{11})/;

    const isLink = args[1] && ytRegex.test(args[1]);

    // 🔗 DIRECT LINK MODE
    if (isLink) {
      const status = await message.reply("⏳ Download হচ্ছে, অপেক্ষা করো...");

      const videoID = args[1].match(ytRegex)[1];
      const format = ["-v", "video"].includes(action)
        ? "mp4"
        : ["-a", "audio"].includes(action)
        ? "mp3"
        : null;

      if (!format)
        return message.reply("❌ Invalid format.");

      try {
        const api = await baseApiUrl();
        const filePath = path.join(__dirname, `ytb_${videoID}.${format}`);

        const { data } = await axios.get(
          `${api}/ytDl3?link=${videoID}&format=${format}&quality=3`
        );

        const stream = await downloadFile(data.downloadLink, filePath);

        // 🔥 status delete BEFORE final send
        await message.unsend(status.messageID);

        await message.reply({
          body: `🎬 ${data.title}\n📀 Quality: ${data.quality}`,
          attachment: stream
        });

        setTimeout(() => {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 20000);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Download failed.");
      }
      return;
    }

    // 🔍 SEARCH MODE
    args.shift();
    const keyword = args.join(" ");
    if (!keyword)
      return message.reply("❌ Enter search keyword.");

    const searchingMsg = await message.reply("🔍 খোঁজা হচ্ছে...");

    try {
      const api = await baseApiUrl();
      const results = (
        await axios.get(
          `${api}/ytFullSearch?songName=${encodeURIComponent(keyword)}`
        )
      ).data.slice(0, 6);

      await message.unsend(searchingMsg.messageID);

      if (!results.length)
        return message.reply("❌ কোনো result পাওয়া যায়নি");

      let text = "";
      const thumbs = [];

      let i = 1;
      for (const v of results) {
        text += `${i}. ${v.title}\n⏱ ${v.time}\n📺 ${v.channel.name}\n\n`;
        thumbs.push(await streamImage(v.thumbnail));
        i++;
      }

      const sent = await message.reply({
        body: text + "👉 নাম্বার রিপ্লাই দাও",
        attachment: thumbs
      });

      global.GoatBot.onReply.set(sent.messageID, {
        commandName: "ytb",
        author: event.senderID,
        result: results,
        action
      });
    } catch (err) {
      console.error(err);
      return message.reply("❌ Search failed.");
    }
  },

  // 💬 REPLY HANDLER
  onReply: async function ({ message, Reply, event }) {
    if (event.senderID !== Reply.author) return;

    const choice = parseInt(event.body);
    if (isNaN(choice) || choice < 1 || choice > Reply.result.length)
      return message.reply("❌ ভুল নাম্বার");

    const video = Reply.result[choice - 1];
    const videoID = video.id;

    // ⏳ downloading msg
    const downloadingMsg = await message.reply("⏳ Download হচ্ছে...");

    if (["-v", "video", "-a", "audio"].includes(Reply.action)) {
      const format = ["-v", "video"].includes(Reply.action)
        ? "mp4"
        : "mp3";

      try {
        const api = await baseApiUrl();
        const filePath = path.join(__dirname, `ytb_${videoID}.${format}`);

        const { data } = await axios.get(
          `${api}/ytDl3?link=${videoID}&format=${format}&quality=3`
        );

        const stream = await downloadFile(data.downloadLink, filePath);

        // 🔥 delete "downloading" msg before sending file
        await message.unsend(downloadingMsg.messageID);

        await message.reply({
          body: `🎬 ${data.title}\n📀 Quality: ${data.quality}`,
          attachment: stream
        });

        setTimeout(() => {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 20000);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Download failed.");
      }
    }
  }
};

// 🧰 HELPERS
async function downloadFile(url, filePath) {
  const res = await axios.get(url, { responseType: "stream" });
  const writer = fs.createWriteStream(filePath);
  res.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return fs.createReadStream(filePath);
}

async function streamImage(url) {
  const res = await axios.get(url, { responseType: "stream" });
  return res.data;
}

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

module.exports = {
  config: {
    name: "audio",
    aliases: ["getaudio", "extractaudio"],
    version: "1.0",
    author: "Nyx",
    countDown: 5,
    role: 0,
    shortDescription: "ভিডিও থেকে অডিও বের করবে",
    longDescription: "কোনো ভিডিওতে রিপ্লাই দিয়ে -audio লিখলে ওই ভিডিওর সাউন্ড আলাদা mp3 ফাইল হিসেবে পাঠাবে",
    category: "media",
    guide: {
      en: "{pn} (ভিডিওতে রিপ্লাই দিয়ে ব্যবহার করো)"
    }
  },

  onStart: async function ({ api, event, message }) {
    try {
      if (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0) {
        return message.reply("❌ কোনো ভিডিওতে রিপ্লাই দাও।");
      }

      const attachment = event.messageReply.attachments[0];
      if (attachment.type !== "video") {
        return message.reply("❌ শুধু ভিডিওতেই কাজ করবে।");
      }

      const inputPath = path.join(__dirname, "input.mp4");
      const outputPath = path.join(__dirname, "output.mp3");

      // ডাউনলোড ভিডিও
      const res = await global.utils.getStreamFromURL(attachment.url);
      const ws = fs.createWriteStream(inputPath);
      res.pipe(ws);
      ws.on("finish", () => {
        // FFmpeg দিয়ে কনভার্ট
        exec(`ffmpeg -i "${inputPath}" -q:a 0 -map a "${outputPath}" -y`, async (err) => {
          if (err) {
            console.error(err);
            return message.reply("⚠️ কনভার্ট করতে সমস্যা হয়েছে।");
          }

          // অডিও পাঠাও
          await message.reply({
            body: "🎶 এই নাও ভিডিওর অডিও:",
            attachment: fs.createReadStream(outputPath)
          });

          // ফাইল মুছে ফেলো
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);
        });
      });
    } catch (e) {
      console.error(e);
      message.reply("⚠️ কিছু সমস্যা হয়েছে। আবার চেষ্টা করো।");
    }
  }
};
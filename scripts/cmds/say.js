const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const googleTTS = require("google-tts-api");

module.exports = {
  config: {
    name: "say",
    version: "3.0",
    author: "ChatGPT + Maruf",
    role: 0,
    shortDescription: "টেক্সটকে ভয়েসে রূপান্তর করে (Full text supported)",
    category: "media",
    guide: "{pn} [টেক্সট বা রিপ্লাই করা মেসেজ]\n\nউদাহরণ:\n/voice আমি বাংলায় কথা বলি\n(বা কোনো বড় টেক্সটে রিপ্লাই করে দাও)"
  },

  onStart: async function ({ api, event, args }) {
    try {
      // টেক্সট নিচ্ছে মেসেজ বা রিপ্লাই থেকে
      const text =
        event.type === "message_reply"
          ? event.messageReply?.body
          : args.join(" ");

      if (!text) {
        return api.sendMessage(
          "📢 দয়া করে কিছু টেক্সট লিখুন বা কোনো মেসেজে রিপ্লাই করুন।",
          event.threadID,
          event.messageID
        );
      }

      const lang = "bn"; // চাইলে 'en', 'ar' ইত্যাদিও করা যাবে
      const filePath = path.join(__dirname, `tts_full_${Date.now()}.mp3`);

      // 🔹 বড় টেক্সটকে ছোট ছোট অংশে ভাগ করা (Google TTS প্রতি 200 ক্যারেক্টার সাপোর্ট করে)
      const splitText = (text) => {
        const chunks = [];
        let chunk = "";
        for (const word of text.split(" ")) {
          if ((chunk + " " + word).length > 190) {
            chunks.push(chunk.trim());
            chunk = "";
          }
          chunk += " " + word;
        }
        if (chunk.trim().length > 0) chunks.push(chunk.trim());
        return chunks;
      };

      const parts = splitText(text);
      const buffers = [];

      for (const part of parts) {
        const url = googleTTS.getAudioUrl(part, {
          lang,
          slow: false,
          host: "https://translate.google.com",
        });

        const response = await axios.get(url, {
          responseType: "arraybuffer",
        });
        buffers.push(Buffer.from(response.data));
      }

      // 🔹 সব অংশ জোড়া লাগানো
      const finalAudio = Buffer.concat(buffers);
      await fs.writeFile(filePath, finalAudio);

      await api.sendMessage(
        {
          body: `🎧 ভয়েস তৈরি সম্পন্ন ✅\nটেক্সট দৈর্ঘ্য: ${text.length} অক্ষর`,
          attachment: fs.createReadStream(filePath),
        },
        event.threadID,
        event.messageID
      );

      // 🔹 ফাইল ডিলিট
      setTimeout(() => fs.unlink(filePath).catch(() => {}), 10000);
    } catch (err) {
      console.error("TTS Error:", err);
      return api.sendMessage(
        "❌ কোনো সমস্যা হয়েছে, পরে আবার চেষ্টা করুন।",
        event.threadID,
        event.messageID
      );
    }
  },
};
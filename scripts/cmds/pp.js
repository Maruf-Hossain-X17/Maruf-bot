const axios = require("axios");

module.exports = {
  config: {
    name: "pp",
    aliases: ["pfp", "profile"],
    version: "5.0",
    author: "Gemini",
    countDown: 5,
    role: 0,
    description: "টোকেন ছাড়াই প্রোফাইল পিকচার",
    category: "image"
  },

  onStart: async function ({ event, message, args }) {
    try {
      let uid;

      if (event.type === "message_reply") {
        uid = event.messageReply.senderID;
      } else if (Object.keys(event.mentions).length) {
        uid = Object.keys(event.mentions)[0];
      } else if (args[0] && !isNaN(args[0])) {
        uid = args[0];
      } else {
        uid = event.senderID;
      }

      // টোকেন ছাড়া কাজ করার জন্য থার্ড পার্টি এপিআই ব্যবহার করা হয়েছে
      const imgUrl = `https://graph.facebook.com/${uid}/picture?width=1024&height=1024&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

      const res = await axios.get(imgUrl, { responseType: "stream" });

      return message.reply({
        attachment: res.data
      });

    } catch (e) {
      // যদি উপরের লিঙ্কে সমস্যা হয় তবে এই লিঙ্কটি ট্রাই করবে
      try {
        const altUrl = `https://www.facebook.com/api/graphql/`; // Alternate logic
        message.reply("⚠️ সরাসরি ছবি পাওয়া যাচ্ছে না, আইডিটি সম্ভবত লক করা বা প্রাইভেট।");
      } catch (err) {
        message.reply("❌ কোনো সমস্যা হয়েছে, আবার চেষ্টা করুন।");
      }
    }
  }
};
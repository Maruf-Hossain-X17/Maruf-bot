const axios = require('axios');

module.exports = {
  config: {
    name: "imglink",
    version: "1.1.0",
    author: "Maruf",
    countDown: 5,
    role: 0,
    category: "utility",
    shortDescription: "ইমেজ থেকে ছোট লিংক তৈরি করুন",
    guide: "{pn} [ইমেজে রিপ্লাই দিন]"
  },

  onStart: async function ({ api, event, message }) {
    if (event.type !== "message_reply" || !event.messageReply.attachments[0]) {
      return message.reply("⚠️ দয়া করে একটি ইমেজে রিপ্লাই দিন!");
    }

    const tempUrl = event.messageReply.attachments[0].url;

    try {
      message.reply("⏳ লিংক ছোট করা হচ্ছে, অপেক্ষা করুন...");

      // TinyURL API ব্যবহার করে লিংক ছোট করা
      const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(tempUrl)}`);
      const shortUrl = response.data;

      return message.reply(`✅ আপনার ছোট লিংক:\n${shortUrl}`);
      
    } catch (error) {
      console.error(error);
      return message.reply("❌ লিংকটি ছোট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  }
};
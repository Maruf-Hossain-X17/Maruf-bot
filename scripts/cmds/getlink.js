const axios = require("axios");

module.exports = {
  config: {
    name: "getlink",
    version: "1.2",
    author: "Maruf",
    role: 0,
    shortDescription: "Get short download link of voice or song message",
    category: "Utilities",
    guide: "{pn} (Reply to a voice or song message)"
  },

  onStart: async function ({ event, api }) {
    if (!event.messageReply || !event.messageReply.attachments) {
      return api.sendMessage("❌ Please reply to a voice or song message.", event.threadID, event.messageID);
    }

    const audioAttachment = event.messageReply.attachments.find(att => att.type === "audio");

    if (!audioAttachment || !audioAttachment.url) {
      return api.sendMessage("⚠️ No valid audio found.", event.threadID, event.messageID);
    }

    try {
      // TinyURL API ব্যবহার করে লিঙ্ক শর্ট করা
      const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(audioAttachment.url)}`);
      const shortUrl = res.data;

      const replyMsg = `✅ Your Short Link: ${shortUrl}\n\n📌 Note: Rename to .mp3 if needed.`;
      return api.sendMessage(replyMsg, event.threadID, event.messageID);
      
    } catch (error) {
      // যদি API ফেইল করে তবে অরিজিনাল লিঙ্কটাই পাঠিয়ে দিবে
      return api.sendMessage(`✅ Download Link: ${audioAttachment.url}`, event.threadID, event.messageID);
    }
  }
};
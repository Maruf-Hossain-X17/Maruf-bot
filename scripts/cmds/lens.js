const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "lens",
    version: "1.2.0",
    author: "Gemini",
    countDown: 5,
    role: 0,
    shortDescription: "Google Lens search with direct images",
    longDescription: "Reply to an image with 'lens' to see similar images directly as an album.",
    category: "utility",
    guide: {
      en: "{p}lens (reply to an image)"
    }
  },

  onStart: async function ({ api, event }) {
    const { messageReply, threadID, messageID } = event;
    const apiKey = "5dMsshimQwGTNCMg9SSisbxM"; // Tomar deya API Key

    if (event.type !== "message_reply" || !messageReply.attachments || messageReply.attachments.length === 0) {
      return api.sendMessage("❌ দয়া করে একটি ছবির রিপ্লাইয়ে 'lens' লিখুন।", threadID, messageID);
    }

    const imageUrl = messageReply.attachments[0].url;
    api.sendMessage("🔍 Google Lens-এ খোঁজা হচ্ছে এবং ছবিগুলো লোড করা হচ্ছে...", threadID, messageID);

    try {
      const response = await axios.get(`https://www.searchapi.io/api/v1/search`, {
        params: {
          engine: "google_lens",
          url: imageUrl,
          api_key: apiKey
        }
      });

      const results = response.data.visual_matches;
      if (!results || results.length === 0) {
        return api.sendMessage("😔 দুঃখিত, এই ছবির মতো অন্য কোনো ছবি পাওয়া যায়নি।", threadID, messageID);
      }

      const attachments = [];
      const cachePath = path.join(__dirname, 'cache');
      if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath);

      // প্রথম ৪-৫টি সেরা রেজাল্ট ডাউনলোড করে অ্যালবাম বানাবে
      const limit = Math.min(5, results.length);
      
      for (let i = 0; i < limit; i++) {
        const imgUrl = results[i].thumbnail;
        const imgPath = path.join(cachePath, `lens_match_${Date.now()}_${i}.jpg`);
        
        try {
          const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
          fs.writeFileSync(imgPath, Buffer.from(imgRes.data, 'binary'));
          attachments.push(fs.createReadStream(imgPath));
        } catch (e) {
          console.error(`Error downloading image ${i}:`, e.message);
        }
      }

      if (attachments.length === 0) {
        return api.sendMessage("ছবিগুলো লোড করা সম্ভব হয়নি।", threadID, messageID);
      }

      api.sendMessage({
        body: `✅ Google Lens রেজাল্ট:\nএই ছবির সাথে মিল থাকা ${attachments.length}টি ছবি পাওয়া গেছে।`,
        attachment: attachments
      }, threadID, (err) => {
        if (err) console.error(err);
        // পাঠানোর পর ফাইলগুলো ডিলিট করে দেয় (Storage বাঁচানোর জন্য)
        attachments.forEach(stream => {
          if (fs.existsSync(stream.path)) fs.unlinkSync(stream.path);
        });
      }, messageID);

    } catch (error) {
      console.error(error);
      api.sendMessage("⚠️ সার্ভারে সমস্যা হয়েছে অথবা API ক্রেডিট শেষ।", threadID, messageID);
    }
  }
};
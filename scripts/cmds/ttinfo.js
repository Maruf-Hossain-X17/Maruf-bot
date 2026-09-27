const axios = require("axios");

module.exports = {
  config: {
    name: "ttinfo",
    version: "2.0.0",
    author: "Maruf",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Get detailed TikTok profile stats & info"
    },
    longDescription: {
      en: "Fetch comprehensive TikTok profile details including account status, creation date, stats, and avatar."
    },
    category: "info",
    guide: {
      en: "{p}ttinfo <username>"
    }
  },

  onStart: async function ({ api, event, args, message, prefix }) {
    const username = args.join(" ").trim().replace(/^@/, "");

    if (!username) {
      return message.reply(`❌ Please provide a TikTok username!\n\n💡 Example: ${prefix}ttinfo srotoshini143`);
    }

    const waitMsg = await message.reply("🔎 Searching TikTok database, please wait...");

    try {
      // 1. Fetch Dynamic Base API URL
      let baseUrl = "https://api.maruf-api.abrdns.com/ttinfo";
      try {
        const configRes = await axios.get("https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json");
        if (configRes?.data?.apis?.ttinfo?.url) {
          baseUrl = configRes.data.apis.ttinfo.url;
        }
      } catch (configErr) {
        console.error("Failed to fetch base URL from GitHub, using fallback.");
      }

      const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
      const targetUrl = `${cleanBaseUrl}/api/ttinfo?username=${encodeURIComponent(username)}`;

      // 2. Request Backend API
      const response = await axios.get(targetUrl);
      const resData = response.data;

      if (!resData || !resData.status || !resData.data) {
        if (waitMsg && waitMsg.messageID) message.unsend(waitMsg.messageID);
        return message.reply(`❌ ${resData?.message || "User not found or account is unavailable!"}`);
      }

      // Extract all enhanced data fields
      const {
        id,
        secUid,
        username: uName,
        nickname,
        avatar,
        bio,
        bioLink,
        region,
        createdAt,
        isVerified,
        isPrivate,
        isBusiness,
        openFavorite,
        profileUrl,
        stats
      } = resData.data;

      const fmt = (num) => (num !== undefined && num !== null) ? Number(num).toLocaleString() : "0";

      // Premium formatted message structure
      const infoText = 
`╭━━━ 📊 TIKTOK PROFILE INFO ━━━╮

👤 BASIC INFORMATION
▸ Name: ${nickname || "N/A"}
▸ Username: @${uName || username}
▸ User ID: ${id || "N/A"}
▸ Country/Region: ${region || "N/A"}
▸ Created On: ${createdAt || "N/A"}

🛡️ ACCOUNT STATUS
▸ Verified: ${isVerified ? "Yes ✅" : "No ❌"}
▸ Privacy: ${isPrivate ? "Private Account 🔒" : "Public Account 🌐"}
▸ Account Type: ${isBusiness ? "Business Account 💼" : "Personal Account 👤"}
▸ Public Favorites: ${openFavorite ? "Visible 🔓" : "Hidden 🔒"}

📈 PROFILE STATISTICS
▸ Followers: 👥 ${fmt(stats?.followers)}
▸ Following: ➕ ${fmt(stats?.following)}
▸ Friends: 🤝 ${fmt(stats?.friends)}
▸ Total Hearts: ❤️ ${fmt(stats?.totalLikes)}
▸ Total Videos: 🎬 ${fmt(stats?.totalVideos)}
▸ Videos Liked: 💖 ${fmt(stats?.diggCount)}

📝 BIO & WEBSITE
▸ Bio: ${bio || "No bio available."}
${bioLink ? `▸ Website: 🔗 ${bioLink}\n` : ""}
🔗 Profile Link:
${profileUrl}

╰━━━━━━━━━━━━━━━━━━━━━━━╯`;

      // Download Avatar Stream
      let attachment = null;
      if (avatar) {
        try {
          attachment = (await axios.get(avatar, { responseType: "stream" })).data;
        } catch (imgErr) {
          console.error("Failed to download avatar image stream.");
        }
      }

      if (waitMsg && waitMsg.messageID) message.unsend(waitMsg.messageID);

      const payload = { body: infoText };
      if (attachment) payload.attachment = attachment;

      return message.reply(payload);

    } catch (error) {
      if (waitMsg && waitMsg.messageID) message.unsend(waitMsg.messageID);

      const errorMsg = error.response?.data?.message || error.response?.data?.error || "Failed to fetch TikTok user details!";
      return message.reply(`❌ ${errorMsg}`);
    }
  }
};
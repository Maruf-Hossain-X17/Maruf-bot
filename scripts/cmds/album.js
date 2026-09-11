const axios = require("axios");

module.exports = {
  config: {
    name: "album",
    version: "1.0",
    role: 0,
    author: "Maruf",
    category: "media",
    guide: { en: "Usage:\n- album add [category] [url or reply video]\n- album list\n- album remove [category] [url]\n- album delete [category]\n- album search [category] [keyword]\n- album export\n- album exists [category]" }
  },

  onStart: async function ({ api, event, args }) {
    const base = "https://album-x69.onrender.com/api/album";

    // Helper: Capitalize first letter
    const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

    // Admin UID check helper
    const isAdmin = (uid) => uid === "100066542686904";

    // Get user UID from query or event senderID if available
    const userUid = event.senderID || "";

    // Send error for admin commands if not admin
    const checkAdmin = () => {
      if (!isAdmin(userUid)) {
        api.sendMessage("❌ Only admin can use this command", event.threadID, event.messageID);
        return false;
      }
      return true;
    };

    // ========== Commands ==========

    // album add [category] [url] or reply video
    if (args[0] === "add") {
      const category = args[1];
      let videoUrl = args[2] || event.messageReply?.attachments?.[0]?.url;

      if (!category || !videoUrl) {
        return api.sendMessage("❌ Provide category and video URL or reply with a video", event.threadID, event.messageID);
      }

      try {
        const res = await axios.get(`${base}/add/${category}?url=${encodeURIComponent(videoUrl)}`);
        if (res.data.error) return api.sendMessage(res.data.error, event.threadID, event.messageID);
        return api.sendMessage(`✅ Video added to category: ${capitalize(category)}`, event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Failed to add video", event.threadID, event.messageID);
      }
    }
     //end
       else if (args[0] === "listvdo") {
      const category = args[1];
      if (!category) return api.sendMessage("❌ Provide category to list videos", event.threadID, event.messageID);

      try {
        const res = await axios.get(`${base}/${encodeURIComponent(category)}/list`);
        if (res.data.error) return api.sendMessage(res.data.error, event.threadID, event.messageID);

        if (!res.data.videos || res.data.videos.length === 0) {
          return api.sendMessage(`❌ No videos found in category: ${capitalize(category)}`, event.threadID, event.messageID);
        }

        let msg = ` 👀Videos in category '${capitalize(category)}':\n\n`;
        res.data.videos.forEach((v, i) => {
          msg += `${i + 1}. ${v}\n`;
        });
        return api.sendMessage(msg.trim(), event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Failed to fetch videos", event.threadID, event.messageID);
      }
    }

    // album list
    else if (!args[0] || args[0] === "list") {
      try {
        const res = await axios.get(`${base}/list`);
        const data = res.data?.data || {};
        if (Object.keys(data).length === 0) return api.sendMessage("❌ No categories found", event.threadID, event.messageID);

        let msg = "🖤 x69's Album Categories 🖤\n\n";
        let idx = 1;
        for (const [cat, count] of Object.entries(data)) {
          msg += `${idx}. ${capitalize(cat)}\n   🐥 Videos: ${count}\n\n`;
          idx++;
        }
        return api.sendMessage(msg.trim(), event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Error fetching list", event.threadID, event.messageID);
      }
    }

    // album remove [category] [url] (admin only)
    else if (args[0] === "remove") {
      if (!checkAdmin()) return;

      const category = args[1];
      const url = args[2];
      if (!category || !url) return api.sendMessage("❌ Provide category to remove", event.threadID, event.messageID);

      try {
        const res = await axios.get(`${base}/remove/${category}?url=${encodeURIComponent(url)}&uid=61558455297317`);
        if (res.data.error) return api.sendMessage(res.data.error, event.threadID, event.messageID);
        return api.sendMessage(`✅ Removed video from ${capitalize(category)}`, event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Failed to remove video", event.threadID, event.messageID);
      }
    }

    // album delete [category] (admin only)
    else if (args[0] === "delete") {
  if (!checkAdmin()) return;

  const category = args[1];
  if (!category) return api.sendMessage("❌ Provide category name to delete", event.threadID, event.messageID);

  try {
    const res = await axios.get(`${base}/dlt/${encodeURIComponent(category)}?uid=61558455297317`);
    if (res.data.error) return api.sendMessage(res.data.error, event.threadID, event.messageID);
    return api.sendMessage(`🗑️ Deleted category ${capitalize(category)}`, event.threadID, event.messageID);
  } catch {
    return api.sendMessage("❌ Failed to delete category", event.threadID, event.messageID);
  }
}

    // album search [category] [keyword]
    else if (args[0] === "search") {
      const category = args[1];
      const keyword = args[2];
      if (!category || !keyword) return api.sendMessage("❌ Provide category and keyword to search", event.threadID, event.messageID);

      try {
        const res = await axios.get(`${base}/search?category=${encodeURIComponent(category)}&keyword=${encodeURIComponent(keyword)}`);
        if (res.data.error) return api.sendMessage(res.data.error, event.threadID, event.messageID);

        if (res.data.found === 0) {
          return api.sendMessage(`🔍 No results found for '${keyword}' in '${category}'`, event.threadID, event.messageID);
        }

        let msg = `🔍 Search results for '${keyword}' in '${category}':\n\n`;
        res.data.results.forEach((v, i) => {
          msg += `${i + 1}. ${v}\n`;
        });
        return api.sendMessage(msg.trim(), event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Error searching videos", event.threadID, event.messageID);
      }
    }

    // album export (admin only)
    else if (args[0] === "export") {
      if (!checkAdmin()) return;

      try {
        const res = await axios.get(`${base}/export?uid=61558455297317`);
        if (res.data.error) return api.sendMessage(res.data.error, event.threadID, event.messageID);

        const total = res.data.total || 0;
        return api.sendMessage(`📦 Exported ${total} categories`, event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Failed to export data", event.threadID, event.messageID);
      }
    }

    // album exists [category] (admin only)
    else if (args[0] === "exists") {
      if (!checkAdmin()) return;

      const category = args[1];
      if (!category) return api.sendMessage("❌ Provide category to check", event.threadID, event.messageID);

      try {
        const res = await axios.get(`${base}/exists/${encodeURIComponent(category)}?uid=61558455297317`);
        return api.sendMessage(`✅ Category '${category}' exists: ${res.data.exists}`, event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Failed to check category", event.threadID, event.messageID);
      }
    }

    // Default: get random video from category
    else {
      const category = args[0];
      if (!category) return api.sendMessage("❌ Provide a category name or command", event.threadID, event.messageID);

      try {
        const res = await axios.get(`${base}/${encodeURIComponent(category)}`);
        if (!res?.data?.video) return api.sendMessage("❌ No video found in this category", event.threadID, event.messageID);

        const msg = `𝘏𝘦𝘳𝘦'𝘴 your ${capitalize(category)} video bby 😘`;
        const videoStream = await global.utils.getStreamFromURL(res.data.video);
        return api.sendMessage({ body: msg, attachment: videoStream }, event.threadID, event.messageID);
      } catch {
        return api.sendMessage("❌ Error fetching video", event.threadID, event.messageID);
      }
    }
  }
};
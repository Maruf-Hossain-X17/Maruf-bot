module.exports = {
  config: {
    name: "out",
    version: "1.0",
    author: "Maruf",
    role: 2, // Admin only
    shortDescription: "Leave current group",
    longDescription: "Bot will leave the group when this command is called",
    category: "admin",
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function({ api, event }) {
    const threadID = event.threadID;

    try {
      await api.sendMessage("😢 Bot is leaving the group. Bye!", threadID);
      await api.removeUserFromGroup(api.getCurrentUserID(), threadID);
    } catch (err) {
      console.error("Error leaving group:", err);
      await api.sendMessage("❌ Failed to leave the group.", threadID);
    }
  }
};
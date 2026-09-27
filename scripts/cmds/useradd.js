module.exports = {
  config: {
    name: "useradd",
    version: "1.0",
    author: "Maruf",
    role: 2, // Admins only
    shortDescription: "Add user to group by UID",
    longDescription: "Add a user back to the group using their Facebook UID",
    category: "admin",
    guide: {
      en: "{pn} <uid> - add user to group"
    }
  },

  onStart: async function({ api, event, args }) {
    const threadID = event.threadID;
    const senderID = event.senderID;

    // Check if UID was provided
    if (args.length === 0) {
      return api.sendMessage("⚠️ Please provide a UID to add.\nExample: useradd 1000123456789", threadID);
    }

    const uidToAdd = args[0];

    try {
      await api.addUserToGroup(uidToAdd, threadID);
      await api.sendMessage(`✅ Successfully added user ${uidToAdd} to the group.`, threadID);
    } catch (err) {
      console.error("Failed to add user:", err);
      await api.sendMessage(`❌ Failed to add user ${uidToAdd}.\nPossible reasons:\n- Bot is not friends with the user\n- UID is incorrect\n- User has blocked the bot`, threadID);
    }
  }
};
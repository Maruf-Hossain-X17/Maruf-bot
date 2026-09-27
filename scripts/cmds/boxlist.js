module.exports = {
  config: {
    name: "boxlist",
    aliases: ["gl"],
    version: "1.1",
    author: "Maruf",
    countDown: 5,
    role: 2,
    shortDescription: "বটের সব গ্রুপ লিস্ট দেখাবে",
    longDescription: "বট বর্তমানে যেসব গ্রুপে আছে তাদের নাম ও আইডি লিস্ট আকারে দেখাবে, এবং রিপ্লাই করলে সেই গ্রুপের UID দিবে",
    category: "system",
    guide: {
      en: "{pn} grouplist"
    }
  },

  onStart: async function ({ api, event }) {
    try {
      const threads = await api.getThreadList(100, null, ["INBOX"]);
      let msg = "📋 বট যেসব গ্রুপে আছে:\n\n";
      let groups = [];
      let count = 0;

      for (const thread of threads) {
        if (thread.isGroup) {
          count++;
          groups.push({ name: thread.name || "No Name", id: thread.threadID });
          msg += `${count}. ${thread.name || "No Name"}\n🆔 ID: ${thread.threadID}\n\n`;
        }
      }

      msg += `✅ মোট গ্রুপ: ${count}`;

      return api.sendMessage(msg, event.threadID, (err, info) => {
        global.client.handleReply.push({
          type: "boxlist",
          name: this.config.name,
          messageID: info.messageID,
          author: event.senderID,
          groups
        });
      });
    } catch (e) {
      console.error(e);
      return api.sendMessage("❌ গ্রুপ লিস্ট আনার সময় সমস্যা হয়েছে!", event.threadID);
    }
  },

  onReply: async function ({ api, event, handleReply }) {
    try {
      if (handleReply.type !== "boxlist") return;

      const choice = parseInt(event.body.trim());
      if (isNaN(choice) || choice < 1 || choice > handleReply.groups.length) {
        return api.sendMessage("⚠️ সঠিক নাম্বার দিন!", event.threadID, event.messageID);
      }

      const selected = handleReply.groups[choice - 1];
      return api.sendMessage(
        `📌 গ্রুপ নাম: ${selected.name}\n🆔 UID: ${selected.id}`,
        event.threadID,
        event.messageID
      );
    } catch (e) {
      console.error(e);
      return api.sendMessage("❌ কোনো সমস্যা হয়েছে!", event.threadID);
    }
  }
};
const fs = require("fs-extra");
const path = __dirname + "/../../database/data/antiout.json";

module.exports = {
  config: {
    name: "antiout",
    aliases: [],
    version: "1.0",
    author: "Maruf",
    countDown: 0,
    role: 1,
    shortDescription: "Enable/disable antiout",
    longDescription: "Automatically add member back if they leave the group",
    category: "group",
    guide: "{pn} on/off"
  },

  onStart: async function ({ message, event, args }) {
    const data = fs.existsSync(path) ? require(path) : [];
    const threadID = event.threadID;

    if (args[0] === "on") {
      if (data.includes(threadID)) return message.reply("✅ Antiout আগে থেকেই চালু আছে।");
      data.push(threadID);
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
      return message.reply("✅ Antiout চালু করা হয়েছে। এখন কেউ লিভ দিলে তাকে আবার add করা হবে।");
    }

    if (args[0] === "off") {
      if (!data.includes(threadID)) return message.reply("⚠️ Antiout চালুই ছিল না।");
      const index = data.indexOf(threadID);
      data.splice(index, 1);
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
      return message.reply("🚫 Antiout বন্ধ করা হয়েছে। এখন কেউ লিভ দিলে তাকে আর add করা হবে না।");
    }

    return message.reply("❌ ব্যবহার:\n-antiout on\n-antiout off");
  }
};
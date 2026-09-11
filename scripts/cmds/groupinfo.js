const fs = require("fs");
const axios = require("axios");

module.exports = {
  config: {
    name: "groupinfo",
    version: "1.0.0",
    author: "Maruf Hossain",
    countDown: 5,
    role: 1,
    shortDescription: "Show group information",
    longDescription: "Displays detailed information about the current group, such as member count, gender, emoji, etc.",
    category: "box",
    guide: {
      en: "{pn}",
      vi: "{pn}"
    }
  },

  onStart: async function ({ message, event, api }) {
    const threadInfo = await api.getThreadInfo(event.threadID);

    const threadName = threadInfo.threadName || "No name";
    const id = event.threadID;
    const emoji = threadInfo.emoji || "❓";
    const approvalMode = threadInfo.approvalMode ? "🟢 Enabled" : "🔴 Disabled";
    const messageCount = threadInfo.messageCount || "Unknown";
    const adminCount = threadInfo.adminIDs.length;
    const memberCount = threadInfo.participantIDs.length;

    let male = 0, female = 0;
    threadInfo.userInfo.forEach(user => {
      if (user.gender === "MALE") male++;
      else if (user.gender === "FEMALE") female++;
    });

    const imageSrc = threadInfo.imageSrc;
    const msg = 
`📘 GROUP INFORMATION 📘
👥 Group Name: ${threadName}
🆔 Group ID: ${id}
🧩 Emoji: ${emoji}
🔐 Approval Mode: ${approvalMode}
👤 Total Members: ${memberCount}
🙎‍♂️ Males: ${male} | 🙎‍♀️ Females: ${female}
🔧 Admins: ${adminCount}
📨 Total Messages: ${messageCount}

📌 Made with ❤️ by: Maruf Hossain`;

    // If group image is available, download and attach
    if (imageSrc) {
      const imgPath = __dirname + "/cache/groupinfo.png";
      const writer = fs.createWriteStream(imgPath);

      const response = await axios({
        url: imageSrc,
        method: "GET",
        responseType: "stream"
      });

      response.data.pipe(writer);

      writer.on("finish", () => {
        message.reply({
          body: msg,
          attachment: fs.createReadStream(imgPath)
        }, () => fs.unlinkSync(imgPath));
      });

      writer.on("error", err => {
        console.error("Image download failed:", err);
        message.reply(msg);
      });

    } else {
      message.reply(msg);
    }
  }
};
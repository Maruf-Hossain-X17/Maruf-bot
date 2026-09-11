const axios = require("axios");
const fs = require("fs");
const path = require("path");

const baseApiUrl = async () => {
  const base = await axios.get(
    "https://raw.githubusercontent.com/mahmudx7/exe/main/baseApiUrl.json"
  );
  return base.data.mahmud;
};

module.exports.config = {
  name: "pair4",
  version: "1.0.0",
  role: 0,
  author: "Maruf",
  description: "Random Pair Match Style 4",
  category: "LOVE",
  guide: "",
  countDown: 10
};

module.exports.onStart = async function ({ api, event, message }) {
  const cacheDir = path.join(__dirname, "cache");

  try {
    api.setMessageReaction("😘", event.messageID, () => {}, true);

    if (!fs.existsSync(cacheDir))
      fs.mkdirSync(cacheDir, { recursive: true });

    const threadInfo = await api.getThreadInfo(event.threadID);
    const users = threadInfo.userInfo;

    const myData = users.find(
      user => user.id == event.senderID
    );

    if (!myData || !myData.gender) {
      return message.reply("Your gender is not set.");
    }

    let targetID = null;

    // Check if replying to a message
    if (event.messageReply && event.messageReply.senderID) {
      targetID = event.messageReply.senderID;
    } 
    // Check if someone is mentioned
    else if (Object.keys(event.mentions || {}).length > 0) {
      targetID = Object.keys(event.mentions)[0];
    }

    let match;

    if (targetID) {
      if (targetID == event.senderID) {
        api.setMessageReaction("🤔", event.messageID, () => {}, true);
        return message.reply("You can't pair with yourself.");
      }
      match = users.find((u) => u.id == targetID) || { id: targetID, name: "Partner", gender: "UNKNOWN" };
    } else {
      let candidates = [];

      if (myData.gender.toUpperCase() === "MALE") {
        candidates = users.filter(
          user =>
            user.gender === "FEMALE" &&
            user.id != event.senderID
        );
      } else if (myData.gender.toUpperCase() === "FEMALE") {
        candidates = users.filter(
          user =>
            user.gender === "MALE" &&
            user.id != event.senderID
        );
      } else {
        candidates = users.filter(
          user => user.id != event.senderID
        );
      }

      if (!candidates.length) {
        api.setMessageReaction("🥺", event.messageID, () => {}, true);
        return message.reply("No match found.");
      }

      match = candidates[Math.floor(Math.random() * candidates.length)];
    }

    const baseUrl = await baseApiUrl();

    const response = await axios.get(
      `${baseUrl}/api/pair/mahmud?user1=${event.senderID}&user2=${match.id}&style=4`,
      {
        responseType: "arraybuffer"
      }
    );

    const filePath = path.join(
      cacheDir,
      `pair4_${Date.now()}.png`
    );

    fs.writeFileSync(filePath, Buffer.from(response.data));

    // Custom Percentage Logic
    let love;
    const uidA = "100066542686904";
    const uidB = "61570727252463";

    if ((String(event.senderID) === uidA && String(match.id) === uidB) || 
        (String(event.senderID) === uidB && String(match.id) === uidA)) {
        love = Math.floor(Math.random() * 11) + 90; // 90% to 100%
    } else {
        love = Math.floor(Math.random() * 100) + 1; // 1% to 100% for everyone else
    }

    api.setMessageReaction("✅", event.messageID, () => {}, true);

    return message.reply(
      {
        body: `💞 Successful Pairing\n\n• ${myData.name || "User"}\n• ${match.name || "Partner"}\n\nLove Percentage: ${love}%`,
        attachment: fs.createReadStream(filePath)
      },
      () => {
        if (fs.existsSync(filePath))
          fs.unlinkSync(filePath);
      }
    );

  } catch (error) {
    console.log(error);

    api.setMessageReaction("❌", event.messageID, () => {}, true);

    return message.reply(
      `❌ Error: ${error.message}`
    );
  }
};
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "pair5",
    aliases: [],
    version: "1.1",
    author: "OTINXSANDIP + ChatGPT",
    countDown: 5,
    role: 0,
    shortDescription: "Pair two people",
    longDescription: "Randomly pairs two users or based on mention or reply",
    category: "LOVE",
    guide: "{pn} | {pn} @user1 @user2 | {pn} (reply to someone)"
  },

  onStart: async function ({ api, event, usersData }) {
    const { threadID, messageID, senderID, mentions, type } = event;

    try {
      let id1, id2;

      const getName = async (uid) => {
        const user = await usersData.get(uid);
        return user?.name || "Unknown User";
      };

      // Mention mode
      if (Object.keys(mentions).length === 2) {
        const ids = Object.keys(mentions);
        id1 = ids[0];
        id2 = ids[1];
      }

      // Reply mode
      else if (type === "message_reply") {
        id1 = senderID;
        id2 = event.messageReply.senderID;

        if (id1 === id2) {
          return api.sendMessage(
            "❌ You can't pair yourself!",
            threadID,
            messageID
          );
        }
      }

      // Random mode
      else {
        const { participantIDs } = await api.getThreadInfo(threadID);
        const botID = api.getCurrentUserID();

        const users = participantIDs.filter(
          id => id !== botID && id !== senderID
        );

        if (!users.length) {
          return api.sendMessage(
            "❌ No other user available in this group.",
            threadID,
            messageID
          );
        }

        id1 = senderID;
        id2 = users[Math.floor(Math.random() * users.length)];
      }

      const name1 = await getName(id1);
      const name2 = await getName(id2);

      const lovePercent = Math.floor(Math.random() * 101);

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      const avatar1Path = path.join(cacheDir, `pair_${id1}.jpg`);
      const avatar2Path = path.join(cacheDir, `pair_${id2}.jpg`);
      const gifPath = path.join(cacheDir, "love.gif");

      // Avatar 1
      const avatar1 = await axios.get(
        `https://graph.facebook.com/${id1}/picture?width=512&height=512`,
        { responseType: "arraybuffer" }
      );

      // Avatar 2
      const avatar2 = await axios.get(
        `https://graph.facebook.com/${id2}/picture?width=512&height=512`,
        { responseType: "arraybuffer" }
      );

      // Love GIF
      const gif = await axios.get(
        "https://media.tenor.com/6kN-6X7G6iQAAAAi/love-heart.gif",
        { responseType: "arraybuffer" }
      );

      await fs.writeFile(avatar1Path, avatar1.data);
      await fs.writeFile(avatar2Path, avatar2.data);
      await fs.writeFile(gifPath, gif.data);

      const msg = {
        body: `🥰 Pairing Successful!

❤️ Love Match: ${lovePercent}%

${name1} ❤️ ${name2}`,
        mentions: [
          {
            id: id1,
            tag: name1
          },
          {
            id: id2,
            tag: name2
          }
        ],
        attachment: [
          fs.createReadStream(avatar1Path),
          fs.createReadStream(gifPath),
          fs.createReadStream(avatar2Path)
        ]
      };

      return api.sendMessage(msg, threadID, () => {
        fs.unlink(avatar1Path).catch(() => {});
        fs.unlink(avatar2Path).catch(() => {});
        fs.unlink(gifPath).catch(() => {});
      }, messageID);

    } catch (err) {
      console.error(err);

      return api.sendMessage(
        `❌ Error: ${err.message}`,
        event.threadID,
        event.messageID
      );
    }
  }
};
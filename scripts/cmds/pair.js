const axios = require("axios");
const Canvas = require("canvas");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "pair",
    version: "1.0",
    author: "Modified by ChatGPT",
    countDown: 5,
    role: 0,
    shortDescription: "Pair two random users",
    longDescription: "Creates a love pair image between two random users of the chat",
    category: "fun",
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ message, event, usersData, threadsData }) {
    const threadInfo = await threadsData.get(event.threadID, "members");
    const members = threadInfo.filter(m => m.inGroup);

    if (members.length < 2) {
      return message.reply("⚠️ জোড়া করার মতো পর্যাপ্ত মেম্বার নেই!");
    }

    // র‍্যান্ডম দুইজন বেছে নেওয়া
    const shuffled = members.sort(() => 0.5 - Math.random());
    const user1 = shuffled[0].userID;
    const user2 = shuffled[1].userID;

    const name1 = await usersData.getName(user1);
    const name2 = await usersData.getName(user2);

    const matchPercent = Math.floor(Math.random() * 101);
    const comment =
      matchPercent >= 90 ? "💘 Perfect match!" :
      matchPercent >= 70 ? "💞 Strong Connection!" :
      matchPercent >= 50 ? "😊 Possible spark!" :
      matchPercent >= 30 ? "🤔 Needs time..." :
      "🚫 Not meant to be 😅";

    const getAvatar = async (uid) => {
      try {
        const url = `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
        const img = await axios.get(url, {
          responseType: "arraybuffer",
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        return img.data;
      } catch {
        return null;
      }
    };

    const avatar1 = await Canvas.loadImage(await getAvatar(user1));
    const avatar2 = await Canvas.loadImage(await getAvatar(user2));

    const canvas = Canvas.createCanvas(700, 350);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff0f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Avatar 1
    ctx.save();
    ctx.beginPath();
    ctx.arc(175, 175, 100, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar1, 75, 75, 200, 200);
    ctx.restore();

    // Avatar 2
    ctx.save();
    ctx.beginPath();
    ctx.arc(525, 175, 100, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar2, 425, 75, 200, 200);
    ctx.restore();

    // Heart
    ctx.font = "60px Arial";
    ctx.fillStyle = "#ff3366";
    ctx.fillText("❤️", 320, 190);

    // Names
    ctx.font = "bold 28px Arial";
    ctx.fillStyle = "#000";
    ctx.fillText(name1, 125, 310);
    ctx.fillText(name2, 475, 310);

    // Match %
    ctx.font = "24px Arial";
    ctx.fillStyle = "#d63384";
    ctx.fillText(`Match: ${matchPercent}%`, 280, 340);

    const filePath = path.join(__dirname, "pair_result.png");
    fs.writeFileSync(filePath, canvas.toBuffer());

    await message.reply({
      body: `💑 ${name1} ❤️ ${name2}\n🎯 ম্যাচ রেট: ${matchPercent}%\n💌 মন্তব্য: ${comment}`,
      attachment: fs.createReadStream(filePath)
    });

    fs.unlinkSync(filePath);
  }
};
const axios = require("axios");
const request = require("request");
const fs = require("fs-extra");
const moment = require("moment-timezone");

module.exports = {
  config: {
    name: "owner",
    aliases: ["Owner"],
    version: "1.0",
    author: "Maruf Hossain",
    countDown: 5,
    role: 0,
    shortDescription: "Show Owner Info",
    longDescription: "Displays information about the bot owner",
    category: "info",
    guide: ""
  },

  onStart: async function ({ api, event }) {
    const time = moment().tz("Asia/Dhaka").format("DD/MM/YYYY hh:mm:ss A");
    const imgPath = __dirname + "/cache/owner_avatar.png";
    const profilePicURL = "https://graph.facebook.com/100066542686904/picture?height=720&width=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";

    const ownerInfo = `
┏━━━━━━━━━━━━━━━━━━━━━┓
┃      🌟 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢 🌟      
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 👤 𝐍𝐚𝐦𝐞      : Maruf Hossainッ
┃ 🚹 𝐆𝐞𝐧𝐝𝐞𝐫    : 𝐌𝐚𝐥𝐞
┃ ❤️ 𝐑𝐞𝐥𝐚𝐭𝐢𝐨𝐧  : single 🙁
┃ 🎂 𝐀𝐠𝐞       : 18+
┃ 🕌 𝐑𝐞𝐥𝐢𝐠𝐢𝐨𝐧  : 𝐈𝐬𝐥𝐚𝐦
┃ 🏫 𝐄𝐝𝐮𝐜𝐚𝐭𝐢𝐨𝐧 : SSC 25
┃ 🏡 𝐀𝐝𝐝𝐫𝐞𝐬𝐬  : Meherpur, Bangladesh
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🎭 𝐓𝐢𝐤𝐭𝐨𝐤  : Srotoshini-স্রোত্বোসিনী
┃ 📢 𝐓𝐞𝐥𝐞𝐠𝐫𝐚𝐦 : ×
┃ 🌐 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 : fb.com/profile.php?id=100066542686904
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🕒 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 𝐓𝐢𝐦𝐞: ${time}
┗━━━━━━━━━━━━━━━━━━━━━┛
`;

    try {
      await new Promise((resolve, reject) => {
        request(encodeURI(profilePicURL))
          .pipe(fs.createWriteStream(imgPath))
          .on("close", resolve)
          .on("error", reject);
      });

      await api.sendMessage({
        body: ownerInfo,
        attachment: fs.createReadStream(imgPath)
      }, event.threadID);

      fs.unlinkSync(imgPath);
    } catch (err) {
      await api.sendMessage("🤪" + ownerInfo, event.threadID);
    }
  }
};
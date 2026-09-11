const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage, registerFont } = require("canvas");

// Font download
const FONT_URL = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf";
const FONT_DIR = path.join(__dirname, "fonts");
const FONT_PATH = path.join(FONT_DIR, "NotoSansBengali-Regular.ttf");

async function ensureFont() {
  await fs.ensureDir(FONT_DIR);
  if (!fs.existsSync(FONT_PATH)) {
    const res = await axios.get(FONT_URL, { responseType: "arraybuffer" });
    await fs.writeFile(FONT_PATH, res.data);
  }
  registerFont(FONT_PATH, { family: "Bangla" });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

module.exports = {
  config: {
    name: "f",
    version: "6.5",
    author: "Maruf",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Fake Messenger message" },
    longDescription: { en: "Generate a fake Messenger-style message bubble" },
    category: "fun",
    guide: { en: "-fakemsg @mention text" }
  },

  onStart: async function ({ message, event, usersData, args }) {
    try {
      await ensureFont();

      let targetID = event.senderID;
      let fakeText = args.join(" ");

      if (event.type === "message_reply") {
        targetID = event.messageReply.senderID;
      } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
        fakeText = args.join(" ").replace(/@.+/, "").trim();
      }

      if (!fakeText || fakeText.length < 1)
        return message.reply("❌ টেক্সট লিখো!");

      const userInfo = await usersData.get(targetID);
      const name = userInfo?.name || "Unknown";

      const imgURL = `https://graph.facebook.com/${targetID}/picture?width=512&height=512&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
      const avatarBuffer = (await axios.get(imgURL, { responseType: "arraybuffer" })).data;
      const avatar = await loadImage(avatarBuffer);

      const width = 1300;
      const height = 420;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#18191A";
      ctx.fillRect(0, 0, width, height);

      // Text box parameters
      const bubbleX = 180;
      const bubbleY = 135;
      const padding = 34;
      const maxTextWidth = width - 350;

      // Font set for measuring
      ctx.font = "bold 38px Bangla, Segoe UI, Helvetica Neue";

      // Word wrap
      let lines = wrapText(ctx, fakeText, maxTextWidth - padding * 2);
      const maxLines = 3; // limit to 3 lines
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] += "...";
      }

      const lineHeight = 54;
      const bubbleHeight = padding * 2 + lines.length * lineHeight;

      // Profile pic position
      const avatarSize = 110;
      const avatarX = 55;
      const avatarY = bubbleY + (bubbleHeight - avatarSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Draw name
      ctx.font = `bold 44px Bangla, Segoe UI, Helvetica Neue`;
      ctx.fillStyle = "#E4E6EB";
      ctx.fillText(name, 190, 100);

      // Bubble width
      const textWidth = Math.min(
        Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2,
        maxTextWidth
      );

      // Draw bubble
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#3A3B3C";
      ctx.beginPath();
      ctx.roundRect(bubbleX, bubbleY, textWidth, bubbleHeight, 28);
      ctx.fill();
      ctx.shadowColor = "transparent";

      ctx.font = "bold 38px Bangla, Segoe UI, Helvetica Neue";
      ctx.fillStyle = "#D0D2D6";

      lines.forEach((line, i) => {
        const posY = bubbleY + padding + 36 + i * lineHeight;
        ctx.fillText(line, bubbleX + padding, posY);
      });

      const imgPath = path.join(__dirname, "fakemsg_result.jpg");
      await fs.writeFile(imgPath, canvas.toBuffer("image/jpeg"));

      return message.reply({
        attachment: fs.createReadStream(imgPath)
      });

    } catch (e) {
      return message.reply("Error: " + e.message);
    }
  }
};
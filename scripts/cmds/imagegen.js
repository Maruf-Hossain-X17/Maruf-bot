const { createCanvas } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "imagegen",
    version: "1.3",
    author: "ChatGPT",
    role: 0,
    shortDescription: { en: "Generate image with background and emoji support" },
    longDescription: {
      en: "Creates an image using your text, emojis, and chosen background color. Example: -imagegen #222 | Hello 😊"
    },
    category: "media",
    guide: {
      en: "-imagegen [color] | [your text]\nExamples:\n-imagegen red | Hello 😊\n-imagegen #000000 | GoatBot is 🔥"
    }
  },

  onStart: async function ({ args, message }) {
    const input = args.join(" ").split("|").map(s => s.trim());

    if (input.length < 2) {
      return message.reply("❗ Use the correct format:\n-imagegen [color] | [text]\nExample:\n-imagegen #222 | Hello 😊");
    }

    const bgColor = input[0] || "#222";
    const text = input[1];
    if (!text) return message.reply("❗ Please enter text after the color. Example:\n-imagegen #000 | Hello 😊");

    const width = 1000;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background color
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Text style
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 60px sans-serif"; // System font (supports emoji if system does)

    // Line wrapping
    const lines = wrapText(ctx, text, width - 100);
    const lineHeight = 70;
    const startY = (height - lines.length * lineHeight) / 2;

    // Draw each line
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], width / 2, startY + i * lineHeight);
    }

    // Save image
    const fileName = `imagegen_${Date.now()}.png`;
    const outPath = path.join(__dirname, fileName);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outPath, buffer);

    // Send image
    await message.reply({
      body: `✅ Image generated with background color: ${bgColor}`,
      attachment: fs.createReadStream(outPath)
    });

    // Auto delete temp file after 30 seconds
    setTimeout(() => {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    }, 30 * 1000);
  }
};

// Word wrapping function
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (let word of words) {
    const testLine = line + word + " ";
    const { width } = ctx.measureText(testLine);
    if (width > maxWidth && line) {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line.trim());
  return lines;
}
const axios = require('axios');
const fs = require('fs-extra'); 
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// 🌐 V4 API Endpoint
const API_ENDPOINT = "https://sing-api-rfgu.onrender.com/api/v4/maruf/imagine"; 
const API_KEY = "maruf";

// ⏱️ Safe Delay Function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🎨 Emergency Canvas Error Image (Guarantees Zero Crash)
function createErrorImage(prompt, index) {
    const canvas = createCanvas(1024, 1024);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 1024);
    
    // Error Text
    ctx.fillStyle = '#ef4444'; // Red
    ctx.font = 'bold 46px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Image 0${index} Unavailable`, 512, 450);
    
    // Prompt Text
    ctx.fillStyle = '#94a3b8'; // Slate
    ctx.font = '30px "Segoe UI", Arial';
    
    // Trim prompt if it's too long
    const shortPrompt = prompt.length > 35 ? prompt.substring(0, 35) + '...' : prompt;
    ctx.fillText(`Prompt: "${shortPrompt}"`, 512, 530);
    
    return canvas.toBuffer('image/png');
}

// 📷 1. Ultra-Stable Sequential Downloader
async function downloadSingleImage(url, tempDir, index, prompt, retries = 3) {
    const tempFilePath = path.join(tempDir, `maruf_ai_${Date.now()}_${index}.png`);

    // Tier 1: Primary API Link
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                timeout: 25000 // Give it enough time
            });
            
            if (response.status === 200 && response.data.length > 5000) {
                await fs.writeFile(tempFilePath, response.data);
                return tempFilePath;
            }
        } catch (e) {
            await sleep(1500 * attempt); // Progressive delay before retry
        }
    }

    // Tier 2: Pollinations Fallback directly with Prompt
    try {
        const seed = Math.floor(Math.random() * 999999);
        const encodedPrompt = encodeURIComponent(prompt);
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1024&height=1024&nologo=true`;
        
        const fallback = await axios.get(fallbackUrl, { 
            responseType: 'arraybuffer', 
            timeout: 20000 
        });
        
        if (fallback.status === 200 && fallback.data.length > 5000) {
            await fs.writeFile(tempFilePath, fallback.data);
            return tempFilePath;
        }
    } catch (fErr) {}

    // Tier 3: Zero-Crash Emergency Image (If everything fails, still give an image!)
    const errorBuffer = createErrorImage(prompt, index);
    await fs.writeFile(tempFilePath, errorBuffer);
    return tempFilePath;
}

// ⚡ 2. Safe URL Fetcher
async function fetchSingleUrl(prompt, seed) {
    try {
        const res = await axios.get(`${API_ENDPOINT}?prompt=${encodeURIComponent(prompt)}&apikey=${API_KEY}&seed=${seed}`, { 
            timeout: 15000
        });
        if (res.data?.data?.image_url) {
            return res.data.data.image_url;
        }
        throw new Error("Invalid API response");
    } catch (e) {
        const encoded = encodeURIComponent(prompt);
        return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=1024&height=1024&nologo=true`;
    }
}

// Fetch URLs Sequentially to avoid IP Block
async function fetchFourImages(prompt) {
    const urls = [];
    const seeds = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9999999));
    
    for (let i = 0; i < seeds.length; i++) {
        const url = await fetchSingleUrl(prompt, seeds[i]);
        urls.push(url);
        await sleep(500); // Breathe for 0.5s between requests
    }
    return urls;
}

// 🎨 3. Pro Grid Builder
async function createGridImage(imagePaths, outputPath) {
    const images = await Promise.all(imagePaths.map(p => loadImage(p)));
    const imgWidth = images[0].width || 1024;
    const imgHeight = images[0].height || 1024;
    const padding = 22;
    const numberSize = 52;
    const footerHeight = 85; 

    const canvasWidth = (imgWidth * 2) + (padding * 3);
    const canvasHeight = (imgHeight * 2) + (padding * 3) + footerHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const positions = [
        { x: padding, y: padding },
        { x: imgWidth + (padding * 2), y: padding },
        { x: padding, y: imgHeight + (padding * 2) },
        { x: imgWidth + (padding * 2), y: imgHeight + (padding * 2) }
    ];

    for (let i = 0; i < images.length && i < 4; i++) {
        const { x, y } = positions[i];
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 18;
        ctx.drawImage(images[i], x, y, imgWidth, imgHeight);
        ctx.shadowBlur = 0; 

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.arc(x + numberSize + 12, y + numberSize + 12, numberSize - 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 38px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`0${i + 1}`, x + numberSize + 12, y + numberSize + 12);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 34px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Powered by Maruf AI Engine ', canvasWidth / 2, canvasHeight - 30);

    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(outputPath, buffer);
    return outputPath;
}

module.exports = {
  config: {
    name: "mj",
    aliases: ["midjourney", "imagine", "draw"],
    version: "5.5.0",
    author: "Maruf",
    countDown: 5,
    role: 0,
    longDescription: "Ultra-Stable AI Image Generator (Anti-Crash Version)",
    category: "ai-image",
    guide: {
      en: "{pn} <prompt>\nExample: {pn} futuristic cyber city --ar 16:9"
    }
  },

  onStart: async function({ message, args, event, commandName }) {
    const prompt = args.join(" ").trim();
    const cacheDir = path.join(__dirname, 'cache');
    await fs.ensureDir(cacheDir);

    if (!prompt) return message.reply("⚠️ | Baby, please provide a prompt first! 🖤");

    message.reaction("⏳", event.messageID);
    let tempPaths = [], gridPath = '';

    try {
      // 1. Fetch URLs Sequentially (Safe Mode)
      const finalUrls = await fetchFourImages(prompt);

      // 2. Download Images Sequentially (Bypass 429 Error)
      tempPaths = [];
      for (let i = 0; i < finalUrls.length; i++) {
          const downloadedPath = await downloadSingleImage(finalUrls[i], cacheDir, i + 1, prompt);
          tempPaths.push(downloadedPath);
          await sleep(600); // Wait 0.6s before downloading next image
      }

      // 3. Create Grid
      gridPath = path.join(cacheDir, `maruf_grid_${Date.now()}.png`);
      await createGridImage(tempPaths, gridPath);

      message.reply({
        body: `✨ HERE YOUR IMAGE BABY 
👉 Reply with 1, 2, 3, 4 to get single high-res image or 'all'baby! 🖤`,
        attachment: fs.createReadStream(gridPath)
      }, (err, info) => {
        if (!err) {
            global.GoatBot.onReply.set(info.messageID, {
                commandName,
                messageID: info.messageID,
                author: event.senderID,
                imageUrls: finalUrls,
                prompt: prompt
            });
        }
        setTimeout(() => {
            [gridPath, ...tempPaths].forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
        }, 20000);
      });

      message.reaction("✅", event.messageID);

    } catch (error) {
      message.reaction("❌", event.messageID);
      [gridPath, ...tempPaths].forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
      message.reply(`❌ | Uff! Something went wrong baby: ${error.message}`);
    }
  },

  onReply: async function({ message, event, Reply }) { 
    const { imageUrls, author, prompt } = Reply;
    if (event.senderID !== author) return;

    const cacheDir = path.join(__dirname, 'cache');
    await fs.ensureDir(cacheDir);

    const userReply = event.body.trim().toLowerCase();
    const createdFiles = [];

    try {
        message.reaction("⏳", event.messageID);

        if (userReply === 'all') {
            const downloaded = [];
            for (let idx = 0; idx < imageUrls.length; idx++) {
                const p = await downloadSingleImage(imageUrls[idx], cacheDir, `all_${idx + 1}`, prompt, 2);
                downloaded.push(p);
                await sleep(500); // Safe download interval
            }
            createdFiles.push(...downloaded);
            
            await message.reply({
                body: `✨ Here are all your gorgeous masterpieces, baby! 🖤`,
                attachment: downloaded.map(p => fs.createReadStream(p))
            });
        } else {
            const selection = parseInt(userReply);
            if (isNaN(selection) || selection < 1 || selection > 4) {
                return message.reply("⚠️ | Hey, reply with a valid number (1-4) or 'all' baby! 🖤");
            }
            
            const singlePath = await downloadSingleImage(imageUrls[selection - 1], cacheDir, `single_${selection}`, prompt, 2);
            createdFiles.push(singlePath);

            await message.reply({
                body: `✨ Here is your gorgeous image baby! 🖤`,
                attachment: fs.createReadStream(singlePath)
            });
        }

        message.reaction("❤️", event.messageID);
        global.GoatBot.onReply.delete(Reply.messageID);

    } catch (error) {
        message.reaction("❌", event.messageID);
        message.reply(`❌ | Download Error baby: ${error.message}`);
    } finally {
        setTimeout(() => {
            createdFiles.forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
        }, 20000);
    }
  } 
};
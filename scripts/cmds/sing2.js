const yts = require("yt-search");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { Shazam } = require("node-shazam");

const shazam = new Shazam();

/* ===================== BASE API ===================== */

async function baseApiUrl() {
  try {
    const base = await axios.get(
      "https://raw.githubusercontent.com/Mostakim0978/D1PT0/refs/heads/main/baseApiUrl.json"
    );
    return base.data.api;
  } catch {
    return "https://default-api.com/";
  }
}

/* ===================== STREAM ===================== */

async function getStream(url) {
  const res = await axios.get(url, { responseType: "stream" });
  return res.data;
}

/* ===================== SHAZAM ===================== */

async function handleShazam(api, message, attachment) {
  const loading = await message.reply("𝘚𝘤𝘢𝘯𝘯𝘪𝘯𝘨...");

  try {
    const filePath = path.join(__dirname, "cache", "shazam.mp3");

    const res = await axios.get(attachment.url, {
      responseType: "arraybuffer"
    });

    fs.writeFileSync(filePath, res.data);

    const result = await shazam.recognise(filePath, "en-US");

    if (!result?.track) return message.reply("❌ Not found");

    const t = result.track;

    return message.reply(
      `🎵 Found Song\n\nTitle: ${t.title}\nArtist: ${t.subtitle}`
    );

  } catch (e) {
    return message.reply("❌ Shazam failed");
  } finally {
    api.unsendMessage(loading.messageID);
  }
}

/* ===================== DIPTO DOWNLOADER (NEW ADDON) ===================== */

async function diptoDownload(videoId) {
  const api = await baseApiUrl();

  const { data } = await axios.get(
    `${api}/ytDl3?link=${videoId}&format=mp3`
  );

  if (!data?.downloadLink) throw new Error("Download failed");

  return data;
}

/* ===================== ORIGINAL DOWNLOADER ===================== */

async function downloadTrack(api, message, url, useDipto = false) {
  const loading = await message.reply("𝘋𝘰𝘸𝘯𝘭𝘰𝘢𝘥𝘪𝘯𝘨...");

  try {
    let audioUrl;
    let title;

    if (useDipto) {
      const idMatch = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
      const videoId = idMatch ? idMatch[1] : url;

      const data = await diptoDownload(videoId);

      audioUrl = data.downloadLink;
      title = data.title;
    } else {
      const apiURL =
        "https://rest-nyx-apis-production.up.railway.app/api/ytv?d=" +
        encodeURIComponent(url) +
        "&type=mp3";

      const { data } = await axios.get(apiURL);

      audioUrl = data.url;
      title = "song.mp3";
    }

    const filePath = path.join(__dirname, "cache", "song.mp3");

    const audio = await axios.get(audioUrl, {
      responseType: "arraybuffer"
    });

    fs.writeFileSync(filePath, Buffer.from(audio.data));

    await message.reply({
      body: `🎵 ${title}`,
      attachment: fs.createReadStream(filePath)
    });

    fs.unlinkSync(filePath);

  } catch (e) {
    message.reply("❌ Download error");
  } finally {
    api.unsendMessage(loading.messageID);
  }
}

/* ===================== SEARCH ===================== */

async function searchRandom(api, message, query) {
  if (!query) return message.reply("Missing query");

  const res = await yts(query);
  const video = res.videos[Math.floor(Math.random() * res.videos.length)];

  // 🔥 dipto method use
  await downloadTrack(api, message, video.url, true);
}

/* ===================== LIST ===================== */

async function searchList(api, message, query, event) {
  const res = await yts(query);
  const sliced = res.videos.slice(0, 5);

  const list = sliced.map((v, i) => `${i + 1}. ${v.title}`).join("\n");

  const msg = await message.reply(`🎵 Choose:\n\n${list}`);

  global.GoatBot.onReply.set(msg.messageID, {
    commandName: "sing2",
    messageID: msg.messageID,
    author: event.senderID,
    searchResults: sliced
  });
}

/* ===================== ATTACHMENT ===================== */

async function handleAttachment(api, message, attachment) {
  const res = await yts(attachment.title || "music");
  const video = res.videos[0];

  await downloadTrack(api, message, video.url, true);
}

/* ===================== MAIN ===================== */

module.exports = {
  config: {
    name: "sing2",
    version: "3.0",
     category: "MEDIA",
    author: "Nyx + Mesbah + Bokkor",
    role: 0,
    description: "Advanced music system (Shazam + Dipto + Nyx)"
  },

  onStart: async function ({ args, message, event, api }) {
    const reply = event.messageReply;
    const attachment = reply?.attachments?.[0];

    try {
      /* 🎧 SHAZAM */
      if (attachment?.type === "audio") {
        return await handleShazam(api, message, attachment);
      }

      /* 📎 ATTACHMENT */
      if (attachment && !args[0]?.startsWith("-")) {
        return await handleAttachment(api, message, attachment);
      }

      /* 🔎 FLAGS */
      if (args[0]?.startsWith("-")) {
        const flag = args[0];
        const query = args.slice(1).join(" ");

        if (flag === "-m") return await searchList(api, message, query, event);
        return await searchRandom(api, message, query);
      }

      /* 🎵 DEFAULT */
      await searchRandom(api, message, args.join(" "));

    } catch (e) {
      message.reply("❌ " + e.message);
    }
  },

  onReply: async function ({ event, Reply, api, message }) {
    if (event.senderID !== Reply.author) return;

    const index = parseInt(event.body);
    if (!index) return;

    const video = Reply.searchResults[index - 1];

    await downloadTrack(api, message, video.url, true);
  }
};
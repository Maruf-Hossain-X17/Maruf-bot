const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const Jimp = require("jimp");

const COMMAND_NAME = "pin";

const CACHE_DIR = path.join(__dirname, "cache");

const API_CONFIG_URL =
  "https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json";

const FALLBACK_API =
  "https://api.maruf-api.abrdns.com/pin";

const MAX_LIMIT = 36;
const DEFAULT_LIMIT = 6;
const SESSION_TIME = 2 * 60 * 1000;

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
};


// ============================================================
// HELPERS
// ============================================================

function normalizeBaseUrl(url) {
  if (!url || typeof url !== "string") {
    return FALLBACK_API;
  }

  return url.trim().replace(/\/+$/, "");
}


function parseInput(args) {
  let input = Array.isArray(args)
    ? args.join(" ").trim()
    : "";

  let limit = DEFAULT_LIMIT;

  /*
   * Supported:
   * !pin naruto
   * !pin naruto - 20
   * !pin naruto -20
   * !pin naruto _20
   * !pin naruto 20
   */

  const match = input.match(
    /(?:^|\s)(?:[-_]\s*)?(\d+)\s*$/
  );

  if (match) {
    limit = parseInt(match[1], 10);

    input = input
      .slice(0, match.index)
      .trim();
  }

  if (!Number.isFinite(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  }

  limit = Math.min(limit, MAX_LIMIT);

  return {
    query: input,
    limit
  };
}


function isValidImageUrl(url) {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}


function extractImages(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  let images = [];

  if (Array.isArray(data.images)) {
    images = data.images;
  } else if (Array.isArray(data.data)) {
    images = data.data;
  } else if (Array.isArray(data.results)) {
    images = data.results;
  }

  return [
    ...new Set(
      images
        .map(item => {
          if (typeof item === "string") {
            return item;
          }

          if (item && typeof item === "object") {
            return (
              item.url ||
              item.image ||
              item.imageUrl ||
              item.src ||
              item.original ||
              null
            );
          }

          return null;
        })
        .filter(isValidImageUrl)
    )
  ];
}


async function getPinterestApi() {
  try {
    const response = await axios.get(API_CONFIG_URL, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const configuredUrl =
      response.data?.apis?.pin?.url;

    return normalizeBaseUrl(
      configuredUrl || FALLBACK_API
    );

  } catch (error) {
    console.error(
      "[PIN] Failed to load API config:",
      error.message
    );

    return FALLBACK_API;
  }
}


async function downloadImage(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: 15 * 1024 * 1024,
    maxBodyLength: 15 * 1024 * 1024,
    headers: REQUEST_HEADERS,
    validateStatus: status =>
      status >= 200 && status < 300
  });

  const contentType =
    String(response.headers["content-type"] || "")
      .toLowerCase();

  if (
    contentType &&
    !contentType.startsWith("image/")
  ) {
    throw new Error(
      `Invalid content type: ${contentType}`
    );
  }

  const buffer = Buffer.from(response.data);

  if (!buffer.length) {
    throw new Error("Empty image response");
  }

  return buffer;
}


function getGridSettings(count) {
  let cols;

  if (count <= 4) {
    cols = 2;
  } else if (count <= 12) {
    cols = 3;
  } else {
    cols = 4;
  }

  const rows = Math.ceil(count / cols);

  let tileSize;

  if (count <= 6) {
    tileSize = 400;
  } else if (count <= 12) {
    tileSize = 320;
  } else if (count <= 24) {
    tileSize = 280;
  } else {
    tileSize = 240;
  }

  const gap = 12;

  return {
    cols,
    rows,
    tileW: tileSize,
    tileH: tileSize,
    gap
  };
}


async function createCollage(images) {
  const {
    cols,
    rows,
    tileW,
    tileH,
    gap
  } = getGridSettings(images.length);

  const totalW =
    cols * tileW +
    (cols + 1) * gap;

  const totalH =
    rows * tileH +
    (rows + 1) * gap;

  const collage = new Jimp(
    totalW,
    totalH,
    0x111111FF
  );

  const numberFont =
    await Jimp.loadFont(
      Jimp.FONT_SANS_32_WHITE
    );

  /*
   * Download in parallel.
   * This is significantly faster than downloading
   * every image one by one.
   */
  const results = await Promise.allSettled(
    images.map(url => downloadImage(url))
  );

  let successful = 0;

  for (let i = 0; i < results.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x =
      gap + col * (tileW + gap);

    const y =
      gap + row * (tileH + gap);

    const result = results[i];

    if (result.status !== "fulfilled") {
      drawFailedTile(
        collage,
        numberFont,
        x,
        y,
        tileW,
        tileH,
        i + 1
      );

      console.error(
        `[PIN] Image ${i + 1} failed:`,
        result.reason?.message || result.reason
      );

      continue;
    }

    try {
      const img =
        await Jimp.read(result.value);

      img.cover(
        tileW,
        tileH,
        Jimp.HORIZONTAL_ALIGN_CENTER |
        Jimp.VERTICAL_ALIGN_MIDDLE
      );

      collage.blit(img, x, y);

      drawNumberBadge(
        collage,
        numberFont,
        x,
        y,
        i + 1
      );

      successful++;

    } catch (error) {
      console.error(
        `[PIN] Failed processing image ${i + 1}:`,
        error.message
      );

      drawFailedTile(
        collage,
        numberFont,
        x,
        y,
        tileW,
        tileH,
        i + 1
      );
    }
  }

  if (successful === 0) {
    throw new Error("ALL_IMAGES_FAILED");
  }

  return collage;
}


function drawNumberBadge(
  collage,
  font,
  x,
  y,
  number
) {
  const badgeSize = 64;

  const badge = new Jimp(
    badgeSize,
    badgeSize,
    0x000000CC
  );

  collage.blit(
    badge,
    x + 12,
    y + 12
  );

  const text = String(number);

  let textX;

  if (text.length === 1) {
    textX = x + 32;
  } else if (text.length === 2) {
    textX = x + 22;
  } else {
    textX = x + 12;
  }

  collage.print(
    font,
    textX,
    y + 24,
    text
  );
}


function drawFailedTile(
  collage,
  font,
  x,
  y,
  width,
  height,
  number
) {
  const placeholder = new Jimp(
    width,
    height,
    0x252525FF
  );

  collage.blit(
    placeholder,
    x,
    y
  );

  /*
   * Don't use ✕ here because Jimp's bitmap font
   * may not contain that Unicode glyph.
   */
  collage.print(
    font,
    x + 20,
    y + 20,
    String(number)
  );
}


async function safeDelete(filePath) {
  if (!filePath) {
    return;
  }

  try {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
  } catch (error) {
    console.error(
      "[PIN] File cleanup failed:",
      error.message
    );
  }
}


function getReplyStore() {
  if (
    !global.GoatBot ||
    !global.GoatBot.onReply
  ) {
    return null;
  }

  return global.GoatBot.onReply;
}


// ============================================================
// COMMAND
// ============================================================

module.exports = {

  config: {
    name: COMMAND_NAME,
    version: "6.0.0",
    author: "Maruf",
    countDown: 5,
    role: 0,

    description:
      "Search Pinterest HD images with custom limit collage",

    category: "media",

    guide: {
      en:
        "{pn} [query] - [limit]\n" +
        "Example: {pn} naruto - 20"
    },

    dependencies: {
      axios: "",
      "fs-extra": "",
      jimp: "^0.22.12"
    }
  },


  // ==========================================================
  // START
  // ==========================================================

  onStart: async function ({
    api,
    event,
    args,
    message
  }) {

    const {
      threadID,
      messageID,
      senderID
    } = event;

    const {
      query,
      limit
    } = parseInput(args);

    if (!query) {
      return message.reply(
        "📌 Pinterest Search\n\n" +
        "Usage: !pin <query> - <limit>\n" +
        "Example: !pin naruto - 20"
      );
    }

    api.setMessageReaction(
      "🔍",
      messageID,
      () => {},
      true
    );

    let waitMsg = null;
    let collagePath = null;

    try {

      waitMsg = await message.reply(
        `🔍 Searching: ${query} (${limit} images)\n` +
        `⏳ Please wait...`
      );


      // --------------------------------------------------------
      // GET API
      // --------------------------------------------------------

      const baseUrl =
        await getPinterestApi();

      const apiUrl =
        `${baseUrl}/api/maruf` +
        `?query=${encodeURIComponent(query)}` +
        `&limit=${limit}` +
        `&random=true`;

      console.log(
        `[PIN] Request: ${apiUrl}`
      );

      const response =
        await axios.get(apiUrl, {
          timeout: 25000,
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json"
          },
          validateStatus: status =>
            status >= 200 && status < 300
        });

      const data = response.data;

      const images =
        extractImages(data)
          .slice(0, limit);

      if (!images.length) {
        throw new Error("NO_IMAGES");
      }


      // --------------------------------------------------------
      // CACHE
      // --------------------------------------------------------

      await fs.ensureDir(
        CACHE_DIR
      );


      // --------------------------------------------------------
      // CREATE COLLAGE
      // --------------------------------------------------------

      const collage =
        await createCollage(images);

      collagePath = path.join(
        CACHE_DIR,
        `maruf_pin_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`
      );

      await collage
        .quality(90)
        .writeAsync(collagePath);


      // --------------------------------------------------------
      // REMOVE WAIT MESSAGE
      // --------------------------------------------------------

      if (
        waitMsg &&
        waitMsg.messageID
      ) {
        try {
          api.unsendMessage(
            waitMsg.messageID
          );
        } catch {}
      }

      api.setMessageReaction(
        "✅",
        messageID,
        () => {},
        true
      );


      // --------------------------------------------------------
      // CAPTION
      // --------------------------------------------------------

      const caption =
        `✨ 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 𝗥𝗘𝗦𝗨𝗟𝗧𝗦 💖\n` +
        `━━━━━━━━━━━━━\n` +
        `🔍 ${query}\n` +
        `🖼️ ${images.length} HD Images\n` +
        `━━━━━━━━━━━━━\n` +
        `↩️ Reply with a number (1-${images.length})`;


      // --------------------------------------------------------
      // SEND
      // --------------------------------------------------------

      return api.sendMessage(
        {
          body: caption,
          attachment:
            fs.createReadStream(
              collagePath
            )
        },

        threadID,

        async (err, info) => {

          /*
           * Always clean the collage after
           * Messenger has finished processing it.
           */
          await safeDelete(
            collagePath
          );

          collagePath = null;

          if (err) {
            console.error(
              "[PIN] sendMessage error:",
              err
            );

            return;
          }

          if (
            !info ||
            !info.messageID
          ) {
            console.error(
              "[PIN] No messageID returned."
            );

            return;
          }

          const replyStore =
            getReplyStore();

          if (!replyStore) {
            console.error(
              "[PIN] GoatBot onReply store unavailable."
            );

            return;
          }

          replyStore.set(
            info.messageID,
            {
              commandName:
                COMMAND_NAME,

              messageID:
                info.messageID,

              author:
                senderID,

              images,

              query,

              createdAt:
                Date.now()
            }
          );

          setTimeout(() => {

            try {
              replyStore.delete(
                info.messageID
              );
            } catch {}

          }, SESSION_TIME);
        },

        messageID
      );

    } catch (error) {

      await safeDelete(
        collagePath
      );

      if (
        waitMsg &&
        waitMsg.messageID
      ) {
        try {
          api.unsendMessage(
            waitMsg.messageID
          );
        } catch {}
      }

      api.setMessageReaction(
        "❌",
        messageID,
        () => {},
        true
      );

      console.error(
        "[MARUF PIN ERROR]",
        error
      );


      if (
        error.message === "NO_IMAGES"
      ) {
        return message.reply(
          `❌ No images found for "${query}".`
        );
      }


      if (
        error.message === "ALL_IMAGES_FAILED"
      ) {
        return message.reply(
          "❌ The images were found, but none could be downloaded."
        );
      }


      if (
        error.response
      ) {
        console.error(
          "[PIN] HTTP status:",
          error.response.status
        );
      }

      return message.reply(
        "❌ Pinterest API is currently unavailable. Please try again later."
      );
    }
  },


  // ==========================================================
  // REPLY HANDLER
  // ==========================================================

  onReply: async function ({
    api,
    event,
    Reply,
    message
  }) {

    if (!Reply) {
      return;
    }

    const {
      author,
      images,
      query,
      createdAt,
      messageID: replyMessageID
    } = Reply;

    const {
      senderID,
      body,
      threadID,
      messageID
    } = event;


    // --------------------------------------------------------
    // VALIDATE SESSION
    // --------------------------------------------------------

    if (
      !Array.isArray(images) ||
      images.length === 0
    ) {
      const replyStore =
        getReplyStore();

      if (
        replyStore &&
        replyMessageID
      ) {
        replyStore.delete(
          replyMessageID
        );
      }

      return message.reply(
        "⏰ This Pinterest session is no longer available. Use !pin again."
      );
    }


    // --------------------------------------------------------
    // AUTHOR CHECK
    // --------------------------------------------------------

    if (
      String(senderID) !==
      String(author)
    ) {
      return message.reply(
        "⚠️ Only the person who performed the search can select an image."
      );
    }


    // --------------------------------------------------------
    // EXPIRATION
    // --------------------------------------------------------

    if (
      createdAt &&
      Date.now() - createdAt >
        SESSION_TIME
    ) {

      const replyStore =
        getReplyStore();

      if (
        replyStore &&
        replyMessageID
      ) {
        replyStore.delete(
          replyMessageID
        );
      }

      return message.reply(
        "⏰ Session expired. Use !pin again."
      );
    }


    // --------------------------------------------------------
    // PARSE NUMBER
    // --------------------------------------------------------

    const text =
      typeof body === "string"
        ? body.trim()
        : "";

    /*
     * Only accept a plain integer.
     * This prevents values such as:
     * 1abc
     * 1.5
     * 1 2
     */
    if (!/^\d+$/.test(text)) {
      return message.reply(
        `❌ Invalid choice. Reply with a number from 1-${images.length}.`
      );
    }

    const choice =
      Number.parseInt(text, 10);

    if (
      !Number.isSafeInteger(choice) ||
      choice < 1 ||
      choice > images.length
    ) {
      return message.reply(
        `❌ Invalid choice. Reply with a number from 1-${images.length}.`
      );
    }


    api.setMessageReaction(
      "📥",
      messageID,
      () => {},
      true
    );


    let imgPath = null;

    try {

      const selectedUrl =
        images[choice - 1];

      if (
        !isValidImageUrl(
          selectedUrl
        )
      ) {
        throw new Error(
          "INVALID_IMAGE_URL"
        );
      }


      await fs.ensureDir(
        CACHE_DIR
      );


      // ------------------------------------------------------
      // DOWNLOAD SELECTED IMAGE
      // ------------------------------------------------------

      const imageBuffer =
        await downloadImage(
          selectedUrl
        );


      /*
       * Let Jimp validate the downloaded
       * content before sending it.
       */
      const selectedImage =
        await Jimp.read(
          imageBuffer
        );


      /*
       * Re-encode as JPEG.
       *
       * This prevents Messenger from receiving
       * HTML, malformed files, WebP edge cases,
       * etc. as the attachment.
       */
      imgPath = path.join(
        CACHE_DIR,
        `maruf_pin_image_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`
      );

      await selectedImage
        .quality(95)
        .writeAsync(imgPath);


      // ------------------------------------------------------
      // DELETE REPLY SESSION
      // ------------------------------------------------------

      const replyStore =
        getReplyStore();

      if (
        replyStore &&
        replyMessageID
      ) {
        replyStore.delete(
          replyMessageID
        );
      }


      api.setMessageReaction(
        "✅",
        messageID,
        () => {},
        true
      );


      // ------------------------------------------------------
      // CAPTION
      // ------------------------------------------------------

      const caption =
        `✨ 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 𝗜𝗠𝗔𝗚𝗘\n` +
        `━━━━━━━━━━━━\n` +
        `🔍 ${query}\n` +
        `📌 Image #${choice}\n` +
        `━━━━━━━━━━━━\n` +
        `💖 Powered by Maruf`;


      // ------------------------------------------------------
      // SEND IMAGE
      // ------------------------------------------------------

      return api.sendMessage(
        {
          body: caption,
          attachment:
            fs.createReadStream(
              imgPath
            )
        },

        threadID,

        async err => {

          await safeDelete(
            imgPath
          );

          imgPath = null;

          if (err) {
            console.error(
              "[PIN] Failed sending selected image:",
              err
            );
          }
        },

        messageID
      );

    } catch (error) {

      await safeDelete(
        imgPath
      );

      api.setMessageReaction(
        "❌",
        messageID,
        () => {},
        true
      );

      console.error(
        "[MARUF PIN REPLY ERROR]",
        error
      );


      if (
        error.message ===
        "INVALID_IMAGE_URL"
      ) {
        return message.reply(
          "❌ This image URL is no longer valid. Please run !pin again."
        );
      }


      return message.reply(
        "❌ Failed to download or process the selected image."
      );
    }
  }
};
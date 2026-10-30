const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");

module.exports = {
  config: {
    name: "4k",
    aliases: ["hd", "upscale"],
    version: "10.0.0",
    author: "Maruf",
    countDown: 10,
    role: 0,
    shortDescription: "AI Image Enhancer",
    longDescription: "Enhance images using the Maruf AI API",
    category: "image",
    guide: "{pn} (reply to an image)"
  },

  onStart: async function ({ message, event }) {
    const API_URL =
      "https://www.maruf-api.abrdns.com/4k/api/hd/maruf";

    let loadingMessageID = null;
    let imagePath = null;

    async function deleteLoadingMessage() {
      if (!loadingMessageID) {
        console.log("[4K] Processing message ID unavailable.");
        return false;
      }

      try {
        if (typeof message.unsend === "function") {
          await message.unsend(loadingMessageID);
          console.log("[4K] Processing message deleted.");
          return true;
        }

        const api = global.GoatBot?.api;

        if (typeof api?.unsendMessage === "function") {
          await api.unsendMessage(loadingMessageID);
          console.log("[4K] Processing message deleted.");
          return true;
        }

        console.log("[4K] No supported deletion method.");
        return false;
      } catch (error) {
        console.error("[4K] Delete error:", error.message);
        return false;
      }
    }

    try {
      const attachments = [
        ...(event.messageReply?.attachments || []),
        ...(event.attachments || [])
      ];

      const photo = attachments.find(item => {
        const type = String(item.type || "").toLowerCase();

        return (
          ["photo", "image"].includes(type) &&
          typeof item.url === "string" &&
          item.url.length > 0
        );
      });

      if (!photo) {
        return message.reply(
          "❌ No image found. Reply to an image with -4k."
        );
      }

      const loadingMessage = await message.reply(
        "⏳ Enhancing your image with AI. Please wait..."
      );

      loadingMessageID =
        loadingMessage?.messageID ||
        loadingMessage?.messageId ||
        loadingMessage?.id ||
        null;

      console.log(
        "[4K] Processing message ID:",
        loadingMessageID || "Not returned"
      );

      const response = await axios.get(API_URL, {
        params: {
          imgUrl: photo.url
        },
        responseType: "arraybuffer",
        timeout: 50000,
        maxContentLength: 30 * 1024 * 1024,
        maxBodyLength: 30 * 1024 * 1024,
        validateStatus: status =>
          status >= 200 && status < 300
      });

      const buffer = Buffer.from(response.data);

      console.log("[4K] Response bytes:", buffer.length);

      if (buffer.length < 12) {
        throw new Error("The API returned an invalid image.");
      }

      const isJPEG =
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;

      const isPNG =
        buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a
          ])
        );

      const isWebP =
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";

      if (!isJPEG && !isPNG && !isWebP) {
        console.error(
          "[4K] Invalid API response:",
          buffer.toString("utf8", 0, 200)
        );

        throw new Error("The API did not return a valid image.");
      }

      const extension = isPNG
        ? "png"
        : isWebP
          ? "webp"
          : "jpg";

      imagePath = path.join(
        os.tmpdir(),
        `st-goatbot-4k-${Date.now()}.${extension}`
      );

      fs.writeFileSync(imagePath, buffer);

      // Delete processing message before sending the image.
      await deleteLoadingMessage();

      // Send enhanced image with the requested caption.
      await message.reply({
        body: "HERE YOUR 4K IMAGE BABY 😘",
        attachment: fs.createReadStream(imagePath)
      });

      console.log("[4K] Enhanced image sent successfully.");

    } catch (error) {
      console.error("[4K ERROR]", {
        message: error.message,
        code: error.code || null,
        status: error.response?.status || null
      });

      await deleteLoadingMessage();

      let errorMessage =
        "❌ Image processing failed. Please try again later.";

      if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
      ) {
        errorMessage =
          "⏳ Image processing timed out. Please try again.";
      } else if (error.response?.status === 429) {
        errorMessage =
          "⏳ The image server is busy. Please try again shortly.";
      }

      await message.reply(errorMessage);

    } finally {
      if (imagePath) {
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (error) {
          console.error(
            "[4K] Temporary file cleanup failed:",
            error.message
          );
        }
      }
    }
  }
};
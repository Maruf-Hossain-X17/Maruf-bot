module.exports = {
  config: {
    name: "4k",
    aliases: ["hd", "upscale"],
    version: "2.1.0",
    author: "Maruf",
    countDown: 10,
    role: 0,
    shortDescription: "AI 4x HD Image",
    longDescription: "Upscale images to 4x HD using AI",
    category: "image",
    guide: "{pn} (reply to an image)"
  },

  onStart: async function ({ message, event }) {
    const axios = require("axios");

    // API gateway route
    const API_URL =
      "https://www.maruf-api.abrdns.com/4k/api/hd/maruf";

    try {
      // Find an image from the replied message or current message
      const replyAttachments =
        event.messageReply?.attachments || [];

      const currentAttachments =
        event.attachments || [];

      const allAttachments = [
        ...replyAttachments,
        ...currentAttachments
      ];

      const photo = allAttachments.find(item =>
        ["photo", "image"].includes(
          String(item.type || "").toLowerCase()
        ) && item.url
      );

      if (!photo?.url) {
        return message.reply(
          "❌ No image found.\n\n" +
          "Please reply to an image with the command 4k.\n" +
          "Aliases: hd, upscale"
        );
      }

      await message.reply(
        "⏳ Processing your image with AI...\n" +
        "Please wait."
      );

      const response = await axios.get(API_URL, {
        params: {
          imgUrl: photo.url
        },
        responseType: "arraybuffer",
        timeout: 240000,
        maxContentLength: 25 * 1024 * 1024,
        maxBodyLength: 25 * 1024 * 1024,
        validateStatus: status =>
          status >= 200 && status < 300
      });

      const contentType = String(
        response.headers["content-type"] || ""
      ).toLowerCase();

      if (!contentType.startsWith("image/")) {
        throw new Error("INVALID_IMAGE_RESPONSE");
      }

      const imageBuffer = Buffer.from(response.data);

      if (!imageBuffer.length) {
        throw new Error("EMPTY_IMAGE_RESPONSE");
      }

      return await message.reply({
        body: "✅ Your 4x HD image is ready!",
        attachment: imageBuffer
      });

    } catch (error) {
      // Keep technical details in server logs only
      console.error(
        "[4K ERROR]",
        error.response?.status || "",
        error.code || "",
        error.message || "Unknown error"
      );

      let userMessage =
        "❌ Image processing failed. Please try again later.";

      if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
      ) {
        userMessage =
          "⏳ Image processing timed out. Please try again later.";
      } else if (
        error.response?.status === 429
      ) {
        userMessage =
          "⚠️ The service is busy. Please try again later.";
      }

      try {
        return await message.reply(userMessage);
      } catch (replyError) {
        console.error(
          "[4K REPLY ERROR]",
          replyError.message
        );
      }
    }
  }
};
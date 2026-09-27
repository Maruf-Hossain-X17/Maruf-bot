const axios = require("axios");

module.exports = {
  config: {
    name: "cdp",
    aliases: ["coupledp", "couplepic"],
    version: "1.2",
    author: "𝘉𝘰𝘬𝘬𝘰𝘳",
    countDown: 3,
    role: 0,
    shortDescription: {
      en: "Add or get couple pic"
    },
    category: "fun",
    guide: {
      en: "!cdp add (reply to 2 images)\n!cdp list\n!cdp"
    }
  },

  onStart: async function ({ event, message, args }) {

    // Main domain API
    const API_BASE =
      "https://core.apis-noob-x69.rf.gd/api/cdp";

    // ====================================================
    // IMAGE URL → STREAM
    // ====================================================

    const getStream = async (url) => {

      if (
        global.utils &&
        typeof global.utils.getStreamFromUrl === "function"
      ) {
        return await global.utils.getStreamFromUrl(url);
      }

      const res = await axios.get(url, {
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 30000
      });

      return res.data;
    };

    // ====================================================
    // ADD CDP
    // !cdp add
    // Reply to exactly 2 images
    // ====================================================

    if (args[0]?.toLowerCase() === "add") {

      if (
        !event.messageReply ||
        !event.messageReply.attachments
      ) {
        return message.reply(
          "⚠️ 𝘗𝘭𝘦𝘢𝘴𝘦 𝘳𝘦𝘱𝘭𝘺 𝘵𝘰 𝘢 𝘮𝘦𝘴𝘴𝘢𝘨𝘦 𝘸𝘪𝘵𝘩 𝘦𝘹𝘢𝘤𝘵𝘭𝘺 𝟮 𝘪𝘮𝘢𝘨𝘦𝘴."
        );
      }

      const imageAttachments =
        event.messageReply.attachments.filter(
          att =>
            ["photo", "image", "animated_image"].includes(
              att.type
            )
        );

      if (imageAttachments.length !== 2) {
        return message.reply(
          "⚠️ 𝘙𝘦𝘱𝘭𝘺 𝘮𝘦𝘴𝘴𝘢𝘨𝘦 𝘮𝘶𝘴𝘵 𝘤𝘰𝘯𝘵𝘢𝘪𝘯 𝘦𝘹𝘢𝘤𝘵𝘭𝘺 𝟮 𝘪𝘮𝘢𝘨𝘦𝘴."
        );
      }

      const imgUrls =
        imageAttachments.map(
          attachment => attachment.url
        );

      try {

        const res = await axios.post(
          `${API_BASE}/add`,
          {
            urls: imgUrls
          },
          {
            timeout: 120000,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

        if (res.data?.status || res.data?.success) {

          return message.reply(
            "✅ 𝘊𝘰𝘶𝘱𝘭𝘦 𝘪𝘮𝘢𝘨𝘦 𝘢𝘥𝘥𝘦𝘥 𝘴𝘶𝘤𝘤𝘦𝘴𝘴𝘧𝘶𝘭𝘭𝘺 𝘣𝘣𝘺! 😘"
          );

        }

        return message.reply(
          "❌ 𝘍𝘢𝘪𝘭𝘦𝘥 𝘵𝘰 𝘢𝘥𝘥 𝘤𝘰𝘶𝘱𝘭𝘦 𝘪𝘮𝘢𝘨𝘦."
        );

      } catch (err) {

        console.error(
          "[CDP ADD ERROR]",
          err.response?.data || err.message
        );

        const errorMsg =
          err.response?.data?.error ||
          err.response?.data?.details ||
          err.message ||
          "Error occurred while adding.";

        return message.reply(
          `❌ ${errorMsg}`
        );
      }
    }

    // ====================================================
    // LIST
    // !cdp list
    // ====================================================

    if (args[0]?.toLowerCase() === "list") {

      try {

        const res = await axios.get(
          `${API_BASE}/list`,
          {
            timeout: 30000
          }
        );

        const total =
          res.data?.total || 0;

        return message.reply(
          `😘 𝘛𝘰𝘵𝘢𝘭 𝘤𝘰𝘶𝘱𝘭𝘦 𝘪𝘮𝘢𝘨𝘦𝘴: ${total}`
        );

      } catch (err) {

        console.error(
          "[CDP LIST ERROR]",
          err.response?.data || err.message
        );

        return message.reply(
          "❌ 𝘊𝘰𝘶𝘭𝘥𝘯'𝘵 𝘧𝘦𝘵𝘤𝘩 𝘭𝘪𝘴𝘵."
        );
      }
    }

    // ====================================================
    // RANDOM CDP
    // !cdp
    // ====================================================

    try {

      const res = await axios.get(
        `${API_BASE}/random`,
        {
          timeout: 30000
        }
      );

      const cdpData =
        res.data?.data;

      if (
        !cdpData ||
        !cdpData.boy ||
        !cdpData.girl
      ) {

        return message.reply(
          "❌ 𝘕𝘰 𝘤𝘰𝘶𝘱𝘭𝘦 𝘪𝘮𝘢𝘨𝘦𝘴 𝘧𝘰𝘶𝘯𝘥 𝘪𝘯 𝘥𝘢𝘵𝘢𝘣𝘢𝘴𝘦."
        );
      }

      let boyStream;
      let girlStream;

      try {

        boyStream =
          await getStream(
            cdpData.boy
          );

        girlStream =
          await getStream(
            cdpData.girl
          );

      } catch (err) {

        console.error(
          "CDP image stream error:",
          err.message
        );

        return message.reply(
          "❌ 𝘊𝘰𝘶𝘭𝘥𝘯'𝘵 𝘭𝘰𝘢𝘥 𝘤𝘰𝘶𝘱𝘭𝘦 𝘪𝘮𝘢𝘨𝘦 (𝘶𝘳𝘭 𝘦𝘹𝘱𝘪𝘳𝘦𝘥/𝘣𝘢𝘥 𝘧𝘰𝘳𝘮𝘢𝘵)."
        );
      }

      return message.reply({
        body:
          "𝘏𝘦𝘳𝘦 𝘺𝘰𝘶𝘳 𝘤𝘥𝘱 𝘣𝘣𝘺 😘",

        attachment: [
          boyStream,
          girlStream
        ]
      });

    } catch (err) {

      console.error(
        "CDP API error:",
        err.response?.data ||
        err.message
      );

      return message.reply(
        "❌ 𝘊𝘰𝘶𝘭𝘥𝘯'𝘵 𝘧𝘦𝘵𝘤𝘩 𝘤𝘰𝘶𝘱𝘭𝘦 𝘥𝘢𝘵𝘢."
      );
    }
  }
};
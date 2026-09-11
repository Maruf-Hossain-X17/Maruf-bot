const axios = require("axios");

module.exports.config = {
  name: "catbox",
  aliases: ["cb"],
  version: "1.7.0",
  author: "Bokkor x69",
  role: 0,
  category: "utility",
  usePrefix: true,
  requiredMoney: 500,
  description: "Upload attachment to Catbox",
  countdown: 5,
  guide: {
    en: "Reply to attachment or provide URL"
  }
};

module.exports.onStart = async ({
  event,
  message,
  args
}) => {

  const API_BASE =
    "https://core.apis-noob-x69.rf.gd/api/catbox";

  try {

    const replyUrl =
      event.messageReply?.attachments?.[0]?.url;

    const urls = [
      ...(replyUrl ? [replyUrl] : []),
      ...args
    ];

    if (!urls.length) {
      return message.reply(
        "⚠️ 𝙋𝙡𝙚𝙖𝙨𝙚 𝙧𝙚𝙥𝙡𝙮 𝙩𝙤 𝙖𝙣 𝙖𝙩𝙩𝙖𝙘𝙝𝙢𝙚𝙣𝙩 𝙤𝙧 𝙥𝙧𝙤𝙫𝙞𝙙𝙚 𝙖 𝙐𝙍𝙇!"
      );
    }

    message.reaction(
      "⏳",
      event.messageID,
      event.threadID
    );

    const results = [];

    for (const url of urls) {

      try {

        const res = await axios.get(
          `${API_BASE}/upload`,
          {
            params: {
              url: url
            },
            timeout: 120000
          }
        );

        if (
          res.data?.status &&
          res.data?.url
        ) {

          results.push(
            res.data.url
          );

        } else {

          results.push(
            "❌ 𝙐𝙥𝙡𝙤𝙖𝙙 𝙛𝙖𝙞𝙡𝙚𝙙"
          );

        }

      } catch (err) {

        console.error(
          "[CATBOX CMD] Upload Error:",
          err.response?.data ||
          err.message
        );

        results.push(
          "❌ 𝙐𝙥𝙡𝙤𝙖𝙙 𝙛𝙖𝙞𝙡𝙚𝙙"
        );
      }
    }

    message.reaction(
      "✅",
      event.messageID,
      event.threadID
    );

    return message.reply({
      body:
`━━━━━━━
𝙃𝙀𝙍𝙀 𝙔𝙊𝙐𝙍 𝘾𝘼𝙏𝘽𝙊𝙓 𝙇𝙄𝙉𝙆 𝘽𝘽𝙔 😘

${results.join("\n\n")}
`
    });

  } catch (err) {

    console.error(
      "[CATBOX CMD] Error:",
      err.message
    );

    message.reaction(
      "❌",
      event.messageID,
      event.threadID
    );

    return message.reply(
      "❌ 𝙁𝙖𝙞𝙡𝙚𝙙 𝙩𝙤 𝙪𝙥𝙡𝙤𝙖𝙙 𝙛𝙞𝙡𝙚."
    );
  }
};
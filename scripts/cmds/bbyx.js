const axios = require('axios');
const baseApiUrl = async () => "https://baby-api-noob.onrender.com/api";

module.exports.config = {
  name: "bbyx",
  version: "1.0.0",
  author: "Bokkor x69",
  role: 0,
  description: "BBYX Quiz & Teach System",
  category: "chat",
  guide: {
    en: "{pn} random OR\n{pn} [answer] (reply to question) OR\n{pn} teach [YourQuestion] - [Reply1], [Reply2], ..."
  }
};

module.exports.onStart = async ({ api, event, args }) => {
  try {
    const uid = event.senderID;
    const userInfo = await api.getUserInfo(uid);
    const senderName = userInfo[uid]?.name || "Unknown";

    let lang = "bn";
    if (args[0] === "eng") lang = "eng";

    // 🎯 Random question
    const res = await axios.get(`${await baseApiUrl()}/bby?bbyx=random&lang=${lang}`);
    const data = res.data;

    if (!data.question) return api.sendMessage("❌ No question found.", event.threadID, event.messageID);

    api.sendMessage(
      ` Your Question Baby 🎀 \n\n${data.question} \n\n Reply this message with your answer.`,
      event.threadID,
      (error, info) => {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "bbyx",
          type: "save",
          author: uid,
          question: data.question
        });
      },
      event.messageID
    );

  } catch (err) {
    api.sendMessage(`❌ Error: ${err.message}`, event.threadID, event.messageID);
  }
};

module.exports.onReply = async ({ api, event, Reply }) => {
  try {
    if (!Reply || event.senderID !== Reply.author) return;

    const answer = event.body;
    const senderID = event.senderID;

    // sender name
    const userInfo = await api.getUserInfo(senderID);
    const senderName = userInfo[senderID]?.name || "Unknown";

    // 📝 Save reply
    const res = await axios.get(
      `${await baseApiUrl()}/bby?bbyx=save&msg=${encodeURIComponent(Reply.question)}&reply=${encodeURIComponent(answer)}&senderID=${senderID}`
    );
    const data = res.data;

    api.sendMessage(
      `✅ Reply saved!\nReplies "${answer}" added to "${Reply.question}".\n👤 Teacher: ${senderName}`,
      event.threadID,
      event.messageID
    );

    // 🎯 Next question
    const next = await axios.get(`${await baseApiUrl()}/bby?bbyx=random&lang=bn`);
    const nq = next.data;

    api.sendMessage(
      ` 🎀 Next Question\n\n${nq.question}`,
      event.threadID,
      (error, info) => {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "bbyx",
          type: "save",
          author: senderID,
          question: nq.question
        });
      }
    );

  } catch (err) {
    api.sendMessage(`❌ Error: ${err.message}`, event.threadID, event.messageID);
  }
};
const axios = require("axios");

const baseApiUrl = "https://baby-api-noob.onrender.com/api";

module.exports.config = {
  name: "bby",
  aliases: ["baby", "babu", "jan"],
  version: "6.9.1",
  author: "Bokkor x69",
  countDown: 0,
  role: 0,
  description: "Better than all sim simi",
  category: "chat",
  guide: {
    en: `{pn} [anyMessage] OR
teach [YourMessage] - [Reply1], [Reply2], [Reply3]... OR
remove [YourMessage] OR
rm [YourMessage] - [indexNumber] OR
msg [YourMessage] OR
list OR 
edit [YourMessage] - [NewReply]`,
  },
};

// Helper function
const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

module.exports.onStart = async ({ api, event, args, usersData }) => {
  const uid = event.senderID;
  const link = `${baseApiUrl}/bby`;
  const dipto = args.join(" ").toLowerCase();

  try {
    // No args: send random greeting
    if (!args[0]) {
      const greetings = ["Bolo baby", "hum", "type help baby", "type !baby hi"];
      return api.sendMessage(randomFromArray(greetings), event.threadID, event.messageID);
    }

    // Remove message by text
    if (args[0] === "remove") {
      const message = dipto.replace("remove ", "");
      const res = await axios.get(`${link}?rm=${encodeURIComponent(message)}&index=0`);
      const data = res.data.data;
      return api.sendMessage(`✅ Removed!\nmsg = ${data.text}\nreply = ${data.replies.join(", ") || "none"}`, event.threadID, event.messageID);
    }

    // Remove message by index
    if (args[0] === "rm" && dipto.includes("-")) {
      const [msg, index] = dipto.replace("rm ", "").split(" - ");
      const res = await axios.get(`${link}?rm=${encodeURIComponent(msg)}&index=${index}`);
      const data = res.data.data;
      return api.sendMessage(`✅ Removed index ${index}\nmsg = ${data.text}\nreply = ${data.replies.join(", ") || "none"}`, event.threadID, event.messageID);
    }

    // List all messages
    if (args[0] === "list") {
      const res = await axios.get(`${link}?list=all`);
      return api.sendMessage(`🎀 Baby Total Teach = ${res.data.total}`, event.threadID, event.messageID);
    }

    // Get message replies
    if (args[0] === "msg") {
      const msg = dipto.replace("msg ", "");
      const res = await axios.get(`${link}?msg=${encodeURIComponent(msg)}`);
      const data = res.data.data;
      return api.sendMessage(`msg = ${data.text}\nreply = ${data.replies.join(", ") || "none"}`, event.threadID, event.messageID);
    }

    // Edit message reply
    if (args[0] === "edit") {
      const [oldMsg, newMsg] = dipto.replace("edit ", "").split(" - ");
      if (!oldMsg || !newMsg) return api.sendMessage("❌ Invalid format! Use edit [YourMessage] - [NewReply]", event.threadID, event.messageID);
      const res = await axios.get(`${link}?edit=${encodeURIComponent(oldMsg)}&replace=${encodeURIComponent(newMsg)}`);
      const data = res.data.data;
      return api.sendMessage(`✅ Edited!\nmsg = ${data.text}\nreply = ${data.replies.join(", ")}`, event.threadID, event.messageID);
    }

    // Teach new message
    if (args[0] === "teach") {
      const [msg, reply] = dipto.replace("teach ", "").split(" - ");
      if (!msg || !reply) return api.sendMessage("❌ Invalid format!", event.threadID, event.messageID);

      const userInfo = await api.getUserInfo(uid);
      const senderName = userInfo[uid]?.name || "Unknown";

      const res = await axios.get(`${link}?teach=${encodeURIComponent(msg)}&reply=${encodeURIComponent(reply)}&senderID=${uid}`);
      const data = res.data;

      if (data.message?.includes("already exist")) {
        return api.sendMessage(`${data.message}`, event.threadID, event.messageID);
      }

      return api.sendMessage(
        `✅ Replies added\nReplies "${reply}" added to "${msg}".\nTeacher: ${senderName}\nTeachs: ${data.total || 1}`,
        event.threadID,
        event.messageID
      );
    }

    // Default: reply system
    const res = await axios.get(`${link}/teachreply?msg=${encodeURIComponent(dipto)}&senderID=${uid}`);
    const text = res.data.data.text;
    api.sendMessage(text, event.threadID, (error, info) => {
      global.GoatBot.onReply.set(info.messageID, {
        commandName: this.config.name,
        type: "reply",
        messageID: info.messageID,
        author: uid,
      });
    }, event.messageID);

  } catch (e) {
    console.error(e);
    api.sendMessage(`❌ Error: ${e.message}`, event.threadID, event.messageID);
  }
};

// Reply handler
module.exports.onReply = async ({ api, event }) => {
  try {
    const msg = event.body?.toLowerCase() || "";
    const res = await axios.get(`${baseApiUrl}/bby/teachreply?msg=${encodeURIComponent(msg)}&senderID=${event.senderID}`);
    const text = res.data.data.text;

    api.sendMessage(text, event.threadID, (error, info) => {
      global.GoatBot.onReply.set(info.messageID, {
        commandName: "bby",
        type: "reply",
        messageID: info.messageID,
        author: event.senderID,
      });
    }, event.messageID);
  } catch (err) {
    api.sendMessage(`❌ Error: ${err.message}`, event.threadID, event.messageID);
  }
};

// Auto reply when mention
module.exports.onChat = async ({ api, event }) => {
  try {
    // 🛑 FIX: Prevent the bot from replying to its own messages
    if (event.senderID === api.getCurrentUserID()) {
      return;
    }

    const body = event.body?.toLowerCase() || "";
    const triggerWords = ["bby", "baby", "babu", "bot", "jan", "janu"];
    if (!triggerWords.some(w => body.startsWith(w))) return;

    const message = body.replace(/^\S+\s*/, "");
    const link = `${baseApiUrl}/bby/teachreply?msg=${encodeURIComponent(message)}&senderID=${event.senderID}`;

    if (!message) {
      const replies = ["এইভাবে ডাকলে তো প্রেমে পরে যাবো 😫", "babu khuda lagse🥺", "Hop beda😾", "আমাকে ডাকলে, আমি কিস করে দেবো😘", "বলো বাবু😫", "এতো ডাকো কেন😒", " bby bby না করে কি হয়েছে সেটা বলো😒😒", "কিছু বলবা বেবি?", "bye"];
      return api.sendMessage(randomFromArray(replies), event.threadID, (error, info) => {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "bby",
          type: "reply",
          messageID: info.messageID,
          author: event.senderID,
        });
      }, event.messageID);
    }

    const res = await axios.get(link);
    const text = res.data.data.text;
    api.sendMessage(text, event.threadID, (error, info) => {
      global.GoatBot.onReply.set(info.messageID, {
        commandName: "bby",
        type: "reply",
        messageID: info.messageID,
        author: event.senderID,
      });
    }, event.messageID);

  } catch (err) {
    api.sendMessage(`❌ Error: ${err.message}`, event.threadID, event.messageID);
  }
};
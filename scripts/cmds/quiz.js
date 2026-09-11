const fs = require("fs");
const path = require("path");

const quizPath = path.join(__dirname, "..", "..", "database", "data", "quiz.json");
const usedPath = path.join(__dirname, "..", "..", "database", "data", "quizUsed.json");

module.exports = {
  config: {
    name: "quiz",
    version: "2.3",
    author: "ChatGPT",
    countDown: 5,
    role: 0,
    description: {
      en: "Play a quiz game",
      bn: "কুইজ খেলুন"
    },
    category: "fun",
    guide: {
      en: "{pn}",
      bn: "{pn}"
    }
  },

  onStart: async function ({ api, event }) {
    if (!fs.existsSync(quizPath)) {
      return api.sendMessage("❌ কুইজ ফাইল খুঁজে পাওয়া যায়নি!", event.threadID);
    }

    const questions = JSON.parse(fs.readFileSync(quizPath, "utf8"));
    let usedData = fs.existsSync(usedPath) ? JSON.parse(fs.readFileSync(usedPath, "utf8")) : {};

    const userId = event.senderID;
    const usedByUser = usedData[userId] || [];
    const unused = questions.filter((q, idx) => !usedByUser.includes(idx));

    if (unused.length === 0) {
      return api.sendMessage("✅ আপনি সব কুইজ শেষ করেছেন! 🎉", event.threadID);
    }

    const randomIndex = Math.floor(Math.random() * unused.length);
    const selectedQuestion = unused[randomIndex];
    const actualIndex = questions.findIndex(q => q.question === selectedQuestion.question);

    usedByUser.push(actualIndex);
    usedData[userId] = usedByUser;
    fs.writeFileSync(usedPath, JSON.stringify(usedData, null, 2));

    const boxText = `
╭───────────────⭓
│ 🧠 কুইজ টাইম!
│
│ ❓ ${selectedQuestion.question}
│
${selectedQuestion.options.map(opt => `│ ${opt}`).join("\n")}
│
│ 📩 উত্তর দিন (A/B/C/D) এই মেসেজে রিপ্লাই করে
╰───────────────⭓`;

    api.sendMessage(boxText, event.threadID, (err, info) => {
      global.GoatBot.onReply.set(info.messageID, {
        commandName: this.config.name,
        author: event.senderID,
        correctAnswer: selectedQuestion.answer,
        messageID: info.messageID
      });
    });
  },

  onReply: async function ({ api, event, Reply }) {
    const { author, correctAnswer, messageID } = Reply;

    if (event.senderID !== author)
      return api.sendMessage("⚠️ এই কুইজটি আপনি শুরু করেননি।", event.threadID, event.messageID);

    const userAnswer = event.body.trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(userAnswer)) {
      return api.sendMessage("⚠️ অনুগ্রহ করে শুধু A, B, C, অথবা D লিখুন।", event.threadID, event.messageID);
    }

    try {
      await api.unsendMessage(messageID);
    } catch (e) {
      console.log("❌ মেসেজ ডিলিট করতে ব্যর্থ:", e.message);
    }

    const correct = userAnswer === correctAnswer;
    const coinReward = correct ? Math.floor(Math.random() * 50 + 50) : 0;  // 50–99 coins
    const expReward = correct ? Math.floor(Math.random() * 30 + 30) : 0;   // 30–59 EXP

    let resultMsg = "";

    if (correct) {
      resultMsg = `
🎉 Congratulations, Quiz Master!

🏆 You're a Quiz Champion!
🎁 You've earned:
   💰 ${coinReward} Coins
   ✨ ${expReward} EXP

🚀 Keep it up!
`;
      // Economy system handle
      if (global.db && global.db.addMoney) await global.db.addMoney(event.senderID, coinReward);
      if (global.db && global.db.addExp) await global.db.addExp(event.senderID, expReward);
    } else {
      resultMsg = `❌ ভুল উত্তর 😓\n✔️ সঠিক উত্তর ছিল: ${correctAnswer}`;
    }

    return api.sendMessage(resultMsg, event.threadID, event.messageID);
  }
};
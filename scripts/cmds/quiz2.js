const axios = require("axios");

// ফিক্সড: bot Instance অ্যাক্সেস করার জন্য একটি নিরাপদ পদ্ধতি
function getBotInstance(globalObject) {
    if (globalObject && globalObject.GoatBot) {
        return globalObject.GoatBot;
    }
    if (typeof global !== 'undefined' && global.GoatBot) {
        return global.GoatBot;
    }
    return null;
}


module.exports = {
  config: {
    name: "quiz2",
    aliases: ["qz2"],
    version: "2.1", // Ultimate Fix Version
    author: "Dipto (Ultimate Fix by Gemini)",
    countDown: 0,
    role: 0,
    category: "game",
    guide: "{p}quiz2\n{p}quiz2 bn\n{p}quiz2 en",
  },

  onStart: async function ({ api, event, usersData, args, global }) { 
    // Safely access global.GoatBot
    const bot = getBotInstance(global); 
    
    if (!bot || !bot.config || !bot.config.api || !bot.onReply) {
        return api.sendMessage("❌ | Bot core configuration error (GoatBot or onReply map missing).", event.threadID, event.messageID);
    }
    const BASE_API_URL = bot.config.api;
    
    const input = args.join('').toLowerCase() || "bn";
    let timeout = 60; // 60 seconds
    let category = "bangla";

    if (input === "en" || input === "english") {
      category = "english";
    }

    try {
      // Note: If your API URL is different, change it here or in config.json
      const apiUrl = `${BASE_API_URL}/quiz?category=${category}&q=random`; 
      const response = await axios.get(apiUrl);

      const quizData = response.data.question;
      const { question, correctAnswer, options } = quizData;
      const { a, b, c, d } = options;
      
      const namePlayerReact = await usersData.getName(event.senderID);
      
      const quizMsg = {
        body: `\n╭──✦ ${question}\n├‣ 𝗔) ${a}\n├‣ 𝗕) ${b}\n├‣ 𝗖) ${c}\n├‣ 𝗗) ${d}\n╰──────────────────‣\n💡 **Your Reply should be just the letter (A, B, C, or D).**\n⏰ You have ${timeout} seconds to answer.`,
      };

      api.sendMessage(
        quizMsg,
        event.threadID,
        (error, info) => {
          if (error) throw error; 
          
          bot.onReply.set(info.messageID, {
            type: "quiz_answer", 
            commandName: this.config.name,
            author: event.senderID,
            messageID: info.messageID, // Bot's Message ID
            dataGame: quizData,
            correctAnswer: correctAnswer.toLowerCase(),
            nameUser: namePlayerReact,
            attempts: 0
          });
          
          // টাইমাউট লজিক: সেশন বন্ধ করা এবং মেসেজ আনসেন্ড করা
          setTimeout(() => {
            if (bot.onReply.has(info.messageID)) {
                bot.onReply.delete(info.messageID);
                api.sendMessage(`🚫 | Time's up, ${namePlayerReact}! The quiz has expired.`, event.threadID);
                // Try to unsend the original message to cleanly end the reply chain
                api.unsendMessage(info.messageID).catch(e => console.error("Unsend Error on timeout:", e));
            }
          }, timeout * 1000);
          
        },
        event.messageID,
      );
      
    } catch (error) {
      console.error("❌ | Error occurred in onStart:", error.message);
      const errorMessage = error.response && error.response.status === 404 
                           ? "❌ | API Service is unavailable (404 Not Found). Please check your BASE_API_URL or try again later." 
                           : `❌ | An error occurred while fetching the quiz: ${error.message}`;
      api.sendMessage(errorMessage, event.threadID, event.messageID);
    }
  },

  onReply: async ({ event, api, Reply, usersData }) => {
    // Safely access onReply using the utility function
    const botReply = getBotInstance({}).onReply;
    if (!botReply) return; 

    const { correctAnswer, nameUser, author, dataGame } = Reply;
    const maxAttempts = 2;

    // 1. Authorization Check
    if (event.senderID !== author) {
      return api.sendMessage(
        "Who are you bby🐸🦎",
        event.threadID,
        event.messageID
      );
    }
    
    // 2. Input Processing
    let userReply = event.body.trim().toUpperCase(); 

    // 3. Attempt Limit Check
    if (Reply.attempts >= maxAttempts) {
      // 🛑 ফিক্স: সেশন ডিলিট এবং মেসেজ আনসেন্ড করে রিপ্লাই চেইন বন্ধ করা
      botReply.delete(Reply.messageID); 
      await api.unsendMessage(Reply.messageID).catch(console.error);

      const incorrectMsg = `🚫 | ${nameUser}, you have reached the maximum number of attempts (${maxAttempts}).\nThe correct answer is: ${dataGame.correctAnswer}`; 
      return api.sendMessage(incorrectMsg, event.threadID, event.messageID);
    }
    
    // 4. Validate Input Format 
    if (!["A", "B", "C", "D"].includes(userReply)) {
         return api.sendMessage(
            `❌ | Invalid format. Please reply with **A, B, C, or D** only.`,
            event.threadID,
            event.messageID
         );
    }

    // 5. Map User Letter to Full Answer
    const optionMap = {
        "A": dataGame.options.a,
        "B": dataGame.options.b,
        "C": dataGame.options.c,
        "D": dataGame.options.d,
    };
    
    const selectedAnswerText = optionMap[userReply].toLowerCase(); 

    // 6. Check Answer
    if (selectedAnswerText === correctAnswer) { 
        // 🛑 ফিক্স: সেশন ডিলিট এবং মেসেজ আনসেন্ড করে রিপ্লাই চেইন বন্ধ করা
        botReply.delete(Reply.messageID); 
        await api.unsendMessage(Reply.messageID).catch(console.error);

        // Reward logic
        let rewardCoins = 300;
        let rewardExp = 100;
        let userData = await usersData.get(author);
        await usersData.set(author, {
            money: userData.money + rewardCoins,
            exp: userData.exp + rewardExp,
            data: userData.data,
        });
        
        let correctMsg = `Congratulations, ${nameUser}! 🌟🎉\n\nYou're a Quiz Champion! 🏆\n\nYou've earned **${rewardCoins} Coins 💰** and **${rewardExp} EXP 🌟**\n\nKeep up the great work! 🚀`;
        api.sendMessage(correctMsg, event.threadID, event.messageID);
        
    } else {
        // Wrong Answer
        Reply.attempts += 1;
        botReply.set(Reply.messageID, Reply); 
        
        api.sendMessage(
            `❌ | Wrong Answer. You have **${maxAttempts - Reply.attempts}** attempts left.\n✅ | Try Again by replying with the correct letter (A, B, C, or D).`,
            event.threadID,
            event.messageID,
        );
    }
  },
};
const fs = require("fs");
const path = require("path");

const truthPath = path.join(__dirname, "..", "..", "database", "data", "truth.json");
const darePath = path.join(__dirname, "..", "..", "database", "data", "dare.json");
const usedPath = path.join(__dirname, "..", "..", "database", "data", "truthdareUsed.json");
// --- PATH FOR USER BALANCES ---
const balancePath = path.join(__dirname, "..", "..", "database", "data", "userBalances.json"); 
// ----------------------------------

// --- REWARD AND TAUNT CONSTANTS ---
const TRUTH_REWARD = 100;
const DARE_REWARD = 300;
const REWARD_TIMEOUT = 60000; // 60 seconds for initial claim
const TAUNT_DELAY = 2000; // 2 seconds (2,000 milliseconds) delay for spam
const TAUNT_COUNT = 5; // 5 times
const TAUNT_MESSAGES = ["ভুয়া", "ভিতু"]; // Alternating messages
// ----------------------------------

// --- Utility function to read/write balances ---
function readBalances() {
  if (!fs.existsSync(balancePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(balancePath, "utf-8"));
}

function writeBalances(balances) {
  fs.writeFileSync(balancePath, JSON.stringify(balances, null, 2));
}
// ----------------------------------------------


module.exports = {
  config: {
    name: "truthordare",
    version: "1.0",
    author: "ChatGPT",
    countDown: 3,
    role: 0,
    description: {
      en: "Play Truth or Dare and earn coins by completing them. Fail to answer and get taunted!",
      bn: "ট্রুথ অর ডেয়ার খেলুন এবং সম্পূর্ণ করে কয়েন অর্জন করুন। সময় মতো উত্তর না দিলে অপমানিত হবেন!"
    },
    category: "fun",
    guide: {
      en: "{pn} - Play. After Truth, reply with your answer. After Dare, reply 'done' for a reward!",
      bn: "{pn} - খেলুন। ট্রুথের পর উত্তর দিন। ডেয়ারের পর 'done' লিখে পুরস্কার নিন!"
    }
  },

  onStart: async function ({ api, event }) {
    const userId = event.senderID;

    return api.sendMessage(
      "🧠 **Truth or Dare?**\n\n🔹 *'Truth'* লিখে সত্য প্রশ্ন নাও\n🔸 *'Dare'* লিখে মজার চ্যালেঞ্জ নাও\n\n👉 রিপ্লাই করো এই মেসেজে **Truth** বা **Dare** লিখে!",
      event.threadID,
      (err, info) => {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: this.config.name,
          author: userId,
          messageID: info.messageID
        });
      }
    );
  },

  onReply: async function ({ api, event, Reply }) {
    const { author, messageID, state, timeoutHandle } = Reply;
    const threadID = event.threadID;
    
    if (event.senderID !== author) {
      return api.sendMessage("⚠️ এই Truth or Dare আপনি শুরু করেননি।", threadID, event.messageID);
    }

    /**
     * সময় শেষ হলে স্বয়ংক্রিয়ভাবে তাগিদ (taunt) দেওয়ার ফাংশন
     * এটিকে onReply এর মধ্যে সংজ্ঞায়িত করা হলো যাতে এটি api, threadID, author এক্সেস করতে পারে।
     */
    const autoTaunt = (currentMessageID) => {
        const replyEntry = global.GoatBot.onReply.get(currentMessageID);
        
        if (replyEntry && replyEntry.state === "awaiting_reward_claim") {
            // 1. ম্যাপ থেকে এন্ট্রি ডিলিট করে দাও যাতে আর কোনো রিপ্লাই না নেয়
            global.GoatBot.onReply.delete(currentMessageID);

            // --- SPAM LOGIC ---
            
            // Initial message
            api.sendMessage(
                {
                    body: `⏱️ সময় শেষ! ${author} আপনি উত্তর দিতে বা চ্যালেঞ্জ সম্পূর্ণ করতে পারেননি।`,
                    mentions: [{ tag: `@${author}`, id: author }]
                },
                threadID
            );

            // Function to spam the taunt 5 times, alternating every 2 seconds
            for (let i = 0; i < TAUNT_COUNT; i++) {
                const tauntMessage = TAUNT_MESSAGES[i % TAUNT_MESSAGES.length];
                
                setTimeout(() => {
                    api.sendMessage(
                        {
                            body: `@${author} ${tauntMessage}`, 
                            mentions: [{ tag: `@${author}`, id: author }] 
                        },
                        threadID
                    );
                }, (i + 1) * TAUNT_DELAY); 
            }
            // --- END SPAM LOGIC ---
        }
    };
    // ----------------------------------------------

    // --- State 1: User is choosing 'Truth' or 'Dare' (state is undefined) ---
    if (!state) {
        const choice = event.body.trim().toLowerCase();

        if (!["truth", "dare"].includes(choice)) {
            return api.sendMessage("❌ অনুগ্রহ করে শুধু **'Truth'** বা **'Dare'** লিখুন।", threadID, event.messageID);
        }

        try {
            await api.unsendMessage(messageID);
        } catch (e) {
            console.log("❌ মেসেজ ডিলিট করতে ব্যর্থ:", e.message);
        }

        const filePath = choice === "truth" ? truthPath : darePath;

        if (!fs.existsSync(filePath)) {
            return api.sendMessage(`❌ '${choice}.json' ফাইল পাওয়া যায়নি।`, threadID);
        }

        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        let usedData = fs.existsSync(usedPath)
            ? JSON.parse(fs.readFileSync(usedPath, "utf-8"))
            : {};

        const usedByUser = usedData[author]?.[choice] || [];
        const unused = data.filter((_, i) => !usedByUser.includes(i));

        if (unused.length === 0) {
            return api.sendMessage(`✅ আপনি সব ${choice} শেষ করে ফেলেছেন! 🎉`, threadID);
        }

        const randomIndex = Math.floor(Math.random() * unused.length);
        const selected = unused[randomIndex];

        const heading = choice === "truth" ? "🧠 Truth" : "🎯 Dare";
        const rewardAmount = choice === "truth" ? TRUTH_REWARD : DARE_REWARD;
        
        const instruction = choice === "truth" 
            ? `👉 *৬০ সেকেন্ডের মধ্যে* এই মেসেজে রিপ্লাই দিন **আপনার উত্তর** লিখে!`
            : `👉 *৬০ সেকেন্ডের মধ্যে* এই মেসেজে রিপ্লাই দিন **'done'** লিখে!`;

        const boxText = `
╭─────────────⭓
│ ${heading}
│
│ ${selected}
╰─────────────⭓

🎁 **পুরস্কার:** **${rewardAmount} 💰**
⏰ ${instruction}
`;
        
        // Set up the next reply state for reward
        return api.sendMessage(boxText, threadID, (err, info) => {
            if (err) return console.error(err);
            
            // --- 1. SET THE AUTOMATIC TAUNT TIMER ---
            const autoTauntTimer = setTimeout(() => {
                autoTaunt(info.messageID); // Pass the new messageID
            }, REWARD_TIMEOUT);
            // ---------------------------------------
            
            global.GoatBot.onReply.set(info.messageID, {
                commandName: this.config.name,
                author: author,
                messageID: info.messageID,
                state: "awaiting_reward_claim",
                choice: choice,
                question: selected,
                rewardAmount: rewardAmount,
                timeoutHandle: autoTauntTimer // --- 2. STORE THE TIMER ID ---
            });
        });
    }

    // --- State 2: User is claiming reward (state is "awaiting_reward_claim") ---
    if (state === "awaiting_reward_claim") {
        const claimBody = event.body.trim().toLowerCase();
        const { rewardAmount, choice, question } = Reply;
        
        let rewardClaimed = false;

        if (choice === "dare") {
            if (claimBody === "done") {
                rewardClaimed = true;
            }
        } else if (choice === "truth") {
            if (claimBody.length > 0) {
                rewardClaimed = true;
            }
        }

        if (!rewardClaimed) {
            return;
        }
        
        // --- 3. CLEAR THE AUTOMATIC TAUNT TIMER ---
        clearTimeout(timeoutHandle); 

        // Remove the reply map immediately so the reward can't be claimed twice
        global.GoatBot.onReply.delete(messageID);
        
        try {
            await api.unsendMessage(messageID);
        } catch (e) {
            console.log("❌ মেসেজ ডিলিট করতে ব্যর্থ:", e.message);
        }

        // --- Update used.json (Mark the question/dare as used) ---
        let usedData = fs.existsSync(usedPath)
            ? JSON.parse(fs.readFileSync(usedPath, "utf-8"))
            : {};
            
        const filePath = choice === "truth" ? truthPath : darePath;
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const actualIndex = data.findIndex(item => item === question);

        if (actualIndex !== -1) {
            if (!usedData[author]) usedData[author] = {};
            if (!usedData[author][choice]) usedData[author][choice] = [];
            
            if (!usedData[author][choice].includes(actualIndex)) {
                usedData[author][choice].push(actualIndex);
                fs.writeFileSync(usedPath, JSON.stringify(usedData, null, 2));
            }
        }
        
        // --- Process the coin reward ---
        const balances = readBalances();
        
        if (!balances[author]) {
            balances[author] = 0;
        }

        balances[author] += rewardAmount;
        writeBalances(balances);

        const currentBalance = balances[author];

        return api.sendMessage(
            `🎉 অভিনন্দন! আপনি **${rewardAmount} 💰** জিতেছেন!\nআপনার বর্তমান ব্যালেন্স: **${currentBalance} 💰**`,
            threadID
        );
    }
  }
};
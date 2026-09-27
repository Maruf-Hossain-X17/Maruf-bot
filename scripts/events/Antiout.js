const fs = require("fs-extra");
const path = __dirname + "/../../database/data/antiout.json";

// ডেটা সেভ করার ফাংশন
function saveAntiOutData(data) {
    try {
        fs.writeJsonSync(path, data, { spaces: 2 });
    } catch (e) {
        console.error("Anti-Out: Failed to save antiout.json:", e);
    }
}

// ডেটা লোড করার ফাংশন
function loadAntiOutData() {
    try {
        if (fs.existsSync(path)) {
            return fs.readJsonSync(path);
        }
    } catch (e) {
        console.error("Anti-Out: Failed to read antiout.json:", e);
    }
    return []; // কোনো ত্রুটি হলে বা ফাইল না থাকলে খালি Array রিটার্ন করবে
}

module.exports = {
    // --- ১. কনফিগারেশন ---
    config: {
        name: "antiout",
        aliases: ["aout"],
        version: "2.0.0",
        author: "Gemini (Logic Updated)",
        description: "Anti-Out ফিচারটি চালু/বন্ধ করে, এবং স্বয়ংক্রিয়ভাবে চলে যাওয়া ইউজারদের অ্যাড করে।",
        category: "system",
        role: 1, // শুধুমাত্র গ্রুপ অ্যাডমিনরা কমান্ডটি ব্যবহার করতে পারবে
        countDown: 5,
        guide: {
            en: "{pn} on/off"
        }
    },

    // --- ২. ইভেন্ট হ্যান্ডলার (onStart) ---
    onStart: async function ({ api, event }) {
        const { threadID, logMessageData } = event;
        const leftUserID = logMessageData.leftParticipantFbId;
        
        // বটের নিজের ID বা অপ্রয়োজনীয় ইভেন্ট হলে উপেক্ষা করা 
        if (!leftUserID || leftUserID === api.getCurrentUserID()) return;

        const antiOutData = loadAntiOutData();

        // যদি এই থ্রেড ID antiOutData Array তে না থাকে, তবে কিছু করার দরকার নেই
        if (!antiOutData.includes(threadID)) return;
        
        // ব্যবহারকারীকে অ্যাড করার প্রচেষ্টা
        try {
            console.log(`[Anti-Out] Attempting to add user ${leftUserID} back to thread ${threadID}`);
            
            // API কল
            await api.addUserToGroup(leftUserID, threadID);
            
            // সফলতার মেসেজ
            api.sendMessage(
                {
                    body: "⚠️ একজন সদস্য গ্রুপ থেকে বের হয়ে গিয়েছিল, তাকে সাথে সাথে আবার যোগ (add) করা হলো।",
                    mentions: [{ tag: "ব্যবহারকারী", id: leftUserID }] 
                }, 
                threadID
            );
            
        } catch (err) {
            // সুনির্দিষ্ট ত্রুটি ব্যবস্থাপনা
            let errorMsg = "❌ কাউকে add করতে ব্যর্থ।";
            
            // 1500057 ত্রুটি কোড = User Blocked/Voluntarily Left
            if (err.error == 1500057) {
                 errorMsg += " কারণ: সম্ভবত সে নিজে left দিয়েছে বা অ্যাড হতে রাজি নয় (Block করে রেখেছে)।";
            } else {
                 errorMsg += " ত্রুটি কোড: " + err.error;
            }
            
            console.error(`[Anti-Out] Error in thread ${threadID} for user ${leftUserID}:`, err);
            api.sendMessage(errorMsg, threadID);
        }
    },

    // --- ৩. কমান্ড হ্যান্ডলার (onCall - টগল) ---
    onCall: async function ({ api, event, args }) {
        const { threadID } = event;
        const antiOutData = loadAntiOutData();
        const input = args[0] ? args[0].toLowerCase() : "";

        if (!input || (input !== "on" && input !== "off")) {
            const status = antiOutData.includes(threadID) ? "চালু আছে (ON)" : "বন্ধ আছে (OFF)";
            return api.sendMessage(`ℹ️ Anti-Out স্ট্যাটাস: ${status}\nব্যবহার করুন: ${this.config.guide.en.replace("{pn}", this.config.name)}`, threadID, event.messageID);
        }

        const threadIndex = antiOutData.indexOf(threadID);

        if (input === "on") {
            if (threadIndex !== -1) {
                return api.sendMessage("✅ Anti-Out ফিচারটি ইতিমধ্যেই এই গ্রুপে **চালু** আছে।", threadID, event.messageID);
            }
            antiOutData.push(threadID);
            saveAntiOutData(antiOutData);
            api.sendMessage("✅ Anti-Out ফিচারটি এই গ্রুপে **চালু** করা হলো। এখন থেকে কেউ গ্রুপ ছেড়ে গেলে তাকে স্বয়ংক্রিয়ভাবে অ্যাড করা হবে।", threadID, event.messageID);
        } else if (input === "off") {
            if (threadIndex === -1) {
                return api.sendMessage("❌ Anti-Out ফিচারটি ইতিমধ্যেই এই গ্রুপে **বন্ধ** আছে।", threadID, event.messageID);
            }
            antiOutData.splice(threadIndex, 1);
            saveAntiOutData(antiOutData);
            api.sendMessage("🚫 Anti-Out ফিচারটি এই গ্রুপে **বন্ধ** করা হলো। এখন থেকে কেউ গ্রুপ ছেড়ে গেলে তাকে আর স্বয়ংক্রিয়ভাবে অ্যাড করা হবে না।", threadID, event.messageID);
        }
    }
};
const axios = require('axios');

// সতর্কতা: নিরাপত্তার কারণে API কী সরাসরি কোডে বসানো উচিত নয়। 
const GEMINI_API_KEY = "AIzaSyDBRMt0NZSr41dbwXS7szb_QjHEFCNlZDs"; 

// সমস্যার সমাধানে সবচেয়ে স্থিতিশীল মডেল এবং Retry Mechanism ব্যবহার করা হয়েছে।
// যদি ঘন ঘন 'overloaded' সমস্যা হয়, তবে এটি ব্যবহার করে দেখুন:
// const GEMINI_MODEL = "gemini-pro"; 
const GEMINI_MODEL = "gemini-2.5-flash"; 

// Gemini API Endpoint
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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

// --- Helper ফাংশন: API কল এবং Retry লজিক ---
async function callGeminiAPI(contents, maxRetries = 2) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(GEMINI_API_URL, { contents });
            return response;
        } catch (e) {
            lastError = e;
            // সার্ভার ওভারলোড (500, 503) বা নির্দিষ্ট এরর মেসেজ পেলে Retry করা হবে
            const isOverload = e.response && (e.response.status === 500 || e.response.status === 503 || (e.response.data && e.response.data.error && e.response.data.error.message.includes("overloaded")));
            
            if (isOverload && attempt < maxRetries) {
                console.warn(`Attempt ${attempt} failed (Overloaded). Retrying in 2 seconds...`);
                // ২ সেকেন্ড অপেক্ষা
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            throw e; // অন্য কোনো ত্রুটি হলে বা শেষ চেষ্টা হলে ত্রুটি নিক্ষেপ
        }
    }
    throw lastError;
}
// -----------------------------------------------------------------------


// --- কনফিগারেশন ---
module.exports.config = {
    name: "ask",
    aliases: ["gemini", "ai"],
    version: "2.1.0",
    author: "Gemini",
    countDown: 5,
    role: 0,
    description: "Gemini মডেল ব্যবহার করে একটি প্রশ্ন জিজ্ঞাসা করে এবং রিপ্লাইতে চ্যাটিং চালিয়ে যেতে পারে।",
    category: "ai",
    guide: {
        en: "{pn} [your question]. Example: {pn} তোমার প্রিয় রং কী?"
    }
};

// --- onStart ফাংশন (প্রথম প্রশ্ন) ---
module.exports.onStart = async ({ api, event, args, global }) => {
    const bot = getBotInstance(global);
    if (!bot || !bot.onReply) {
        return api.sendMessage("❌ | Bot core configuration error (onReply map missing).", event.threadID, event.messageID);
    }

    const input = args.join(" ").trim();
    if (!input) {
        return api.sendMessage("❓ | প্রশ্ন করার জন্য কিছু লিখুন। উদাহরণ: {pn} তুমি কে?", event.threadID, event.messageID);
    }

    api.sendMessage("⏳ | আপনার প্রশ্নের উত্তর তৈরি হচ্ছে, অপেক্ষা করুন...", event.threadID, event.messageID);

    try {
        // নতুন ফাংশন ব্যবহার করে API কল করা
        const response = await callGeminiAPI([{ parts: [{ text: input }] }]);

        let geminiReply = "দুঃখিত, কোনো উত্তর পাওয়া যায়নি। উত্তর বা candidates সেকশন খালি ছিল।";

        // Gemini রেসপন্স থেকে টেক্সট বের করা
        if (response.data.candidates && 
            response.data.candidates.length > 0 &&
            response.data.candidates[0].content.parts &&
            response.data.candidates[0].content.parts.length > 0
        ) {
             geminiReply = response.data.candidates[0].content.parts[0].text;
        } else if (response.data.promptFeedback && response.data.promptFeedback.blockReason) {
             geminiReply = "❌ | আপনার অনুরোধটি আমার নিরাপত্তা নীতির কারণে উত্তর দেওয়া সম্ভব হয়নি।";
        }

        const questionText = `👤 আপনি: ${input}\n\n🤖 Bot বলছে:\n${geminiReply}\n\n(আপনি এই বার্তার ওপর রিপ্লাই করে চ্যাটিং চালিয়ে যেতে পারেন।)`;

        // প্রশ্নটি পাঠানো এবং উত্তর ট্র্যাক করার জন্য onReply সেট করা
        api.sendMessage(questionText, event.threadID, (error, info) => {
            if (error) {
                console.error("Ask onStart Error:", error);
                return api.sendMessage("❌ | প্রশ্নটি পাঠাতে ব্যর্থ হয়েছে।", event.threadID, event.messageID);
            }

            // onReply সেট করা
            bot.onReply.set(info.messageID, {
                commandName: this.config.name,
                type: "gemini_chat",
                messageID: info.messageID,
                author: event.senderID,
                chatHistory: [
                    { role: "user", parts: [{ text: input }] }, 
                    { role: "model", parts: [{ text: geminiReply }] }
                ]
            });

        }, event.messageID);

    } catch (e) {
        let errorMessage = "সংযোগ বা API ত্রুটি ঘটেছে।";
        if (e.response && e.response.data && e.response.data.error) {
            errorMessage = e.response.data.error.message;
        } else if (e.message) {
            errorMessage = e.message;
        }

        console.error("Gemini API Error:", e);
        
        // ওভারলোড এররের জন্য ইউজারকে পরিষ্কার মেসেজ দেওয়া
        if (errorMessage.includes("overloaded")) {
            errorMessage = `Google সার্ভার (${GEMINI_MODEL}) বর্তমানে অতিরিক্ত অনুরোধের কারণে ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।`;
        }
        
        api.sendMessage(`❌ | Gemini API এর সাথে সংযোগ ব্যর্থ হয়েছে বা ত্রুটি হয়েছে: ${errorMessage}`, event.threadID, event.messageID);
    }
};

// --- onReply ফাংশন (চ্যাট চালিয়ে যাওয়া) ---
module.exports.onReply = async ({ api, event, Reply }) => {
    const bot = getBotInstance({}); 
    if (!bot || !bot.onReply || Reply.type !== "gemini_chat" || event.senderID === api.getCurrentUserID()) return;

    const userAnswer = event.body ? event.body.trim() : "";
    if (!userAnswer) return;

    api.sendMessage("⏳ | উত্তর তৈরি হচ্ছে...", event.threadID, event.messageID);

    try {
        const updatedHistory = [...Reply.chatHistory, { role: "user", parts: [{ text: userAnswer }] }];

        // নতুন ফাংশন ব্যবহার করে API কল করা
        const response = await callGeminiAPI(updatedHistory);

        let chatResponse = "আমি বুঝতে পারিনি, আবার বলুন।";

        if (response.data.candidates && 
            response.data.candidates.length > 0 &&
            response.data.candidates[0].content.parts &&
            response.data.candidates[0].content.parts.length > 0
        ) {
            chatResponse = response.data.candidates[0].content.parts[0].text;
        }

        updatedHistory.push({ role: "model", parts: [{ text: chatResponse }] });

        const replyMessage = `📝 আপনার রিপ্লাই: ${userAnswer}\n🤖 Gemini-এর রিপ্লাই:\n${chatResponse}`;

        api.sendMessage(replyMessage, event.threadID, (error, info) => {
            if (error) return; 

            bot.onReply.set(info.messageID, {
                commandName: Reply.commandName,
                type: "gemini_chat",
                messageID: info.messageID,
                author: event.senderID,
                chatHistory: updatedHistory
            });
            bot.onReply.delete(Reply.messageID);
        }, event.messageID);

    } catch (error) {
        let errorMessage = "চ্যাটিং এর সময় API ত্রুটি ঘটেছে।";
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }

        console.error("Ask onReply Chat Error:", error);
        bot.onReply.delete(Reply.messageID); 
        
        // ওভারলোড এররের জন্য ইউজারকে পরিষ্কার মেসেজ দেওয়া
        if (errorMessage.includes("overloaded")) {
            errorMessage = `Google সার্ভার (${GEMINI_MODEL}) বর্তমানে অতিরিক্ত অনুরোধের কারণে ব্যস্ত। অনুগ্রহ করে আবার প্রশ্নটি করুন।`;
        }
        
        api.sendMessage(`❌ | চ্যাটিং এর সময় API ত্রুটি: ${errorMessage}`, event.threadID, event.messageID);
    }
};
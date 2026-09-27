
const axios = require("axios");

const languageList = {
  en: "English",
  bn: "Bengali",
  hi: "Hindi",
  ur: "Urdu",
  ar: "Arabic",
  zh: "Chinese",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
  ja: "Japanese",
  pt: "Portuguese",
  ko: "Korean",
  tr: "Turkish",
  th: "Thai",
  vi: "Vietnamese",
  pl: "Polish",
  nl: "Dutch",
  ro: "Romanian"
};

module.exports = {
  config: {
    name: "translation",
    aliases: ["tr", "translate"],
    version: "2.1",
    author: "Maruf",
    role: 0,
    shortDescription: {
      en: "Translate text or see language codes",
      bn: "অনুবাদ করুন বা ভাষার কোড দেখুন"
    },
    category: "tools",
    guide: {
      en: "/tr [lang] | [text]\n/tr langs\nReply a message and type: /tr en",
      bn: "/tr [ভাষা] | [টেক্সট]\n/tr langs\nমেসেজ reply দিয়ে: /tr en"
    }
  },

  onStart: async function ({ message, args, event }) {
    const input = args.join(" ").toLowerCase().trim();

    // ভাষার তালিকা চাইলে
    if (input === "langs" || input === "list") {
      let langText = "🌐 Available Languages:\n\n";
      for (const code in languageList) {
        langText += `🔹 ${languageList[code]}: \`${code}\`\n`;
      }
      return message.reply(langText);
    }

    let targetLang = null;
    let textToTranslate = null;

    // মেসেজ reply করে অনুবাদ
    if (event.type === "message_reply" && args[0]) {
      targetLang = args[0].toLowerCase();
      textToTranslate = event.messageReply.body;
    } 
    // | দিয়ে input
    else if (args.join(" ").includes("|")) {
      const parts = args.join(" ").split("|");
      targetLang = parts[0].trim().toLowerCase();
      textToTranslate = parts[1].trim();
    } 
    else {
      return message.reply("📌 উদাহরণ:\n/tr en | আপনি কেমন আছেন?\n/tr list\nReply দিয়ে: /tr en");
    }

    if (!targetLang || !textToTranslate) {
      return message.reply("❗ ভাষা কোড বা অনুবাদযোগ্য টেক্সট পাওয়া যায়নি।");
    }

    try {
      const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
        params: {
          client: "gtx",
          sl: "auto",
          tl: targetLang,
          dt: "t",
          q: textToTranslate
        }
      });

      const translatedText = res.data[0].map(item => item[0]).join("");
      const detectedLang = res.data[2];

      return message.reply(
        `🌐 Translate (${detectedLang} ➜ ${targetLang}):\n\n` +
        `📝 Original: ${textToTranslate}\n` +
        `✅ Translated: ${translatedText}`
      );
    } catch (err) {
      console.error("Translate error:", err);
      return message.reply("❌ অনুবাদ করতে সমস্যা হয়েছে। ভাষা কোড ঠিক আছে কি না দেখুন।");
    }
  }
};

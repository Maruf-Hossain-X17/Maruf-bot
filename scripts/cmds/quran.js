const axios = require("axios");
const fs = require("fs");
const path = require("path");

const surahMap = {
  1: ["Al-Fatiha", "ফাতিহা"],
  2: ["Al-Baqarah", "বাকারা"],
  3: ["Al-Imran", "ইমরান"],
  4: ["An-Nisa", "নার"] ,
  5: ["Al-Maidah", "মায়েদা"],
  6: ["Al-An'am", "আনআম"],
  7: ["Al-A'raf", "আরাফ"],
  8: ["Al-Anfal", "আনফাল"],
  9: ["At-Tawbah", "তাওবা"],
 10: ["Yunus", "ইউনুস"],
 11: ["Hud", "হুদ"],
 12: ["Yusuf", "ইউসুফ"],
 13: ["Ar-Ra'd", "রাদ"],
 14: ["Ibrahim", "ইব্রাহিম"],
 15: ["Al-Hijr", "হিজর"],
 16: ["An-Nahl", "নাহল"],
 17: ["Al-Isra", "ইসরা"],
 18: ["Al-Kahf", "কাহফ"],
 19: ["Maryam", "মারইয়াম"],
 20: ["Ta-Ha", "তাহা"],
 21: ["Al-Anbiya", "আম্বিয়া"],
 22: ["Al-Hajj", "হজ"] ,
 23: ["Al-Mu'minun", "মুমিনুন"],
 24: ["An-Nur", "নূর"],
 25: ["Al-Furqan", "ফুরকান"],
 26: ["Ash-Shu'ara", "শুআরা"],
 27: ["An-Naml", "নামল"],
 28: ["Al-Qasas", "কাসাস"],
 29: ["Al-Ankabut", "আনকাবুত"],
 30: ["Ar-Rum", "রূম"],
 31: ["Luqman", "লুকমান"],
 32: ["As-Sajda", "সাজদা"],
 33: ["Al-Ahzab", "আহজাব"],
 34: ["Saba", "সাবা"],
 35: ["Fatir", "ফাতির"],
 36: ["Ya-Sin", "ইয়া-সিন"],
 37: ["As-Saffat", "সাফফাত"],
 38: ["Sad", "সাদ"],
 39: ["Az-Zumar", "জুমার"],
 40: ["Ghafir", "গাফির"],
 41: ["Fussilat", "ফুসসিলাত"],
 42: ["Ash-Shura", "শূরা"],
 43: ["Az-Zukhruf", "যুখরুফ"],
 44: ["Ad-Dukhan", "দুখান"],
 45: ["Al-Jathiyah", "জাসিয়া"],
 46: ["Al-Ahqaf", "আহকাফ"],
 47: ["Muhammad", "মুহাম্মদ"],
 48: ["Al-Fath", "ফাতহ"],
 49: ["Al-Hujurat", "হুজরাত"],
 50: ["Qaf", "ক্বাফ"],
 51: ["Adh-Dhariyat", "যারিয়াত"],
 52: ["At-Tur", "তূর"],
 53: ["An-Najm", "নাজম"],
 54: ["Al-Qamar", "ক্বামার"],
 55: ["Ar-Rahman", "রহমান"],
 56: ["Al-Waqi'a", "ওয়াকিয়া"],
 57: ["Al-Hadid", "হাদিদ"],
 58: ["Al-Mujadila", "মুজাদালা"],
 59: ["Al-Hashr", "হাশর"],
 60: ["Al-Mumtahina", "মুমতাহিনা"],
 61: ["As-Saff", "সাফ"],
 62: ["Al-Jumu'a", "জুমুআ"],
 63: ["Al-Munafiqun", "মুনাফিকুন"],
 64: ["At-Taghabun", "তাগাবুন"],
 65: ["At-Talaq", "তালাক"],
 66: ["At-Tahrim", "তাহরিম"],
 67: ["Al-Mulk", "মুলক"],
 68: ["Al-Qalam", "কলম"],
 69: ["Al-Haqqah", "হাক্কা"],
 70: ["Al-Ma'arij", "মাআরিজ"],
 71: ["Nuh", "নুহ"],
 72: ["Al-Jinn", "জিন"],
 73: ["Al-Muzzammil", "মুজ্জাম্মিল"],
 74: ["Al-Muddaththir", "মুদ্দাসসির"],
 75: ["Al-Qiyamah", "ক্বিয়ামাহ"],
 76: ["Al-Insan", "ইনসান"],
 77: ["Al-Mursalat", "মুরসালাত"],
 78: ["An-Naba", "নাবা"],
 79: ["An-Nazi'at", "নাজিআত"],
 80: ["Abasa", "আবাসা"],
 81: ["At-Takwir", "তাকভীর"],
 82: ["Al-Infitar", "ইনফিতার"],
 83: ["Al-Mutaffifin", "মুতাফফিফিন"],
 84: ["Al-Inshiqaq", "ইনশিক্বাক"],
 85: ["Al-Buruj", "বুরুজ"],
 86: ["At-Tariq", "তারিক"],
 87: ["Al-A'la", "আ'লা"],
 88: ["Al-Ghashiyah", "গাশিয়াহ"],
 89: ["Al-Fajr", "ফজর"],
 90: ["Al-Balad", "বালাদ"],
 91: ["Ash-Shams", "শামস"],
 92: ["Al-Layl", "লাইল"],
 93: ["Ad-Duhaa", "দুহা"],
 94: ["Ash-Sharh", "শরহ"],
 95: ["At-Tin", "তিন"],
 96: ["Al-Alaq", "আলাক"],
 97: ["Al-Qadr", "কদর"],
 98: ["Al-Bayyina", "বাইয়্যিনাহ"],
 99: ["Az-Zalzalah", "যালযালাহ"],
100: ["Al-Adiyat", "আদিয়াত"],
101: ["Al-Qari'ah", "কারিআ"],
102: ["At-Takathur", "তাকাসুর"],
103: ["Al-Asr", "আসর"],
104: ["Al-Humazah", "হুমাযাহ"],
105: ["Al-Fil", "ফীল"],
106: ["Quraysh", "কুরাইশ"],
107: ["Al-Ma'un", "মাউন"],
108: ["Al-Kawthar", "কাওসার"],
109: ["Al-Kafirun", "কাফিরুন"],
110: ["An-Nasr", "নাসর"],
111: ["Al-Masad", "মাসাদ"],
112: ["Al-Ikhlas", "ইখলাস"],
113: ["Al-Falaq", "ফালাক"],
114: ["An-Nas", "নাস"]
};

const driveAudioIds = {
  1: "1QVxonQa7JBcBbuQQHWySwsp4wJpvDonG",
  3: "1SDLDxZybc8pUzbUfOp4d3vp43LSSjIjU",
  114: "1SAoU5DfKsdARKvRvvY4V6cZC9MFfpbwS",
  113: "1SPcvpeb75CFMfzPlfFmwP8WmH971l8ud",
  112: "1SJWM4JCwQFnHyhRJ8hiZgI_nNk0X_cL8"
};

async function getStreamFromURL(url) {
  const res = await axios({
    method: "GET",
    url,
    responseType: "stream",
    maxRedirects: 5,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  return res.data;
}

module.exports = {
  config: {
    name: "quran",
    version: "3.0",
    author: "ChatGPT",
    role: 0,
    shortDescription: "কুরআন পড়ুন, শুনুন ও বিস্তারিত তথ্য জানুন",
    category: "islam",
    guide: "{pn} 1\n{pn} 1 audio\n{pn} 1 5\n{pn} list"
  },

  onStart: async function ({ args, message, api, event }) {
    if (!args[0]) return message.reply("📖 উদাহরণ:\n/quran list\n/quran 1\n/quran 1 audio\n/quran 1 5");

    const input = args[0].toLowerCase();
    const type = args[1]?.toLowerCase();

    if (input === "list") {
      let text = "📖 সূরা তালিকা:\n";
      for (let i in surahMap) {
        text += `${i}. ${surahMap[i][0]} (${surahMap[i][1]})\n`;
      }
      return message.reply(text);
    }

    const surahNum = parseInt(input);
    if (!surahNum || !surahMap[surahNum]) return message.reply("❌ সঠিক সূরা নাম বা নম্বর দিন।");

    if (type === "audio") {
      const fileId = driveAudioIds[surahNum];
      if (!fileId) return message.reply("❌ এই সূরার অডিও নেই।");

      const url = `https://docs.google.com/uc?export=download&id=${fileId}`;
      return api.sendMessage({
        body: `🔊 সূরা ${surahMap[surahNum][0]} (${surahMap[surahNum][1]}) অডিও`,
        attachment: await getStreamFromURL(url)
      }, event.threadID, event.messageID);
    }

    const ayahNum = parseInt(type);

    try {
      const [arRes, bnRes, infoRes] = await Promise.all([
        axios.get(`https://api.alquran.cloud/v1/surah/${surahNum}/ar.alafasy`),
        axios.get(`https://api.alquran.cloud/v1/surah/${surahNum}/bn.bengali`),
        axios.get(`https://api.alquran.cloud/v1/surah/${surahNum}`)
      ]);

      const ar = arRes.data.data;
      const bn = bnRes.data.data;
      const info = infoRes.data.data;

      if (ayahNum) {
        if (ayahNum > ar.ayahs.length) return message.reply("❌ এই সূরায় এত আয়াত নেই।");
        const a = ar.ayahs[ayahNum - 1];
        const b = bn.ayahs[ayahNum - 1];
        return message.reply(`📖 সূরা ${ar.englishName} (${ar.name})

${ayahNum}. 🕋 ${a.text}
🇧🇩 ${b.text}`);
      }

      let msg = `📖 সূরা ${ar.englishName} (${ar.name})\nআয়াত সংখ্যা: ${ar.numberOfAyahs}\nনাজিল: ${info.revelationType}\n
`;
      for (let i = 0; i < ar.ayahs.length; i++) {
        msg += `${i + 1}. 🕋 ${ar.ayahs[i].text}\n🇧🇩 ${bn.ayahs[i].text}\n\n`;
        if (msg.length > 1800) {
          await message.reply(msg);
          msg = "";
        }
      }
      if (msg) return message.reply(msg);

    } catch (err) {
      console.error(err);
      return message.reply("❌ কিছু সমস্যা হয়েছে, পরে আবার চেষ্টা করুন।");
    }
  }
};
const axios = require("axios");

module.exports = {
  config: {
    name: "namaj",
    version: "1.0",
    author: "Maruf",
    role: 0, // সবাই ব্যবহার করতে পারবে
    shortDescription: "Show prayer times for a city",
    longDescription: "Get Islamic prayer times for a specific city using free API",
    category: "utility",
    guide: "{pn} [city name]"
  },

  onStart: async function({ args, message, api, event }) {
    try {
      if (!args[0]) return message.reply("⚠️ শহরের নাম দিন। উদাহরণ: /prayer Dhaka");

      const city = args.join(" ");
      const apiUrl = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=&method=2`;

      const res = await axios.get(apiUrl);
      if (!res.data || !res.data.data) return message.reply("❌ শহরের নামাজের সময় পাওয়া যায়নি।");

      const timings = res.data.data.timings;
      let msg = `🕌 ${city} - আজকের নামাজের সময়\n\n`;
      msg += `🕋 Fajr: ${timings.Fajr}\n`;
      msg += `🕛 Dhuhr: ${timings.Dhuhr}\n`;
      msg += `🕒 Asr: ${timings.Asr}\n`;
      msg += `🌇 Maghrib: ${timings.Maghrib}\n`;
      msg += `🌙 Isha: ${timings.Isha}\n`;

      return message.reply(msg);

    } catch (err) {
      console.error(err);
      return message.reply("❌ সমস্যা হয়েছে: " + err.message);
    }
  }
};

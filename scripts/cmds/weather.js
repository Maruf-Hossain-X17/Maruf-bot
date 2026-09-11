const axios = require("axios");
const moment = require("moment-timezone");
const Canvas = require("canvas");
const fs = require("fs-extra");

Canvas.registerFont(__dirname + "/assets/font/BeVietnamPro-SemiBold.ttf", {
  family: "BeVietnamPro-SemiBold",
});
Canvas.registerFont(__dirname + "/assets/font/BeVietnamPro-Regular.ttf", {
  family: "BeVietnamPro-Regular",
});

function convertFtoC(F) {
  return Math.floor((F - 32) / 1.8);
}

function formatHours(hours) {
  return moment(hours).tz("Asia/Ho_Chi_Minh").format("HH[h]mm[p]");
}

module.exports = {
  config: {
    name: "weather",
    version: "1.2",
    author: "NTKhang",
    countDown: 5,
    role: 0,
    description: "দেখাও নির্দিষ্ট জেলার আবহাওয়া",
    category: "other",
    guide: "{pn} <জেলার নাম>",
    envGlobal: {
      weatherApiKey: "d7e795ae6a0d44aaa8abb1a0a7ac19e4",
    },
  },

  langs: {
    vi: {
      syntaxError: "Vui lòng nhập địa điểm",
      notFound: "Không thể tìm thấy địa điểm: %1",
      error: "Đã xảy ra lỗi: %1",
      today:
        "Thời tiết hôm nay: %1\n%2\n🌡 Nhiệt độ thấp nhất - cao nhất %3°C - %4°C\n🌡 Nhiệt độ cảm nhận được %5°C - %6°C\n🌅 Mặt trời mọc %7\n🌄 Mặt trời lặn %8\n🌃 Mặt trăng mọc %9\n🏙️ Mặt trăng lặn %10\n🌞 Ban ngày: %11\n🌙 Ban đêm: %12",
    },
    en: {
      syntaxError: "Please enter a location",
      notFound: "Location not found: %1",
      error: "An error has occurred: %1",
      today:
        "Today's weather: %1\n%2\n🌡 Low - high temperature %3°C - %4°C\n🌡 Feels like %5°C - %6°C\n🌅 Sunrise %7\n🌄 Sunset %8\n🌃 Moonrise %9\n🏙️ Moonset %10\n🌞 Day: %11\n🌙 Night: %12",
    },
  },

  onStart: async function ({ args, message, envGlobal, getLang }) {
    const apikey = envGlobal.weatherApiKey;
    const area = args.join(" ");

    if (!area) return message.reply(getLang("syntaxError"));

    let areaKey, areaName, dataWeather;

    try {
      // শহরের তথ্য আনা
      const response = (
        await axios.get(
          `https://api.accuweather.com/locations/v1/cities/search.json?q=${encodeURIComponent(
            area
          )}&apikey=${apikey}&language=vi-vn`
        )
      ).data;

      if (response.length === 0) return message.reply(getLang("notFound", area));

      areaKey = response[0].Key;
      areaName = response[0].LocalizedName;
    } catch (error) {
      return message.reply(getLang("error", error.response?.data?.Message || error.message));
    }

    try {
      // আবহাওয়া ডাটা আনা
      dataWeather = (
        await axios.get(
          `http://api.accuweather.com/forecasts/v1/daily/10day/${areaKey}?apikey=${apikey}&details=true&language=vi`
        )
      ).data;
    } catch (error) {
      return message.reply(`❌ Đã xảy ra lỗi: ${error.response?.data?.Message || error.message}`);
    }

    // আজকের আবহাওয়া থেকে প্রাথমিক তথ্য
    const todayWeather = dataWeather.DailyForecasts[0];

    // মেসেজ টেক্সট তৈরি
    const msg = getLang(
      "today",
      areaName,
      dataWeather.Headline.Text,
      convertFtoC(todayWeather.Temperature.Minimum.Value),
      convertFtoC(todayWeather.Temperature.Maximum.Value),
      convertFtoC(todayWeather.RealFeelTemperature.Minimum.Value),
      convertFtoC(todayWeather.RealFeelTemperature.Maximum.Value),
      formatHours(todayWeather.Sun.Rise),
      formatHours(todayWeather.Sun.Set),
      formatHours(todayWeather.Moon.Rise),
      formatHours(todayWeather.Moon.Set),
      todayWeather.Day.LongPhrase,
      todayWeather.Night.LongPhrase
    );

    // ব্যাকগ্রাউন্ড ছবি লোড এবং ক্যানভাস তৈরি
    const bg = await Canvas.loadImage(__dirname + "/assets/image/bgWeather.jpg");
    const { width, height } = bg;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(bg, 0, 0, width, height);
    ctx.fillStyle = "#ffffff";

    // আগামী ৭ দিনের আবহাওয়ার তথ্য দেখানো
    let X = 100;
    const weekData = dataWeather.DailyForecasts.slice(0, 7);
    for (const day of weekData) {
      const icon = await Canvas.loadImage(
        `http://vortex.accuweather.com/adc2010/images/slate/icons/${day.Day.Icon}.svg`
      );

      ctx.drawImage(icon, X, 210, 80, 80);
      ctx.font = "30px BeVietnamPro-SemiBold";
      ctx.fillText(`${convertFtoC(day.Temperature.Maximum.Value)}°C`, X, 366);
      ctx.font = "30px BeVietnamPro-Regular";
      ctx.fillText(`${convertFtoC(day.Temperature.Minimum.Value)}°C`, X, 445);
      ctx.fillText(moment(day.Date).format("DD"), X + 20, 140);

      X += 135;
    }

    // ছবি সেভ করা
    const imgPath = `${__dirname}/tmp/weather_${areaKey}.jpg`;
    fs.writeFileSync(imgPath, canvas.toBuffer());

    // রেসপন্স হিসেবে মেসেজ ও ছবি পাঠানো
    return message.reply(
      {
        body: msg,
        attachment: fs.createReadStream(imgPath),
      },
      () => fs.unlinkSync(imgPath)
    );
  },
};
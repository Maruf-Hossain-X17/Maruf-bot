const axios = require("axios");

module.exports = {
  config: {
    name: "mix",
    version: "2.2",
    author: "NTKhang (Optimized by Bokkor & ChatGPT)",
    countDown: 5,
    role: 0,
    description: {
      en: "Mix 2 emojis together"
    },
    guide: {
      en: "{pn} <emoji1> <emoji2>\nExample: {pn} 😂 😍\nUse {pn} -r for random emoji mix."
    },
    category: "fun"
  },

  langs: {
    en: {
      error: "😔 Sorry, emoji %1 and %2 can't be mixed.",
      success: "✨ Emoji %1 and %2 mixed successfully!"
    }
  },

  onStart: async function ({ message, args, getLang }) {
    const randomEmojiList = [
      // Smiley faces & people
      "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","😘","😗","😙","😚","🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","🤓","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","😡","😠","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇",

      // Animals & Nature
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦗","🕷️","🦂","🐢","🐍","🦎","🐙","🦑","🦐","🦞","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🐘","🦏","🐪","🐫","🦒","🐃","🐂","🐄","🐎","🐖","🐐","🐏","🐑","🐕","🐩","🐈","🐓","🦃","🕊️","🐇","🐁","🐀","🐿️","🦔",

      // Food & Drink
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🌮","🌯","🥗","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🧂","🍩","🍪","🥛","🍼","☕","🍵","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍾",

      // Activities & Sports
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🥅","🏒","🏑","🥍","🏏","🪃","🥊","🥋","🥌","⛳","🪁","🏹","🎣","🤿","🥌","🎿","⛷️","🏂","🪂","🏋️‍♂️","🤼‍♂️","🤸‍♀️","⛹️‍♀️","🤺","🤾‍♂️","🏇","🧘‍♂️","🏄‍♀️","🏊‍♂️","🤽‍♂️","🚴‍♀️","🚵‍♂️","🎯","🎮","🎰",

      // Objects
      "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","🎥","🎞️","📽️","🎬","📺","📷","📸","📹","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","🛎️","🔔","🔕","📣","📢","📯","🔈","🔉","🔊","🔇","📻","🎷","🎸","🎹","🎺","🎻","🥁","📯",

      // Symbols & Flags
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","✅","☑️","✔️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🟥","🟧","🟨","🟩","🟦","🟪","🟫","🚩","🏳️","🏴","🏳️‍🌈","🏳️‍⚧️","🇺🇸","🇧🇩","🇮🇳","🇯🇵","🇬🇧","🇫🇷","🇩🇪","🇨🇳","🇰🇷","🇷🇺"
    ];

    const apiList = [
      "https://rubish.online/rubish",
      "https://noobs-api.top/dipto"
    ];

    let emoji1, emoji2;

    if (args[0] === "-r") {
      emoji1 = randomEmojiList[Math.floor(Math.random() * randomEmojiList.length)];
      emoji2 = randomEmojiList[Math.floor(Math.random() * randomEmojiList.length)];
    } else {
      emoji1 = args[0];
      emoji2 = args[1];
      if (!emoji1 || !emoji2) return message.SyntaxError();
    }

    // Try API call helper
    const tryApi = async (api) => {
      try {
        const res = await axios.get(
          `${api}/emojimix`,
          {
            params: { emoji1, emoji2, apikey: "rubish69" },
            responseType: "stream",
            timeout: 15000
          }
        );
        if (res.data) return res.data;
        throw new Error("No data received");
      } catch (error) {
        throw error;
      }
    };

    // Sequential retry with APIs
    for (const api of apiList) {
      try {
        const dataStream = await tryApi(api);
        return message.reply({
          body: getLang("success", emoji1, emoji2),
          attachment: dataStream
        });
      } catch (err) {
        console.warn(`API failed: ${api} - ${err.message}`);
      }
    }

    return message.reply(getLang("error", emoji1, emoji2));
  }
};
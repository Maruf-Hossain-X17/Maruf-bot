const axios = require("axios");
const didYouMean = require("didyoumean");

module.exports = {
  config: {
    name: "help",
    version: "13.0.0",
    author: "Maruf",
    countDown: 5,
    role: 0,
    description: {
      en: "Advanced Premium Dashboard with Uptime & Category Stats"
    },
    category: "system",
    guide: {
      en: "{pn} or {pn} <command name>"
    },
    priority: 1
  },

  onChat: async function ({ message, event, threadsData, role, globalData }) {
    const body = event.body ? event.body.toLowerCase() : "";
    if (body === "help" || body.startsWith("help ")) {
        const args = body.split(/\s+/).slice(1);
        return this.onStart({ message, args, event, threadsData, role, globalData });
    }
  },

  onStart: async function ({ message, args, event, threadsData, role, globalData }) {
    const { commands, aliases } = global.GoatBot;
    const { threadID } = event;
    const prefix = global.utils.getPrefix(threadID);

    // ১. নির্দিষ্ট কমান্ড ডিটেইলস
    if (args[0] && isNaN(args[0])) {
      const commandName = args[0].toLowerCase();
      let command = commands.get(commandName) || commands.get(aliases.get(commandName));

      if (command) {
        const { config } = command;
        let detailMsg = `╭─────────────⭓\n`;
        detailMsg += `│  🌟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 🌟\n`;
        detailMsg += `├─────────────⭔\n`;
        detailMsg += `│ 💠 𝗡𝗮𝗺𝗲: ${config.name.toUpperCase()}\n`;
        detailMsg += `│ 📂 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆: ${config.category}\n`;
        detailMsg += `│ 🛡️ 𝗥𝗼𝗹𝗲: ${config.role === 0 ? "User" : config.role === 1 ? "Admin" : "Developer"}\n`;
        detailMsg += `│ ⏳ 𝗖𝗼ｏ𝗹𝗱𝗼𝘄𝗻: ${config.countDown || 0}s\n`;
        detailMsg += `│ 📝 𝗜𝗻𝗳𝗼: ${config.description.en || config.description}\n`;
        detailMsg += `├─────────────⭔\n`;
        detailMsg += `│ 📖 𝗨𝘀𝗮𝗴𝗲 𝗚𝘂𝗶𝗱𝗲:\n`;
        detailMsg += `│ ${prefix}${config.name} ${config.guide?.en || ""}\n`;
        detailMsg += `╰─────────────⭓`;
        return message.reply(detailMsg);
      } else {
        const allCmdNames = Array.from(commands.keys());
        const suggestion = didYouMean(commandName, allCmdNames);
        let failMsg = `❌ Command "${commandName}" not found!`;
        if (suggestion) failMsg += `\n💡 Did you mean: "${suggestion}"?`;
        return message.reply(failMsg);
      }
    }

    // ২. কমান্ড লিস্ট ও ক্যাটাগরি কাউন্টার
    const categories = {};
    let totalCommands = 0;

    for (const [, cmd] of commands) {
      const cat = (cmd.config.category || "General").toUpperCase();
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd.config.name);
      totalCommands++;
    }

    const sortedCats = Object.keys(categories).sort();

    // ৩. আপটাইম ক্যালকুলেশন
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

    // ৪. মেইন ইন্টারফেস ডিজাইন
    let helpMsg = `╔══════════════════╗\n`;
    helpMsg += `   ✨ 𝖡𝖮𝖯 𝖧𝖤𝖫𝖯 𝖨𝖭𝖥𝖮 ✨\n`; // এখানে পরিবর্তন করা হয়েছে
    helpMsg += `╚══════════════════╝\n\n`;

    for (const cat of sortedCats) {
      const cmds = categories[cat].sort();
      helpMsg += `┌──『 💠 ${cat} [${cmds.length}] 』\n`; 
      for (let i = 0; i < cmds.length; i += 2) {
        const row = cmds.slice(i, i + 2).map(c => ` ◈ ${c.padEnd(12)}`).join('');
        helpMsg += `│${row}\n`;
      }
      helpMsg += `└───────────────⭔\n\n`;
    }

    helpMsg += `📊 𝗦𝘁𝗮𝘁𝘂𝘀: 🕒 Uptime: ${uptimeString}\n`;
    helpMsg += `📑 𝗧𝗼𝘁𝗮𝗹 𝗖𝗺𝗱𝘀: [ ${totalCommands} ]\n`;
    helpMsg += `💡 𝗨𝘀𝗮𝗴𝗲: ${prefix}help [command]\n`;
    helpMsg += `👑 𝗢𝘄𝗻𝗲𝗿: 𝗠𝗮𝗿𝘂𝗳`;

    // ৫. ইমেজ এবং রিঅ্যাকশন
    try {
      const imgRes = await axios.get("https://pic.re/image", { responseType: 'stream' });
      return message.reply({ body: helpMsg, attachment: imgRes.data }).then(sentMsg => {
          if (global.GoatBot.config.reaction) {
              sentMsg.react("📖");
          }
      }).catch(() => message.reply(helpMsg));
    } catch (e) {
      return message.reply(helpMsg);
    }
  }
};
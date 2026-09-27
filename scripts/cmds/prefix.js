const fs = require("fs-extra");
const { utils } = global;

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

function getTimeDhaka() {
    const now = new Date();
    return now.toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka",
        hour12: true,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function buildPrefixMessage(getLang, event) {
    const systemPrefix = global.GoatBot?.config?.prefix || "!";
    const boxPrefix = utils.getPrefix(event.threadID) || systemPrefix;

    const uptimeStr = formatUptime(process.uptime());
    const timeStr = getTimeDhaka();

    return getLang(
        "myPrefix",
        systemPrefix,
        boxPrefix,
        timeStr,
        uptimeStr,
        event.senderID
    );
}

module.exports = {
    config: {
        name: "prefix",
        version: "3.6",
        author: "Maruf",
        countDown: 5,
        role: 0,
        description: "Show or change prefix of bot",
        category: "config"
    },

    langs: {
        en: {
            myPrefix:
                "┏━━━━━━━━━━━━━━━━━━━┓\n" +
                "   🌟 𝗕𝗢𝗧 𝗣𝗥𝗘𝗙𝗜𝗫 𝗜𝗡𝗙𝗢 🌟\n" +
                "┗━━━━━━━━━━━━━━━━━━━┛\n\n" +
                "🔹 Global Prefix : %1\n" +
                "🔸 Chat Prefix   : %2\n" +
                "📘 Help Command  : help\n\n" +
                "⏰ Current Time  : %3\n" +
                "⏳ Bot Uptime    : %4\n\n" +
                "👤 Your ID       : %5\n" +
                "💻 Developer     : Maruf Hossain\n\n" +
                "┏━━━━━━━━━━━━━━━━━━━┓\n" +
                "     🚀 Enjoy Using Bot 🚀\n" +
                "┗━━━━━━━━━━━━━━━━━━━┛"
        }
    },

    onStart: async function ({ message, args, event, threadsData, getLang }) {
        if (!args[0]) {
            return message.reply(buildPrefixMessage(getLang, event));
        }

        if (args[0].toLowerCase() === "reset") {
            await threadsData.set(event.threadID, null, "data.prefix");
            return message.reply(
                `✅ Your prefix has been reset to default: ${global.GoatBot?.config?.prefix || "!"}`
            );
        }

        const newPrefix = args[0];
        await threadsData.set(event.threadID, newPrefix, "data.prefix");
        return message.reply(`✅ Changed prefix in this chat to: ${newPrefix}`);
    },

    onChat: async function ({ event, message, getLang }) {
        if (!event.body) return;
        const text = event.body.toLowerCase().trim();
        if (text === "prefix" || text === "(prefix)") {
            return message.reply(buildPrefixMessage(getLang, event));
        }
    }
};
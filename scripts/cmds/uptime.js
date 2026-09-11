const os = require("os");

const startTime = Date.now();

module.exports = {
  config: {
    name: "uptime",
    aliases: ["up", "upt"],
    author: "Maruf",
    countDown: 0,
    role: 0,
    category: "system",
    longDescription: {
      en: "Get System Information",
    },
  },

  onStart: async function ({ api, event, threadsData, usersData }) {
    try {
      // 1. Exact Event Ping Calculation
      const ping = Math.abs(Date.now() - event.timestamp);

      // 2. Uptime Calculation
      const uptimeInSeconds = (Date.now() - startTime) / 1000;
      const days = Math.floor(uptimeInSeconds / (3600 * 24));
      const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
      const secondsLeft = Math.floor(uptimeInSeconds % 60);
      const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${secondsLeft}s`;

      // 3. User & Thread Stats
      const allUsers = await usersData.getAll();
      const allThreads = await threadsData.getAll();

      // 4. Date & Time Setup
      const currentDate = new Date();
      const options = { year: "numeric", month: "numeric", day: "numeric" };
      const date = currentDate.toLocaleDateString("en-US", options);
      const time = currentDate.toLocaleTimeString("en-US", {
        timeZone: "Asia/Dhaka",
        hour12: true,
      });

      // 5. Ping Status Logic
      let pingStatus = "✅| 𝖲𝗆𝗈𝗈𝗍𝗁 𝖲𝗒𝗌𝗍𝖾𝗆";
      if (ping >= 500) {
        pingStatus = "⛔| 𝖡𝖺𝖽 𝖲𝗒𝗌𝗍𝖾𝗆";
      }

      const systemInfo = `♡   ∩_∩
 （„• ֊ •„)♡
╭─∪∪────────────⟡
│ 𝗨𝗣𝗧𝗜𝗠𝗘 𝗜𝗡𝗙𝗢
├───────────────⟡
│ ⏰ 𝗥𝗨𝗡𝗧𝗜𝗠𝗘
│  ${uptimeFormatted}
├───────────────⟡
│ ✅ 𝗢𝗧𝗛𝗘𝗥 𝗜𝗡𝗙𝗢
│𝐷𝑎𝑡𝑒: ${date}
│𝑇𝑖𝑚𝑒: ${time}
│𝑈𝑠𝑒𝑟𝑠: ${allUsers.length}
│𝑇ℎ𝑟𝑒𝑎𝑑𝑠: ${allThreads.length}
│𝑃𝑖𝑛𝑔: ${ping}𝚖𝚜
│𝑠𝑡𝑎𝑡𝑢𝑠: ${pingStatus}
╰───────────────⟡`;

      return api.sendMessage({ body: systemInfo }, event.threadID, event.messageID);
    } catch (error) {
      console.error("Error retrieving system information:", error);
      return api.sendMessage(
        "Unable to retrieve system information.",
        event.threadID,
        event.messageID
      );
    }
  },
};
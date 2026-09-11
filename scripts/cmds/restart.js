const fs = require("fs-extra");
const path = require("path");

const TMP_FILE = path.join(__dirname, "tmp", "restart.txt");

module.exports = {
	config: {
		name: "restart",
		version: "1.5",
		author: "NTKhang",
		countDown: 5,
		role: 2,
		description: { 
			vi: "Khởi động lại bot một cách nhanh chóng", 
			en: "Restart the bot quickly and efficiently" 
		},
		category: "Owner",
		guide: { 
			vi: "{pn}: Khởi động lại bot", 
			en: "{pn}: Restart the bot" 
		}
	},

	langs: {
		vi: { restarting: "🔄 | Bot đang khởi động lại, vui lòng chờ giây lát..." },
		en: { restarting: "🔄 | Restarting bot, please wait..." }
	},

	onLoad({ api }) {
		if (!fs.existsSync(TMP_FILE)) return;

		try {
			const [threadID, timestamp] = fs.readFileSync(TMP_FILE, "utf-8").split(" ");
			const downtime = ((Date.now() - Number(timestamp)) / 1000).toFixed(3);
			const restartMessage = `
✅ | 𝐁𝐨𝐭 𝐑𝐞𝐬𝐭𝐚𝐫𝐭𝐞𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲
⏰ | 𝐓𝐢𝐦𝐞: ${downtime}s
♻ | 𝐁𝐨𝐭 𝐒𝐭𝐚𝐭𝐮𝐬: 𝐀𝐜𝐭𝐢𝐯𝐞 [🟢]
			`.trim();

			api.sendMessage(restartMessage, threadID);
			fs.unlinkSync(TMP_FILE);
		} catch (error) {
			console.error("⚠️ Lỗi khi đọc file restart:", error);
		}
	},

	onStart: async function ({ message, event, getLang }) {
		try {
			await fs.ensureDir(path.dirname(TMP_FILE));
			fs.writeFileSync(TMP_FILE, `${event.threadID} ${Date.now()}`);
			await message.reply(getLang("restarting"));
		} catch (error) {
			console.error("⚠️ Lỗi khi ghi file restart:", error);
		}
		process.exit(2);
	}
};
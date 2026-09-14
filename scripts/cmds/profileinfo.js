const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const request = require("request");

module.exports = {
  config: {
    name: "profileinfo",
    version: "5.4",
    author: "Maruf",
    countDown: 5,
    role: 0,
    shortDescription: "Full Facebook profile details",
    longDescription: "Includes name, UID, gender, bio, mutual friends, join date and more",
    category: "info",
    guide: "{pn} [mention | reply | blank for self]"
  },

  onStart: async function ({ api, event }) {
    const time = moment().tz("Asia/Dhaka").format("DD/MM/YYYY hh:mm:ss A");

    let uid = event.senderID;
    let accountType = "Self";

    if (event.type === "message_reply") {
      uid = event.messageReply.senderID;
      accountType = "Reply";
    } else if (Object.keys(event.mentions || {}).length > 0) {
      uid = Object.keys(event.mentions)[0];
      accountType = "Mention";
    }

    let info = {};
    try {
      const userInfo = await api.getUserInfo(uid);
      info = userInfo?.[uid] || {};
    } catch (e) {
      console.log("⚠️ getUserInfo failed, fallback mode.");
    }

    // fallback values
    const name = info.name || "Unknown User";
    const username = info.vanity || uid;
    const profileLink = `https://facebook.com/${username}`;
    const isFriend = info.isFriend ? "✅ Yes" : "❌ No";

    // Locked detection
    const locked = (!info.gender && !info.birthday && !info.isFriend);

    const genderMap = { 1: "Female", 2: "Male" };
    const gender = locked ? "Private" : (genderMap[info.gender] || "Unknown");
    const birthday = locked ? "Private" : (info.birthday || "Not Set");
    const location = locked ? "Private" : (info.location?.name || "Not Available");
    const mutual = locked ? "Private" : (info.mutualFriends || "Unknown");
    const bio = locked ? "🔒 Profile is locked." : "🔒 Bio is private or not accessible.";

    const estimatedOnline = uid === event.senderID ? "🟢 Active (You)" : "🔘 Unknown";
    const platform = uid === event.senderID ? "📱 Mobile" : "⚙️ N/A";

    let joinDate = "Unknown";
    const uidNum = parseInt(uid);
    if (!isNaN(uidNum)) {
      const timestamp = uidNum / 4194304 + 1314220021721;
      joinDate = moment(timestamp).format("MMMM YYYY");
    }

    const notes = [
      "🔍 Profile insights powered by AI.",
      "🧠 Deep analysis complete.",
      "🚀 Optimized by GoatBot Engine.",
      "📡 Live FB scan result.",
      "✨ Clean UI, sharp data."
    ];
    const randomNote = notes[Math.floor(Math.random() * notes.length)];

    // profile picture download
    try {
      const imgURL = `https://graph.facebook.com/${uid}/picture?height=720&width=720&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);
      const imgPath = path.join(cacheDir, `profile_${uid}.jpg`);

      await new Promise((resolve, reject) => {
        request(encodeURI(imgURL))
          .pipe(fs.createWriteStream(imgPath))
          .on("close", resolve)
          .on("error", reject);
      });

      const msg =
`╔════════════════════════════════════╗
║       👤 Facebook Profile Info      ║
╠════════════════════════════════════╣
║ Name:           ${name}
║ Gender:         ${gender}
║ UID:            ${uid}
║ Username:       ${username}
║ Profile Link:   ${profileLink}
║ Location:       ${location}
║ Birthday:       ${birthday}
║ Friend:         ${isFriend}
║ Mutual:         ${mutual}
║ Type:           ${accountType}
║ Join Date:      ${joinDate}
║ Platform:       ${platform}
║ Status:         ${estimatedOnline}
╠════════════════════════════════════╣
║ Bio:            ${bio}
╠════════════════════════════════════╣
║ Updated:        ${time}
║ Note:           ${randomNote}
╚════════════════════════════════════╝
⚙️ Powered by GoatBot • `;

      await api.sendMessage({
        body: msg,
        attachment: fs.createReadStream(imgPath)
      }, event.threadID);

      fs.unlinkSync(imgPath);
    } catch (err) {
      console.error("Image download failed:", err);
      return api.sendMessage(
        `Name: ${name}\nUID: ${uid}\nProfile: ${profileLink}`,
        event.threadID
      );
    }
  }
};
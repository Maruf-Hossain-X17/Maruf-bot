const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const RAW_API_URL = "https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json";

let API_MAIN;
let API_BACKUP;
let lastApiFetch = 0;

async function loadDynamicApis() {
  const now = Date.now();
  if (now - lastApiFetch < 600000 && API_MAIN && API_BACKUP) return;
  
  try {
    const response = await axios.get(RAW_API_URL);
    let data = response.data;
    
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) {}
    }

    if (data && data.apis) {
      API_MAIN = data.apis["album-api"]?.url;
      API_BACKUP = data.apis["drive-api"]?.url;
      
      if (global.marufActiveApi !== API_MAIN && global.marufActiveApi !== API_BACKUP) {
        global.marufActiveApi = API_MAIN;
      }
      
      lastApiFetch = now;
      console.log("✅ APIs Loaded dynamically from Raw URL!");
    } else {
      console.error("❌ JSON structure is invalid in Raw URL.");
    }
  } catch (err) {
    console.error("❌ Failed to fetch APIs from GitHub Raw URL:", err.message);
  }
}

global.marufAlbumCache = global.marufAlbumCache || new Map();
global.marufPendingCache = global.marufPendingCache || new Map();
global.marufDeleteCache = global.marufDeleteCache || new Map();
global.marufUserHistory = global.marufUserHistory || new Map();
global.marufAlbumAdmins = global.marufAlbumAdmins || null;
global.marufAlbumPending = global.marufAlbumPending || null;
global.marufAlbumViews = global.marufAlbumViews || null;
global.marufActiveApi = global.marufActiveApi || null;

const albumSchema = new mongoose.Schema({
  botId: { type: String, default: "maruf_album" },
  albumAdmins: { type: Array, default: [] },
  albumPending: { type: Array, default: [] },
  viewsData: { type: Object, default: { total: 0, today: 0, date: "", cats: {} } },
  activeApi: { type: String, default: "" } 
});
const AlbumModel = mongoose.models.AlbumConfig || mongoose.model("AlbumConfig", albumSchema);

let isDbConnected = false;

async function connectDB() {
  if (mongoose.connection.readyState === 1 || isDbConnected) return;
  try {
    const configPath = path.join(process.cwd(), "config.json");
    const mainConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const mongoUri = mainConfig.database?.uriMongodb;

    if (!mongoUri) {
      console.error("❌ MongoDB URI not found in config.json!");
      return;
    }

    await mongoose.connect(mongoUri);
    isDbConnected = true;
    console.log("✅ Album Module Connected to MongoDB!");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}

async function getAlbumData() {
  await loadDynamicApis();

  if (global.marufAlbumAdmins !== null && global.marufAlbumPending !== null && global.marufAlbumViews !== null) {
    return { albumAdmins: global.marufAlbumAdmins, albumPending: global.marufAlbumPending, activeApi: global.marufActiveApi || API_MAIN };
  }

  await connectDB();
  try {
    let data = await AlbumModel.findOne({ botId: "maruf_album" });
    if (!data) {
      data = await AlbumModel.create({ botId: "maruf_album", albumAdmins: [], albumPending: [], viewsData: { total: 0, today: 0, date: "", cats: {} }, activeApi: API_MAIN });
    }
    global.marufAlbumAdmins = data.albumAdmins || [];
    global.marufAlbumPending = data.albumPending || [];
    global.marufAlbumViews = data.viewsData || { total: 0, today: 0, date: "", cats: {} };
    
    global.marufActiveApi = data.activeApi;
    if (global.marufActiveApi !== API_MAIN && global.marufActiveApi !== API_BACKUP) {
      global.marufActiveApi = API_MAIN; 
    }

    return { albumAdmins: global.marufAlbumAdmins, albumPending: global.marufAlbumPending, activeApi: global.marufActiveApi };
  } catch (err) {
    console.error("Database fetch error:", err);
    return { albumAdmins: [], albumPending: [], activeApi: API_MAIN };
  }
}

async function saveAlbumData(admins, pending, activeApi = global.marufActiveApi) {
  global.marufAlbumAdmins = admins;
  global.marufAlbumPending = pending;
  global.marufActiveApi = activeApi;

  await connectDB();
  try {
    await AlbumModel.updateOne(
      { botId: "maruf_album" },
      { $set: { albumAdmins: admins, albumPending: pending, activeApi: activeApi } },
      { upsert: true }
    );
  } catch (err) {
    console.error("Database save error:", err);
  }
}

async function updateViews(category) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  if (!global.marufAlbumViews) {
    global.marufAlbumViews = { total: 0, today: 0, date: today, cats: {} };
  }
  if (!global.marufAlbumViews.cats) {
    global.marufAlbumViews.cats = {}; 
  }

  if (global.marufAlbumViews.date !== today) {
    global.marufAlbumViews.today = 0;
    global.marufAlbumViews.date = today;
  }

  global.marufAlbumViews.total = (global.marufAlbumViews.total || 0) + 1;
  global.marufAlbumViews.today = (global.marufAlbumViews.today || 0) + 1;
  global.marufAlbumViews.cats[category] = (global.marufAlbumViews.cats[category] || 0) + 1;

  if (isDbConnected) {
    AlbumModel.updateOne(
      { botId: "maruf_album" },
      { $set: { viewsData: global.marufAlbumViews } }
    ).catch(e => console.error(e));
  }
}

function toBold(str) {
  const b = {
    a:"𝐚",b:"𝐛",c:"𝐜",d:"𝐝",e:"𝐞",f:"𝐟",g:"𝐠",h:"𝐡",i:"𝐢",j:"𝐣",k:"𝐤",l:"𝐥",m:"𝐦",n:"𝐧",o:"𝐨",p:"𝐩",q:"𝐪",r:"𝐫",s:"𝐬",t:"𝐭",u:"𝐮",v:"𝐯",w:"𝐰",x:"𝐱",y:"𝐲",z:"𝐳",
    A:"𝐀",B:"𝐁",C:"𝐂",D:"𝐃",E:"𝐄",F:"𝐅",G:"𝐆",H:"𝐇",I:"𝐈",J:"𝐉",K:"𝐊",L:"𝐋",M:"𝐌",N:"𝐍",O:"𝐎",P:"𝐏",Q:"𝐐",R:"𝐑",S:"𝐒",T:"𝐒",U:"𝐔",V:"𝐕",W:"𝐖",X:"𝐗",Y:"𝐘",Z:"𝐙",
    " ":" ","!":"!",":":":","-":"-","1":"𝟏","2":"𝟐","3":"𝟑","4":"𝟒","5":"𝟓","6":"𝟔","7":"𝟕","8":"𝟖","9":"𝟗","0":"𝟎"
  };
  return str.split('').map(char => b[char] || char).join('');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  config: {
    name: "album",
    version: "10.0", 
    role: 0,
    author: "Maruf",
    category: "media",
    guide: { 
      en: "✨ 𝐀𝐋𝐁𝐔𝐌 𝐌𝐄𝐍𝐔:\n" +
          "- !album [𝐂𝐀𝐓] (Play video)\n" +
          "- !album 𝐋𝐈𝐒𝐓 (Show all CAT)\n" +
          "- !album 𝐋𝐈𝐒𝐓 [𝐂𝐀𝐓] (Show specific CAT videos)\n" +
          "- !album 𝐒𝐓𝐀𝐓𝐒 (Overall database info)\n" +
          "- !album 𝐒𝐓𝐀𝐓𝐒 [𝐂𝐀𝐓] (Specific CAT info)\n" +
          "- !album 𝐒𝐓𝐀𝐓𝐒 1 or 2 (API 1 or API 2 detailed stats)\n" +
          "- !album 𝐀𝐃𝐃 [𝐂𝐀𝐓] (Reply to video)\n" +
          "- !album 𝐃𝐄𝐋𝐄𝐓𝐄 [𝐂𝐀𝐓] (Delete Category)\n" +
          "- !album 𝐃𝐄𝐋𝐕𝐈𝐃 [𝐂𝐀𝐓] [Video URL / Reply to Video] (Delete Single Video)\n" +
          "- !album 𝐜𝐡𝐚𝐧𝐠𝐞 𝐚𝐩𝐢 (Switch Main/Drive Backup API)\n" +
          "- !album 𝐚𝐝𝐦𝐢𝐧 [@mention/Reply]\n" +
          "- !album 𝐚𝐝𝐦𝐢𝐧 𝐫e𝐦𝐨𝐯e [@mention/Reply]\n" +
          "- !album 𝐚𝐝𝐦𝐢𝐧𝐥𝐢𝐬𝐭 (View current admins)\n\n" +
          "👑 𝐀𝐃𝐌𝐈𝐍 𝐀𝐏𝐏𝐑𝐎𝐕𝐀𝐋:\n" +
          "- !album 𝐩e𝐧𝐝𝐢𝐧𝒈 (View pending list)\n" +
          "💡 Reply to pending list with:\n" +
          "  • 'view 1' to watch the video\n" +
          "  • '1' to approve and upload\n" +
          "  • 'remove 1' to decline request."
    }
  },

  onStart: async function ({ api, event, args }) {
    await loadDynamicApis();

    if (!API_MAIN || !API_BACKUP) {
      return api.sendMessage(toBold("❌ API Source is currently unavailable! Please check your Github Raw URL connection."), event.threadID, event.messageID);
    }

    let botConfig = await getAlbumData();
    let albumAdmins = botConfig.albumAdmins || [];
    let pendingList = botConfig.albumPending || [];

    const base = global.marufActiveApi || API_MAIN; 
    const driveBase = API_BACKUP; 
    const adminUID = "100066542686904"; 

    const react = (icon) => api.setMessageReaction(icon, event.messageID, () => {}, true);
    const action = args[0]?.toLowerCase();

    const isAdmin = (event.senderID === adminUID || albumAdmins.includes(event.senderID));

    const MAX_STORAGE_MB = 15360; 
    const AVG_VIDEO_SIZE_MB = 5;

    if (action === "change" && args[1]?.toLowerCase() === "api") {
      if (!isAdmin) {
        react("🚫");
        return api.sendMessage(toBold("🚫 ONLY ADMINS CAN CHANGE THE API!"), event.threadID, event.messageID);
      }
      react("⏳");

      global.marufActiveApi = (global.marufActiveApi === API_MAIN) ? API_BACKUP : API_MAIN;
      
      global.marufAlbumCache.clear();

      await saveAlbumData(albumAdmins, pendingList, global.marufActiveApi);

      react("✅");
      const apiName = global.marufActiveApi === API_MAIN ? "MAIN API" : "DRIVE BACKUP API";
      return api.sendMessage(toBold(`🔄 API SWITCHED SUCCESSFULLY!\n\n🌐 NOW USING: ${apiName}`), event.threadID, event.messageID);
    }

    if (action === "admin") {
      const subAction = args[1]?.toLowerCase();

      if (subAction === "remove") {
        if (event.senderID !== adminUID) {
          react("🚫");
          return api.sendMessage(toBold("🚫 ONLY MARUF CAN REMOVE ALBUM ADMINS!"), event.threadID, event.messageID);
        }
        let targetUID = event.messageReply?.senderID || Object.keys(event.mentions)[0];
        if (!targetUID) {
          react("❌");
          return api.sendMessage(toBold("❌ REPLY OR MENTION SOMEONE TO REMOVE FROM ADMINS!"), event.threadID, event.messageID);
        }
        if (!albumAdmins.includes(targetUID)) {
          react("⚠️");
          return api.sendMessage(toBold("⚠️ THIS USER IS NOT AN ALBUM ADMIN!"), event.threadID, event.messageID);
        }
        react("⏳");

        albumAdmins = albumAdmins.filter(id => id !== targetUID);
        await saveAlbumData(albumAdmins, pendingList);

        react("✅");
        return api.sendMessage(toBold("🗑️ REMOVED FROM ALBUM ADMIN LIST SUCCESSFULLY!"), event.threadID, event.messageID);
      }
      else {
        if (event.senderID !== adminUID) {
          react("🚫");
          return api.sendMessage(toBold("🚫 ONLY MARUF CAN MANAGE ALBUM ADMINS!"), event.threadID, event.messageID);
        }
        let targetUID = event.messageReply?.senderID || Object.keys(event.mentions)[0];
        if (!targetUID) {
          react("❌");
          return api.sendMessage(toBold("❌ REPLY OR MENTION SOMEONE TO MAKE THEM ALBUM ADMIN!"), event.threadID, event.messageID);
        }
        if (albumAdmins.includes(targetUID)) {
          react("⚠️");
          return api.sendMessage(toBold("⚠️ THIS USER IS ALREADY AN ALBUM ADMIN!"), event.threadID, event.messageID);
        }
        react("⏳");

        albumAdmins.push(targetUID);
        await saveAlbumData(albumAdmins, pendingList);

        react("✅");
        return api.sendMessage(toBold("✅ SUCCESSFULLY ADDED AS ALBUM ADMIN!"), event.threadID, event.messageID);
      }
    }

    else if (action === "adminlist") {
      react("⏳");
      if (albumAdmins.length === 0) {
        react("✅");
        return api.sendMessage(toBold("👥 NO ALBUM ADMINS APPOINTED YET!"), event.threadID, event.messageID);
      }
      let msg = "👥 𝐀𝐋𝐁𝐔𝐌 𝐀𝐃𝐌𝐈𝐍 𝐋𝐈𝐒𝐓:\n\n";
      albumAdmins.forEach((id, i) => {
        msg += `${i + 1}. 👤 UID: ${id}\n`;
      });
      react("✅");
      return api.sendMessage(toBold(msg), event.threadID, event.messageID);
    }

    else if (action === "stats") {
      const param1 = args[1]?.toUpperCase().trim();
      react("⏳");

      const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      
      if (global.marufAlbumViews && global.marufAlbumViews.date !== todayDate) {
        global.marufAlbumViews.today = 0;
        global.marufAlbumViews.date = todayDate;
      }

      if (param1 === "1" || param1 === "2") {
        const targetApiUrl = param1 === "1" ? API_MAIN : API_BACKUP;
        const apiTitle = param1 === "1" ? "🌐 MAIN API (API 1)" : "☁️ DRIVE BACKUP API (API 2)";

        try {
          const res = await axios.get(`${targetApiUrl}/display`);
          const categories = res.data.categories || [];

          if (categories.length === 0) {
            react("✅");
            return api.sendMessage(toBold(`📊 ${apiTitle} IS CURRENTLY EMPTY!`), event.threadID, event.messageID);
          }

          let totalVideos = 0;
          let highestCat = { name: "None", count: -1 };
          let lowestCat = { name: "None", count: Infinity };
          let catDetailsMsg = "";

          categories.forEach((cat, index) => {
            totalVideos += cat.count;
            if (cat.count > highestCat.count) {
              highestCat = { name: cat.name, count: cat.count };
            }
            if (cat.count < lowestCat.count) {
              lowestCat = { name: cat.name, count: cat.count };
            }
            catDetailsMsg += `${index + 1}. 📁 ${cat.name} ➔ ${cat.count} 𝐕𝐈𝐃𝐄𝐎𝐒\n`;
          });

          let usedMB = totalVideos * AVG_VIDEO_SIZE_MB;

          let msg = `📊 𝐃𝐄𝐓𝐀𝐈𝐋𝐄𝐃 𝐒𝐓𝐀𝐓𝐒 𝐅𝐎𝐑 ${apiTitle} 📊\n\n` +
                    `📂 Total Categories: ${categories.length}\n` +
                    `🎬 Total Videos in this API: ${totalVideos}\n` +
                    `💾 Estimated Storage: ${formatBytes(usedMB * 1024 * 1024)}\n\n` +
                    `🔥 Most Videos Category: ${highestCat.name} [${highestCat.count}]\n` +
                    `📉 Least Videos Category: ${lowestCat.name} [${lowestCat.count !== Infinity ? lowestCat.count : 0}]\n\n` +
                    `📜 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐘-𝐖𝐈𝐒𝐄 𝐁𝐑𝐄𝐀𝐊𝐃𝐎𝐖𝐍:\n${catDetailsMsg}`;

          react("✅");
          return api.sendMessage(toBold(msg), event.threadID, event.messageID);
        } catch (err) {
          console.error(err);
          react("❌");
          return api.sendMessage(toBold(`❌ FAILED TO FETCH STATS FOR ${apiTitle}!`), event.threadID, event.messageID);
        }
      }

      try {
        const res = await axios.get(`${base}/display`);
        const categories = res.data.categories || [];

        if (categories.length === 0) {
          react("✅");
          return api.sendMessage(toBold("📊 ALBUM DATABASE IS CURRENTLY EMPTY!"), event.threadID, event.messageID);
        }

        if (param1) {
          const catInfo = categories.find(c => c.name.toUpperCase() === param1);
          if (!catInfo) {
            react("❌");
            return api.sendMessage(toBold(`❌ CATEGORY '${param1}' NOT FOUND!`), event.threadID, event.messageID);
          }

          let usedMB = catInfo.count * AVG_VIDEO_SIZE_MB;
          let catViews = global.marufAlbumViews?.cats?.[param1] || 0;

          let msg = `📊 𝐒𝐓𝐀𝐓𝐒 𝐅𝐎𝐑: ${param1} 📊\n\n` +
                    `🎬 Total Videos: ${catInfo.count}\n` +
                    `💾 Storage Used: ${formatBytes(usedMB * 1024 * 1024)}\n` +
                    `👀 Total Views: ${catViews}`;
          react("✅");
          return api.sendMessage(toBold(msg), event.threadID, event.messageID);
        } else {
          let totalVideos = 0;
          let largestCat = { name: "None", count: 0 };

          categories.forEach(cat => {
            totalVideos += cat.count;
            if (cat.count > largestCat.count) {
              largestCat = { name: cat.name, count: cat.count };
            }
          });

          let usedMB = totalVideos * AVG_VIDEO_SIZE_MB;
          let freeMB = MAX_STORAGE_MB - usedMB;
          if (freeMB < 0) freeMB = 0;

          const vData = global.marufAlbumViews || { total: 0, today: 0 };

          let driveStatsStr = "⚠️ Could not fetch Drive Stats";
          try {
            const driveRes = await axios.get(`${driveBase}/status`);
            const ds = driveRes.data;
            if (ds.success) {
              driveStatsStr = `- 👤 Owner: ${ds.owner || 'Maruf Hossain'}\n` +
                              `- 🛑 Used Space: ${formatBytes(ds.usage_bytes || 0)}\n` +
                              `- ✅ Free Space: ${formatBytes(ds.free_bytes || 0)}\n` +
                              `- 🗑️ Trash: ${formatBytes(ds.trash_bytes || 0)}`;
            }
          } catch (e) {
            console.error("Drive API Stats Error:", e.message);
          }

          let msg = "📊 𝐀𝐋𝐁𝐔𝐌 𝐎𝐕𝐄𝐑𝐀𝐋𝐋 𝐒𝐓𝐀𝐓𝐒 📊\n\n" +
                    `📁 Total Categories: ${categories.length}\n` +
                    `🎬 Total Uploaded Videos: ${totalVideos}\n` +
                    `🔥 Top Category: ${largestCat.name} [${largestCat.count} VIDEOS]\n\n` +
                    `☁️ 𝐌𝐀𝐈𝐍 𝐒𝐓𝐎𝐑𝐀𝐆𝐄 𝐈𝐍𝐅𝐎:\n` +
                    `- Total Limit: 15 GB\n` +
                    `- Used Space: ${formatBytes(usedMB * 1024 * 1024)}\n` +
                    `- Free Space: ${formatBytes(freeMB * 1024 * 1024)}\n\n` +
                    `🌟 𝐃𝐑𝐈𝐕𝐄 𝐀𝐏𝐈 𝐒𝐓𝐀𝐓𝐒:\n${driveStatsStr}\n\n` +
                    `📈 𝐕𝐈𝐄𝐖 𝐒𝐓𝐀𝐓𝐈𝐒𝐓𝐈𝐂𝐒:\n` +
                    `- Views Today: ${vData.today}\n` +
                    `- Total Views: ${vData.total}\n\n` +
                    `💡 TIP: Use '!album stats 1' or '!album stats 2' to check specific API stats!`;

          react("✅");
          return api.sendMessage(toBold(msg), event.threadID, event.messageID);
        }
      } catch (err) {
        console.error(err);
        react("❌");
        return api.sendMessage(toBold(`❌ STATS ERROR: ${err.message}\nURL: ${base}/display`), event.threadID, event.messageID);
      }
    }

    else if (action === "add") {
      const category = args[1]?.toUpperCase().trim();
      let videoUrl = event.messageReply?.attachments?.[0]?.url || args[2];

      if (!category || !videoUrl) {
        react("❌");
        return api.sendMessage(toBold("❌ PROVIDE CATEGORY & REPLY TO A VIDEO OR PROVIDE URL!"), event.threadID, event.messageID);
      }

      if (isAdmin) {
        react("⏳");
        try {
          const videoRes = await axios.get(videoUrl, { responseType: "arraybuffer" });
          const videoBuffer = Buffer.from(videoRes.data);

          const formMain = new FormData();
          formMain.append("category", category);
          formMain.append("video", videoBuffer, { filename: "video.mp4" });
          
          const formDrive = new FormData();
          formDrive.append("file", videoBuffer, { filename: `${category}_video.mp4` });
          
          const [mainResult, driveResult] = await Promise.allSettled([
            axios.post(`${API_MAIN}/upload`, formMain, { headers: formMain.getHeaders() }),
            axios.post(`${API_BACKUP}/upload`, formDrive, { headers: formDrive.getHeaders() })
          ]);

          if (mainResult.status === "rejected" || driveResult.status === "rejected") {
            let failMsg = "❌ 𝐔𝐏𝐋𝐎𝐀𝐃 𝐀𝐁𝐎𝐑𝐓𝐄𝐃!\n(Both APIs must successfully accept the file)\n\n📊 𝐄𝐑𝐑𝐎𝐑 𝐑𝐄𝐏𝐎𝐑𝐓:\n";
            failMsg += mainResult.status === "rejected" ? "⚠️ MAIN API: FAILED ❌\n" : "✅ MAIN API: SUCCESS\n";
            failMsg += driveResult.status === "rejected" ? "⚠️ DRIVE API: FAILED ❌" : "✅ DRIVE API: SUCCESS";

            react("❌"); 
            return api.sendMessage(toBold(failMsg), event.threadID, event.messageID); 
          }

          react("✅");
          return api.sendMessage(toBold(`✅ PERMANENTLY ADDED TO BOTH SERVERS IN: ${category}`), event.threadID, event.messageID);
        } catch (err) { 
          console.error(err);
          react("❌"); 
          return api.sendMessage(toBold("❌ VIDEO FETCH OR SYSTEM UPLOAD FAILED!"), event.threadID, event.messageID); 
        }
      } 
      else {
        react("⏳");
        const pendingID = String(Math.floor(1000 + Math.random() * 9000));
        pendingList.push({
          id: pendingID,
          senderID: event.senderID,
          category: category,
          videoUrl: videoUrl,
          threadID: event.threadID
        });

        await saveAlbumData(albumAdmins, pendingList);

        try {
          api.sendMessage(toBold(`🔔 𝐍𝐄𝐖 𝐏𝐄𝐍𝐃𝐈𝐍𝐆 𝐕𝐈𝐃𝐄𝐎 𝐀𝐋𝐄𝐑𝐓!\n\n🆔 ID: ${pendingID}\n📁 Category: ${category}\n👤 Sender UID: ${event.senderID}\n\n💡 Use '!album pending' to check and approve/decline.`), adminUID);
        } catch (e) {
          console.error("Admin Notification Error:", e);
        }

        react("✅");
        return api.sendMessage(toBold(`⏳ YOUR VIDEO HAS BEEN SENT TO PENDING LIST!\n\n🆔 PENDING ID: ${pendingID}\n📁 CATEGORY: ${category}\n\n👑 Wait for Album Admin to approve it.`), event.threadID, event.messageID);
      }
    }

    else if (action === "pending") {
      if (!isAdmin) {
        react("🚫");
        return api.sendMessage(toBold("🚫 ONLY ALBUM ADMINS CAN VIEW PENDING QUEUE!"), event.threadID, event.messageID);
      }
      react("⏳");
      if (pendingList.length === 0) {
        react("✅");
        return api.sendMessage(toBold("⏳ PENDING LIST IS CURRENTLY EMPTY!"), event.threadID, event.messageID);
      }

      let msg = "⏳ 𝐀𝐋𝐁𝐔𝐌 𝐏𝐄𝐍𝐃𝐈𝐍𝐆 𝐕𝐈𝐃𝐄𝐎𝐒\n\n";
      pendingList.forEach((item, index) => {
        msg += `${index + 1}. 📁 Cat: ${item.category} | Sender: ${item.senderID}\n\n`;
      });
      msg += `💡 𝐑𝐞𝐩𝐥𝐲 𝐰𝐢𝐭𝐡:\n- 'view 1' to watch video\n- '1' to Approve video\n- 'remove 1' to Decline request`;

      react("✅");
      return api.sendMessage(toBold(msg), event.threadID, (err, info) => {
        if (!err) {
          global.marufPendingCache.set(info.messageID, pendingList);
        }
      }, event.messageID);
    }

    else if (action === "delete") {
      if (event.senderID !== adminUID) {
        react("🚫");
        return api.sendMessage(toBold("🚫 ONLY MARUF (MAIN ADMIN) CAN DELETE CATEGORIES!"), event.threadID, event.messageID);
      }
      const category = args[1]?.toUpperCase().trim();
      if (!category) {
        react("❌");
        return api.sendMessage(toBold("❌ PROVIDE CATEGORY!"), event.threadID, event.messageID);
      }
      react("⏳");

      return api.sendMessage(toBold(`🔐 PLEASE REPLY TO THIS MESSAGE WITH THE DELETE PASSWORD TO REMOVE CATEGORY: ${category}`), event.threadID, (err, info) => {
        if (!err) {
          global.marufDeleteCache.set(info.messageID, category);
          react("✅");
        } else {
          react("❌");
        }
      }, event.messageID);
    }

    else if (action === "delvid") {
      if (!isAdmin) {
        react("🚫");
        return api.sendMessage(toBold("🚫 ONLY ALBUM ADMINS CAN DELETE SINGLE VIDEOS!"), event.threadID, event.messageID);
      }
      const category = args[1]?.toUpperCase().trim();
      const videoUrl = event.messageReply?.attachments?.[0]?.url || args[2]?.trim();

      if (!category || !videoUrl) {
        react("❌");
        return api.sendMessage(toBold("❌ PROVIDE CATEGORY AND REPLY TO THE TARGET VIDEO OR PROVIDE VIDEO URL TO DELETE!"), event.threadID, event.messageID);
      }
      react("⏳");

      try {
        await axios.delete(`${base}/delete/video`, {
          data: { category: category, videoUrl: videoUrl }
        });
        react("✅");
        return api.sendMessage(toBold(`🗑️ SUCCESSFULLY DELETED VIDEO FROM CATEGORY: ${category}`), event.threadID, event.messageID);
      } catch (err) {
        console.error(err);
        react("❌");
        return api.sendMessage(toBold("❌ FAILED TO DELETE SINGLE VIDEO! API ERROR."), event.threadID, event.messageID);
      }
    }

    else if (!action || action === "list") {
      const specificCat = args[1]?.toUpperCase().trim();
      react("⏳");

      try {
        const res = await axios.get(`${base}/display`);
        const categories = res.data.categories;
        if (!categories || categories.length === 0) {
          react("❌");
          return api.sendMessage(toBold("📂 NO CATEGORIES FOUND!"), event.threadID, event.messageID);
        }

        if (specificCat) {
          const catInfo = categories.find(c => c.name.toUpperCase() === specificCat);
          if (!catInfo) {
            react("❌");
            return api.sendMessage(toBold(`❌ CATEGORY '${specificCat}' NOT FOUND!`), event.threadID, event.messageID);
          }
          react("✅");
          return api.sendMessage(toBold(`📂 CATEGORY: ${catInfo.name}\n🎬 TOTAL VIDEOS: ${catInfo.count}`), event.threadID, event.messageID);
        } else {
          let msg = "🖤 𝐌𝐀𝐑𝐔𝐅'𝐒 𝐀𝐋𝐁𝐔𝐌 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒 🖤\n\n";
          categories.forEach((cat, i) => {
            msg += `${i + 1}. 🐥 ${cat.name} [${cat.count} 𝐕𝐈𝐃𝐄𝐎𝐒]\n`;
          });
          react("✅");
          return api.sendMessage(toBold(msg), event.threadID, event.messageID);
        }
      } catch (err) { 
        console.error(err);
        react("❌");
        return api.sendMessage(toBold(`❌ API ERROR: ${err.message}\nURL: ${base}/display\n\n💡 Please check if your Render API is online and the URL is correct.`), event.threadID, event.messageID); 
      }
    }

    else {
      const category = args[0].toUpperCase().trim();
      react("⏳");
      try {
        const res = await axios.get(`${base}/videos/${category}`);
        const vids = res.data.videos;
        if (!vids || vids.length === 0) {
          react("❌");
          return api.sendMessage(toBold(`❌ '${category}' NOT FOUND!`), event.threadID, event.messageID);
        }

        updateViews(category);

        const historyKey = `${event.senderID}_${category}`;
        let seenVideos = global.marufUserHistory.get(historyKey) || [];

        let availableVids = vids.filter(url => !seenVideos.includes(url));
        if (availableVids.length === 0) {
          availableVids = vids;
          seenVideos = []; 
        }

        const randomVideo = availableVids[Math.floor(Math.random() * availableVids.length)];
        seenVideos.push(randomVideo);
        global.marufUserHistory.set(historyKey, seenVideos);

        // --- FIX APPLIED HERE ---
        let streamUrl = randomVideo;
        if (streamUrl.includes('/view/')) {
            streamUrl = streamUrl.replace('/view/', '/drive/download/');
        }

        const stream = await global.utils.getStreamFromURL(streamUrl);

        return api.sendMessage({ 
          body: toBold(`✨ ${category} VIDEO BABE 😘\n\n💡 Reply "next" to get the next video!`), 
          attachment: stream 
        }, event.threadID, (err, info) => {
          if (!err) {
            global.marufAlbumCache.set(info.messageID, category);
            react("✅");
          } else {
            react("❌");
          }
        }, event.messageID);
      } catch (err) { 
        console.error(err);
        react("❌");
        return api.sendMessage(toBold(`❌ API ERROR: ${err.message}\nURL: ${base}/videos/${category}\n\n💡 Category might not exist or Render API is sleeping.`), event.threadID, event.messageID); 
      }
    }
  },

  onChat: async function ({ api, event }) {
    if (!event.body) return;
    
    await loadDynamicApis();

    if (!API_MAIN || !API_BACKUP) return; 

    const base = global.marufActiveApi || API_MAIN;
    const driveBase = API_BACKUP;

    if (event.body.toLowerCase().trim() === "change api") {
      let botConfig = await getAlbumData();
      let albumAdmins = botConfig.albumAdmins || [];
      const adminUID = "100066542686904";
      const isAdmin = (event.senderID === adminUID || albumAdmins.includes(event.senderID));

      if (isAdmin) {
        global.marufActiveApi = (global.marufActiveApi === API_MAIN) ? API_BACKUP : API_MAIN;
        
        global.marufAlbumCache.clear();

        await saveAlbumData(albumAdmins, botConfig.albumPending || [], global.marufActiveApi);
        api.setMessageReaction("✅", event.messageID, () => {}, true);
        const apiName = global.marufActiveApi === API_MAIN ? "MAIN API" : "DRIVE BACKUP API";
        return api.sendMessage(toBold(`🔄 API SWITCHED SUCCESSFULLY!\n\n🌐 NOW USING: ${apiName}`), event.threadID, event.messageID);
      }
    }

    if (event.messageReply && global.marufDeleteCache && global.marufDeleteCache.has(event.messageReply.messageID)) {
      const category = global.marufDeleteCache.get(event.messageReply.messageID);
      const password = event.body.trim(); 

      global.marufDeleteCache.delete(event.messageReply.messageID);

      api.setMessageReaction("⏳", event.messageID, () => {}, true);

      try {
        await axios.delete(`${base}/delete/${category}`, {
          data: { password: password } 
        });

        api.setMessageReaction("✅", event.messageID, () => {}, true);
        return api.sendMessage(toBold(`🗑️ SUCCESSFULLY DELETED CATEGORY: ${category}`), event.threadID, event.messageID);
      } catch (err) {
        console.error(err);
        api.setMessageReaction("❌", event.messageID, () => {}, true);

        if (err.response && err.response.status === 401) {
          return api.sendMessage(toBold("❌ INCORRECT PASSWORD! FAILED TO DELETE."), event.threadID, event.messageID);
        }
        return api.sendMessage(toBold("❌ FAILED TO DELETE CATEGORY! API ERROR."), event.threadID, event.messageID);
      }
    }

    if (event.messageReply && global.marufPendingCache.has(event.messageReply.messageID)) {

      let botConfig = await getAlbumData();
      let albumAdmins = botConfig.albumAdmins || [];
      let currentPending = botConfig.albumPending || [];

      const adminUID = "100066542686904";
      const isAdmin = (event.senderID === adminUID || albumAdmins.includes(event.senderID));

      if (!isAdmin) return; 

      const pendingListCache = global.marufPendingCache.get(event.messageReply.messageID);
      const input = event.body.toLowerCase().trim();

      const isRemove = input.startsWith("remove ");
      const isView = input.startsWith("view ");

      let targetIndex;
      if (isRemove) targetIndex = parseInt(input.split(" ")[1]) - 1;
      else if (isView) targetIndex = parseInt(input.split(" ")[1]) - 1;
      else targetIndex = parseInt(input) - 1;

      if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= pendingListCache.length) return;

      const targetVideo = pendingListCache[targetIndex];
      const fileIndex = currentPending.findIndex(item => item.id === targetVideo.id);

      if (fileIndex === -1) return;

      if (isView) {
        api.setMessageReaction("⏳", event.messageID, () => {}, true);
        try {
          // --- FIX APPLIED HERE ---
          let streamUrl = targetVideo.videoUrl;
          if (streamUrl.includes('/view/')) {
              streamUrl = streamUrl.replace('/view/', '/drive/download/');
          }
          const stream = await global.utils.getStreamFromURL(streamUrl);

          api.setMessageReaction("✅", event.messageID, () => {}, true);
          return api.sendMessage({
            body: toBold(`🎬 𝐏𝐄𝐍𝐃𝐈𝐍𝐆 𝐕𝐈𝐃𝐄বেদও 𝐍𝐎: ${targetIndex + 1}\n📁 Category: ${targetVideo.category}\n👤 Sender: ${targetVideo.senderID}\n\n💡 Reply to the list with '${targetIndex + 1}' to Approve or 'remove ${targetIndex + 1}' to Decline.`),
            attachment: stream
          }, event.threadID, event.messageID);
        } catch (err) {
          console.error(err);
          api.setMessageReaction("❌", event.messageID, () => {}, true);
          return api.sendMessage(toBold("❌ FAILED TO STREAM THIS VIDEO! URL MIGHT BE EXPIRED."), event.threadID, event.messageID);
        }
      }

      if (isRemove) {
        currentPending.splice(fileIndex, 1);
        await saveAlbumData(albumAdmins, currentPending);

        pendingListCache.splice(targetIndex, 1);
        global.marufPendingCache.set(event.messageReply.messageID, pendingListCache);

        api.setMessageReaction("🗑️", event.messageID, () => {}, true);
        api.sendMessage(toBold(`⚠️ DECLINED PENDING VIDEO NO. ${targetIndex + 1}!`), event.threadID, event.messageID);
        return api.sendMessage(toBold(`⚠️ YOUR PENDING VIDEO REQUEST FOR '${targetVideo.category}' WAS DECLINED BY THE ADMIN.`), targetVideo.threadID);
      } 
      else {
        api.setMessageReaction("⏳", event.messageID, () => {}, true);
        try {
          const videoRes = await axios.get(targetVideo.videoUrl, { responseType: "arraybuffer" });
          const videoBuffer = Buffer.from(videoRes.data);

          const formMain = new FormData();
          formMain.append("category", targetVideo.category);
          formMain.append("video", videoBuffer, { filename: "video.mp4" });
          
          const formDrive = new FormData();
          formDrive.append("file", videoBuffer, { filename: `${targetVideo.category}_video.mp4` });
          
          const [mainResult, driveResult] = await Promise.allSettled([
            axios.post(`${API_MAIN}/upload`, formMain, { headers: formMain.getHeaders() }),
            axios.post(`${API_BACKUP}/upload`, formDrive, { headers: formDrive.getHeaders() })
          ]);

          if (mainResult.status === "rejected" || driveResult.status === "rejected") {
            let failMsg = "❌ 𝐔𝐏𝐋𝐎𝐀𝐃 𝐀𝐁𝐎𝐑𝐓𝐄𝐃!\n(Both APIs must successfully accept the file)\n\n📊 𝐄𝐑𝐑𝐎𝐑 𝐑𝐄𝐏𝐎𝐑𝐓:\n";
            failMsg += mainResult.status === "rejected" ? "⚠️ MAIN API: FAILED ❌\n" : "✅ MAIN API: SUCCESS\n";
            failMsg += driveResult.status === "rejected" ? "⚠️ DRIVE API: FAILED ❌" : "✅ DRIVE API: SUCCESS";

            api.setMessageReaction("❌", event.messageID, () => {}, true);
            return api.sendMessage(toBold(failMsg), event.threadID, event.messageID);
          }

          currentPending.splice(fileIndex, 1);
          await saveAlbumData(albumAdmins, currentPending);

          pendingListCache.splice(targetIndex, 1);
          global.marufPendingCache.set(event.messageReply.messageID, pendingListCache);

          api.setMessageReaction("✅", event.messageID, () => {}, true);
          api.sendMessage(toBold(`✅ APPROVED & PERMANENTLY ADDED TO BOTH SERVERS IN ${targetVideo.category}!`), event.threadID, event.messageID);
          return api.sendMessage(toBold(`🎉 CONGRATS! YOUR PENDING VIDEO FOR '${targetVideo.category}' HAS BEEN APPROVED AND ADDED BY THE ADMIN!`), targetVideo.threadID);
        } catch (err) {
          console.error(err);
          api.setMessageReaction("❌", event.messageID, () => {}, true);
          return api.sendMessage(toBold("❌ VIDEO FETCH OR SYSTEM UPLOAD FAILED! URL MIGHT BE EXPIRED."), event.threadID, event.messageID);
        }
      }
    }

    if (event.messageReply && event.body.toLowerCase() === "next") {
      const cacheData = global.marufAlbumCache.get(event.messageReply.messageID);
      if (!cacheData) return;

      const category = typeof cacheData === 'string' ? cacheData : cacheData.category;

      api.setMessageReaction("⏳", event.messageID, () => {}, true);

      try {
        const res = await axios.get(`${base}/videos/${category}`);
        const vids = res.data.videos;
        if (!vids || vids.length === 0) {
          api.setMessageReaction("❌", event.messageID, () => {}, true);
          return;
        }

        const historyKey = `${event.senderID}_${category}`;
        let seenVideos = global.marufUserHistory.get(historyKey) || [];

        let availableVids = vids.filter(url => !seenVideos.includes(url));

        if (availableVids.length === 0) {
          availableVids = vids;
          seenVideos = [];
        }

        const randomVideo = availableVids[Math.floor(Math.random() * availableVids.length)];
        seenVideos.push(randomVideo);
        global.marufUserHistory.set(historyKey, seenVideos);

        updateViews(category);

        // --- FIX APPLIED HERE ---
        let streamUrl = randomVideo;
        if (streamUrl.includes('/view/')) {
            streamUrl = streamUrl.replace('/view/', '/drive/download/');
        }

        const stream = await global.utils.getStreamFromURL(streamUrl);

        return api.sendMessage({ 
          body: toBold(`✨ ${category} NEXT VIDEO BABE 😘\n\n💡 Reply "next" to get the next video!`), 
          attachment: stream 
        }, event.threadID, (err, info) => {
          if (!err) {
            global.marufAlbumCache.set(info.messageID, category);
            api.setMessageReaction("✅", event.messageID, () => {}, true);
          } else {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
          }
        }, event.messageID);
      } catch (err) {
        console.error(err);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
      }
    }
  }
};
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const cacheDir = path.join(__dirname, "cache");
const processing = new Set();

// ===============================
// CACHE DIRECTORY CLEANUP
// ===============================
if (fs.existsSync(cacheDir)) {
    try {
        fs.readdirSync(cacheDir).forEach(file => {
            try {
                fs.unlinkSync(path.join(cacheDir, file));
            } catch (e) {}
        });
    } catch (e) {
        console.error("Cache cleanup error:", e.message);
    }
} else {
    fs.mkdirSync(cacheDir, { recursive: true });
}

// ===============================
// MONGODB CONNECTION
// ===============================
async function initMongoDB() {
    if (mongoose.connection.readyState === 1) return;

    try {
        const configPath = path.join(process.cwd(), "config.json");

        if (!fs.existsSync(configPath)) {
            console.log("AutoDL: config.json not found.");
            return;
        }

        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const uri = config.uriMongodb || config.mongoURI;

        if (!uri) {
            console.log("AutoDL: MongoDB URI not found.");
            return;
        }

        await mongoose.connect(uri);
        console.log("AutoDL: MongoDB connected.");
    } catch (err) {
        console.error("MongoDB Connection Error in AutoDL:", err.message);
    }
}

// ===============================
// MONGOOSE MODEL
// ===============================
const autoDLSchema = new mongoose.Schema({
    threadID: {
        type: String,
        required: true,
        unique: true
    },
    enabled: {
        type: Boolean,
        default: false
    }
});

const AutoDL = mongoose.models.AutoDL || mongoose.model("AutoDL", autoDLSchema);

// ===============================
// MARUF API CONFIG
// ===============================
let cachedMarufApiUrl = "";
let lastMarufFetchTime = 0;

async function getMarufApiUrl() {
    const now = Date.now();

    if (!cachedMarufApiUrl || now - lastMarufFetchTime > 3600000) {
        try {
            const res = await axios.get(
                "https://raw.githubusercontent.com/Ma1ru2f3/Api-base/refs/heads/main/baseApiUrl.json",
                { timeout: 10000 }
            );

            const dynamicUrl = res.data?.apis?.autodl?.url || res.data?.apis?.main?.url;

            if (dynamicUrl) {
                cachedMarufApiUrl = dynamicUrl.replace(/\/+$/, "");
                lastMarufFetchTime = now;
            }
        } catch (err) {
            console.error("Maruf Config fetch error:", err.message);
        }
    }

    return cachedMarufApiUrl;
}

// ===============================
// URL CLEANER
// ===============================
function cleanUrl(link) {
    try {
        const u = new URL(link);
        // Common tracking query params to strip
        const paramsToStrip = ["utm_source", "utm_medium", "utm_campaign", "igsh", "si", "fbclid"];
        paramsToStrip.forEach(p => u.searchParams.delete(p));
        return u.toString();
    } catch (e) {
        return link;
    }
}

// ===============================
// API 1: MARUF PRIMARY API
// ===============================
async function fetchFromMarufApi(link) {
    try {
        const baseUrl = await getMarufApiUrl();
        if (!baseUrl) return null;

        const res = await axios.get(`${baseUrl}/alldl?url=${encodeURIComponent(link)}`, {
            timeout: 15000
        });

        const data = res.data;
        if (data?.status === "error" || data?.error) return null;

        let vUrl = data?.result?.url || data?.result || data?.data?.url || data?.data;

        if (!vUrl && Array.isArray(data?.alternate_qualities) && data.alternate_qualities.length > 0) {
            vUrl = data.alternate_qualities[0]?.url;
        }

        return vUrl || null;
    } catch (e) {
        return null;
    }
}

// ===============================
// API 2: NOOBS API
// ===============================
async function fetchFromNoobsApi(link) {
    try {
        const res = await axios.get(
            `https://noobs-api.top/dipto/alldl?url=${encodeURIComponent(link)}`,
            { timeout: 15000 }
        );

        const data = res.data;
        let vUrl = data?.result?.url || data?.result || data?.data?.url || data?.data || data?.url;

        if (!vUrl && Array.isArray(data?.alternate_qualities) && data.alternate_qualities.length > 0) {
            vUrl = data.alternate_qualities[0]?.url;
        }

        return vUrl || null;
    } catch (e) {
        return null;
    }
}

// ===============================
// API 3: COBALT ENGINE BACKUP
// ===============================
async function fetchFromCobaltApi(link) {
    try {
        const res = await axios.post(
            "https://co.wuk.sh/api/json",
            { url: link },
            {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        if (res.data && res.data.url) {
            return res.data.url;
        }
    } catch (e) {
        // Fallback Cobalt Instance
        try {
            const res2 = await axios.post(
                "https://api.cobalt.tools/api/json",
                { url: link },
                {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    timeout: 15000
                }
            );
            if (res2.data && res2.data.url) {
                return res2.data.url;
            }
        } catch (err) {}
    }
    return null;
}

// ===============================
// API 4: TIKTOK SPECIAL BACKUPS
// ===============================
async function getTikTokBackupUrl(link) {
    // TikWM
    try {
        const tikwmRes = await axios.get(
            `https://www.tikwm.com/api/?url=${encodeURIComponent(link)}&hd=1`,
            { timeout: 10000 }
        );

        if (tikwmRes.data?.data?.play) {
            let playUrl = tikwmRes.data.data.play;
            if (playUrl.startsWith("//")) playUrl = "https:" + playUrl;
            return playUrl;
        }
    } catch (e) {}

    // TiklyDown
    try {
        const tiklyRes = await axios.get(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(link)}`,
            { timeout: 10000 }
        );

        if (tiklyRes.data?.video?.noWatermark) {
            return tiklyRes.data.video.noWatermark;
        }
    } catch (e) {}

    return null;
}

// ===============================
// API 5: PUBLIC ALL-IN-ONE BACKUP
// ===============================
async function fetchFromPublicBackupApi(link) {
    try {
        const res = await axios.get(
            `https://api.joshweb.click/api/alldl?url=${encodeURIComponent(link)}`,
            { timeout: 15000 }
        );
        if (res.data?.result?.downloadUrl || res.data?.result?.url) {
            return res.data.result.downloadUrl || res.data.result.url;
        }
    } catch (e) {}
    return null;
}

// ===============================
// PLATFORM DETECTION
// ===============================
function getPlatformName(url) {
    const host = url.toLowerCase();

    if (host.includes("facebook.com") || host.includes("fb.watch") || host.includes("fb.gg")) return "FACEBOOK";
    if (host.includes("instagram.com")) return "INSTAGRAM";
    if (host.includes("tiktok.com")) return "TIKTOK";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YOUTUBE";
    if (host.includes("twitter.com") || host.includes("x.com")) return "TWITTER";
    if (host.includes("pinterest.com") || host.includes("pin.it")) return "PINTEREST";
    if (host.includes("reddit.com") || host.includes("v.redd.it")) return "REDDIT";
    if (host.includes("threads.net")) return "THREADS";
    if (host.includes("capcut.com")) return "CAPCUT";

    return "MEDIA";
}

// ===============================
// MESSAGE CREATOR (FIXED AS REQUESTED)
// ===============================
function createFinalMessage(platformName) {
    return (
`╭━━━〔 ${platformName} 〕━━━╮
🎬 Here is your video, Baby 🎀
╰━━━━━━━━━━━━━━━━━━━━╯`
    );
}

// ===============================
// MEDIA DOWNLOADER
// ===============================
async function downloadMedia(url) {
    return await axios({
        url: url,
        method: "GET",
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://www.google.com/",
            "Accept": "*/*"
        }
    });
}

// ===============================
// MODULE EXPORTS
// ===============================
module.exports = {

    config: {
        name: "autodl",
        aliases: ["alldl", "autolink"],
        version: "3.0.0",
        author: "Maruf",
        countDown: 0,
        role: 0,
        description: {
            en: "Super Smart Auto Download Video with Multi-API Fallbacks"
        },
        category: "media",
        guide: {
            en: "{pn} on\n{pn} off"
        }
    },

    // ===============================
    // COMMAND START (ON / OFF)
    // ===============================
    onStart: async function ({ api, event, args }) {
        await initMongoDB();

        const command = args[0]?.toLowerCase();

        if (command === "on") {
            await AutoDL.findOneAndUpdate(
                { threadID: event.threadID },
                { enabled: true },
                { upsert: true, new: true }
            );

            return api.sendMessage(
                "✅ AUTO DOWNLOAD ENABLED FOR THIS THREAD.",
                event.threadID,
                event.messageID
            );
        }

        if (command === "off") {
            await AutoDL.findOneAndUpdate(
                { threadID: event.threadID },
                { enabled: false },
                { upsert: true, new: true }
            );

            return api.sendMessage(
                "❌ AUTO DOWNLOAD DISABLED FOR THIS THREAD.",
                event.threadID,
                event.messageID
            );
        }

        return api.sendMessage(
            "📥 USAGE:\n\nAUTODL ON\nAUTODL OFF",
            event.threadID,
            event.messageID
        );
    },

    // ===============================
    // AUTO DOWNLOAD CHAT EVENT
    // ===============================
    onChat: async function ({ api, event }) {
        if (!event.body) return;

        await initMongoDB();

        const threadConfig = await AutoDL.findOne({ threadID: event.threadID });
        if (!threadConfig || !threadConfig.enabled) return;

        // URL Regex
        const urlRegex = /https?:\/\/[^\s<>"']+/gi;
        const matches = event.body.match(urlRegex);
        if (!matches) return;

        // Supported domains
        const supportedDomains = [
            "facebook.com", "fb.watch", "fb.gg",
            "instagram.com",
            "tiktok.com", "vt.tiktok.com", "vm.tiktok.com", "t.tiktok.com",
            "youtube.com", "youtu.be",
            "x.com", "twitter.com",
            "pinterest.com", "pin.it",
            "reddit.com", "v.redd.it",
            "threads.net", "capcut.com"
        ];

        for (let i = 0; i < matches.length; i++) {
            const rawLink = matches[i];
            const isValidLink = supportedDomains.some(domain => rawLink.toLowerCase().includes(domain));

            if (!isValidLink) continue;

            const link = cleanUrl(rawLink);
            const key = `${event.threadID}_${link}`;

            if (processing.has(key)) continue;
            processing.add(key);

            const videoPath = path.join(cacheDir, `${event.messageID}_${i}.mp4`);

            try {
                // Set loading reaction
                api.setMessageReaction("⏳", event.messageID, () => {}, true);

                let vUrl = null;

                // 1. Primary Maruf API
                vUrl = await fetchFromMarufApi(link);

                // 2. Fallback: Noobs API
                if (!vUrl) {
                    vUrl = await fetchFromNoobsApi(link);
                }

                // 3. Fallback: Cobalt Engine
                if (!vUrl) {
                    vUrl = await fetchFromCobaltApi(link);
                }

                // 4. Fallback: TikTok Special Backup
                if (!vUrl && getPlatformName(link) === "TIKTOK") {
                    vUrl = await getTikTokBackupUrl(link);
                }

                // 5. Fallback: Public Backup API
                if (!vUrl) {
                    vUrl = await fetchFromPublicBackupApi(link);
                }

                if (!vUrl) {
                    throw new Error("Could not extract downloadable video URL from any source.");
                }

                // Download File
                let videoRes = null;
                try {
                    videoRes = await downloadMedia(vUrl);
                } catch (dlErr) {
                    // Try tiktok backup download if main download failed
                    if (getPlatformName(link) === "TIKTOK") {
                        const tkBackup = await getTikTokBackupUrl(link);
                        if (tkBackup) {
                            videoRes = await downloadMedia(tkBackup);
                        }
                    }
                }

                if (!videoRes || !videoRes.data) {
                    throw new Error("Failed to download video stream.");
                }

                // Save to cache
                fs.writeFileSync(videoPath, Buffer.from(videoRes.data));

                if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size === 0) {
                    throw new Error("Downloaded file is empty.");
                }

                const sizeInMB = fs.statSync(videoPath).size / (1024 * 1024);

                // Check 45MB limit for FB Messenger
                if (sizeInMB > 45) {
                    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

                    api.setMessageReaction("❌", event.messageID, () => {}, true);

                    let shortLink = vUrl;
                    if (global.utils?.shortenURL) {
                        try { shortLink = await global.utils.shortenURL(vUrl); } catch (e) {}
                    }

                    return api.sendMessage(
                        {
                            body: `⚠️ VIDEO IS TOO LARGE (${sizeInMB.toFixed(2)} MB)\n\n📥 DIRECT DOWNLOAD LINK:\n${shortLink}`
                        },
                        event.threadID,
                        event.messageID
                    );
                }

                // Send Final Message
                const platformName = getPlatformName(link);
                const finalMessage = createFinalMessage(platformName);

                api.sendMessage(
                    {
                        body: finalMessage,
                        attachment: fs.createReadStream(videoPath)
                    },
                    event.threadID,
                    () => {
                        try {
                            if (fs.existsSync(videoPath)) {
                                fs.unlinkSync(videoPath);
                            }
                        } catch (e) {}
                    },
                    event.messageID
                );

                // Success reaction
                api.setMessageReaction("✅", event.messageID, () => {}, true);

            } catch (err) {
                console.error("AutoDL Error for URL:", link, err.message);

                try {
                    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                } catch (e) {}

                api.setMessageReaction("❌", event.messageID, () => {}, true);
            } finally {
                processing.delete(key);
            }
        }
    }
};

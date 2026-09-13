const axios = require("axios");
const fs = require("fs");
const path = require("path");

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
// MESSAGE CREATOR
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
// PROCESS VIDEO LOGIC
// ===============================
async function processAndSendVideo(api, event, link, index) {
    const key = `${event.threadID}_${link}`;
    if (processing.has(key)) return;
    processing.add(key);

    const videoPath = path.join(cacheDir, `${event.messageID}_${index}.mp4`);

    try {
        api.setMessageReaction("⏳", event.messageID, () => {}, true);

        let vUrl = null;
        vUrl = await fetchFromMarufApi(link);
        if (!vUrl) vUrl = await fetchFromNoobsApi(link);
        if (!vUrl) vUrl = await fetchFromCobaltApi(link);
        if (!vUrl && getPlatformName(link) === "TIKTOK") vUrl = await getTikTokBackupUrl(link);
        if (!vUrl) vUrl = await fetchFromPublicBackupApi(link);

        if (!vUrl) {
            throw new Error("Could not extract downloadable video URL.");
        }

        let videoRes = null;
        try {
            videoRes = await downloadMedia(vUrl);
        } catch (dlErr) {
            if (getPlatformName(link) === "TIKTOK") {
                const tkBackup = await getTikTokBackupUrl(link);
                if (tkBackup) videoRes = await downloadMedia(tkBackup);
            }
        }

        if (!videoRes || !videoRes.data) {
            throw new Error("Failed to download video stream.");
        }

        fs.writeFileSync(videoPath, Buffer.from(videoRes.data));

        if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size === 0) {
            throw new Error("Downloaded file is empty.");
        }

        const sizeInMB = fs.statSync(videoPath).size / (1024 * 1024);

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
                    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                } catch (e) {}
            },
            event.messageID
        );

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

// ===============================
// MODULE EXPORTS
// ===============================
module.exports = {

    config: {
        name: "autodl",
        aliases: ["alldl", "autolink"],
        version: "4.0.0",
        author: "Maruf",
        countDown: 0,
        role: 0,
        description: {
            en: "Always active Auto Video Downloader for supported links"
        },
        category: "media",
        guide: {
            en: "Just send any supported video link (FB, Insta, TikTok, YT, Pin, etc.)"
        }
    },

    // COMMAND TRIGGER: DIRECT LINK DOWNLOAD
    onStart: async function ({ api, event, args }) {
        if (!args[0]) {
            return api.sendMessage(
                "📥 AUTO DOWNLOADER IS ALWAYS ACTIVE!\n\nJust paste any video link from Facebook, Instagram, TikTok, YouTube, etc.",
                event.threadID,
                event.messageID
            );
        }
        await processAndSendVideo(api, event, cleanUrl(args[0]), 0);
    },

    // AUTO CHAT LISTENER (ALWAYS ACTIVE)
    onChat: async function ({ api, event }) {
        if (!event.body) return;

        const urlRegex = /https?:\/\/[^\s<>"']+/gi;
        const matches = event.body.match(urlRegex);
        if (!matches) return;

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
            await processAndSendVideo(api, event, link, i);
        }
    }
};
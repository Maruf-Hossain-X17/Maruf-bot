const admin = require("firebase-admin");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const serviceAccount = {
  "type": "service_account",
  "project_id": "maruf-hossain-86e3f",
  "private_key_id": "5d65ecb1e49678e237045c84bdafa3c6713ad0ce",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDBbgO1HkJxCH5I\nkGaieF+bUlbJxneuGHv1wD6oZTppaauUmRjDf0/msKq8aNSPa5HBbWtA5OFoNyYM\nWNYuW5nAqr3sifI3NFPyDci/IkHJkW1DVpOpoFqVu3uXZpICxBbjtCrybrM/kTV2\nH3HOnEi/AP/fjhFWE212yX+LSvWGclo6rUSH2LOkOduQ6LHX7iyEcXMDg1YHdtcU\n2RlLROle9imJ0rxnPT7xIUJgRN1yPUfMohcqSXwg1JnMxX8PZ6hbebeo79bwBb7E\n+Kfdcw3ftgcaaS+uo4UmXWDdtaj5neaZe7GSQDpP7Y+zBdE8CUg5dGkHTgYMMQJ+\nKE2JT2PBAgMBAAECggEAALPb3cngOEbMhV6GRir/551zTjFfmJGdxPZ4z60sDRIq\n4xPQ7/8EoOSFz35/TBE0qByPVQquaZmtrg7bsKRb4Ee4FcS0YyKSyzKyDD28bVnY\nQrYN3TjZeC5qw8bF5irQ0xjDlx0CFDWsFb05Phm30jYDaxyVdk7KTMf4GOZaeQGq\nXLUekH3HZQO381wl5gfidK1BoPhafoWv6sxrixK7RiKdTE818ZMu4bd5JiI/WYkU\n54GbPkmjZ+7JwsP0UItfOtaOZJSKINiBOZvtmylCEjbwjKooTgLeN3r4SP8mBUpI\ns13estUygCFWNzJqCH94zrzDPTzKKQ0lzrqBLLcWWwKBgQDs3LTXhlFim0OmQrE2\CzqhOEXsr2zVZ6fHy2MYWpiQTgHSwmy+h1JcwJvmNRebcNNDC7itVWXdBXDt3i1t\DsJlwMUfOv9TrSfQo+3QL4Ci12jrqSLest2NrpetoxN90xnBBbQQ+vs+TNPq8h81\nktVmT9z900d1b34+scJws5oHZwKBgQDRDvIYdxLFDQy0+6PXDNSyh/OE6tJbq7Ro\ncNAE1ZV/es4j+i4mcw31bLeO89ONrFQk99rjRSddkTO6uxRlmJKyuxNihrdpygdx\nWR95e5QFfpZt3MPKjpGnsfuxg3ssSrUS2zR/tdjaE1hiaK7WWfPvJU9roh6Iu43/\nlmnOvZ0KlwKBgFNyml/IGYok61t66ZYBtMEx4yi00SIKJ8ky9ZGR8Wf9o5TOHKOv\Zyv4S7R6BfwkbrmTOpgOmxmYHiYffV+LsJ9Kn+gVz/h566oM5u7OnYJBY9yKtRdC\nat3MofFxn59XrR4c1UiaM8PKK2r9rFMijP5DqrbeJbHQ+ug5lihAjkaHAoGAClNn\np8ex2KPFXecT95o9ozfN0mHa1AZOGd6Al8yI3swNBH/l6aZDKT0eb+QhLd02JsFL\nQXB3+koiuPVmk4IOtN9CnNo0kvgUmAej41c0P3U6LuD5lramARdsbB8nZU+nU/AZ\nzrkHpfXQpsOu5w14W/aGzrUqNuy0ncwrG7gH2q8CgYBWSZBD6qfnb69Sx0soS6/Q\ntVDwrbsbsBxzKK4zJ5UwX0yrkfQC/OH7HsYYz7aMGO0sRcNYsnauAflwaXUjHF8+\np4NDX1A/UaJWRsj5TtAwfFyVu1kGm6qLMCNCs31f1dRqhbkB7BSC3iBsq6uVpBVn\nQs6uj+JXb+btjTLOtTIhDg==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@maruf-hossain-86e3f.iam.gserviceaccount.com",
  "client_id": "117386895721581346633",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40maruf-hossain-86e3f.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

async function getDB() {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://maruf-hossain-86e3f-default-rtdb.firebaseio.com"
        });
    }
    return admin.database().ref("AlbumSystem");
}

module.exports = {
    config: {
        name: "album2",
        version: "18.0.0",
        author: "Maruf & Gemini",
        countDown: 5,
        role: 0,
        category: "media",
        guide: {
            en: "Usage:\n- {pn} (Show all albums)\n- {pn} add [name] (Admin only)\n- {pn} [name] (Everyone)\n- {pn} dlt [name] (Owner only)\n- {pn} stats"
        }
    },

    onStart: async function ({ api, event, args, role }) {
        const { threadID, messageID, senderID, messageReply, type } = event;
        const ownerUID = "100066542686904"; 
        const action = args[0]?.toLowerCase();

        try {
            const ref = await getDB();

            if (!action || action === "list") {
                const snapshot = await ref.once("value");
                const data = snapshot.val();
                if (!data) return api.sendMessage("📂 Gallery is empty.", threadID, messageID);

                let msg = "✨─── GALLERY ALBUMS ───✨\n\n";
                Object.keys(data).forEach((cat, i) => {
                    msg += `${i + 1}. 【${cat}】 (${Object.keys(data[cat]).length} items)\n`;
                });
                msg += "\n💡 Type: album2 [name]";
                return api.sendMessage(msg, threadID, messageID);
            }

            else if (action === "add") {
                // Sudhu Bot Admin der jonno (role 1 or higher)
                if (role < 1 && senderID !== ownerUID) {
                    return api.sendMessage("❌ Only Bot Admins can add photos.", threadID, messageID);
                }
                const category = args[1]?.toUpperCase(); 
                if (!category || type !== "message_reply") {
                    return api.sendMessage("⚠️ Reply to photos and type: album2 add [name]", threadID, messageID);
                }
                const photos = messageReply.attachments.filter(att => att.type === "photo");
                if (photos.length === 0) return api.sendMessage("❌ No photos found.", threadID, messageID);

                for (let photo of photos) {
                    await ref.child(category).push(photo.url);
                }
                return api.sendMessage(`✅ Added ${photos.length} photos to [${category}].`, threadID, messageID);
            }

            else if (action === "delete" || action === "dlt") {
                // Sudhu apnar nirdishto UID er jonno
                if (senderID !== ownerUID) {
                    return api.sendMessage("❌ Only the Bot Owner can delete albums.", threadID, messageID);
                }
                const category = args[1]?.toUpperCase();
                if (!category) return api.sendMessage("⚠️ Name the album to delete.", threadID, messageID);
                await ref.child(category).remove();
                return api.sendMessage(`🗑️ Album [${category}] deleted.`, threadID, messageID);
            }

            else if (action === "stats") {
                const snapshot = await ref.once("value");
                const data = snapshot.val() || {};
                let total = 0;
                Object.values(data).forEach(c => total += Object.keys(c).length);
                return api.sendMessage(`📊 STATS\n\n📁 Albums: ${Object.keys(data).length}\n🖼️ Total Images: ${total}`, threadID, messageID);
            }

            else {
                const category = args[0]?.toUpperCase();
                const snapshot = await ref.child(category).once("value");
                const data = snapshot.val();

                if (!data) return api.sendMessage(`❌ Album [${category}] not found.`, threadID, messageID);

                const urls = Object.values(data);
                const randomUrl = urls[Math.floor(Math.random() * urls.length)];
                
                const cacheDir = path.join(__dirname, "cache");
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
                const tempPath = path.join(cacheDir, `img_${Date.now()}.jpg`);

                const res = await axios.get(randomUrl, { responseType: "arraybuffer" });
                fs.writeFileSync(tempPath, Buffer.from(res.data, "binary"));
                
                return api.sendMessage({
                    body: `✨ Album: ${category} (${urls.length} items)`,
                    attachment: fs.createReadStream(tempPath)
                }, threadID, () => { if(fs.existsSync(tempPath)) fs.unlinkSync(tempPath); }, messageID);
            }
        } catch (err) {
            return api.sendMessage("❌ Error: " + err.message, threadID, messageID);
        }
    }
};
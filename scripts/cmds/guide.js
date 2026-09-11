const axios = require('axios');
const upscaleApi = "https://www.noobs-apis.run.place/nazrul/upscale";

module.exports = {
    config: {
        name: "guide",
        version: "4.0.0",
        author: "Gemini",
        countDown: 10,
        role: 0,
        description: "Images Upscale (4K) করে ডাটাবেসে সেভ করুন",
        category: "utility",
        guide: "{pn} Subject | Chapter (ইমেজে রিপ্লাই দিন)"
    },

    onStart: async function ({ api, event, args }) {
        const { threadID, messageID, messageReply, type } = event;
        const dbURL = "https://bot-1491d-default-rtdb.firebaseio.com/guides";

        try {
            // --- লিস্ট এবং ডিলিট অপশন ---
            if (args[0] === "list") {
                const { data } = await axios.get(`${dbURL}.json`);
                if (!data) return api.sendMessage("📭 ডাটাবেস খালি!", threadID);
                let msg = "📚 -- HSC GUIDE LIST -- 📚\n\n";
                for (let id in data) {
                    const chaps = data[id].chapters || {};
                    msg += `📁 SUBJECT: ${data[id].name.toUpperCase()}\n📖 Chapters: ${Object.keys(chaps).length}\n------------------------\n`;
                }
                return api.sendMessage(msg, threadID);
            }

            if (args[0] === "delete") {
                const input = args.slice(1).join(" ");
                if (!input.includes("|")) return api.sendMessage("⚠️ Format: delete Subject | Chapter", threadID);
                const [subDel, chapDel] = input.split("|").map(item => item.trim().toUpperCase());
                const { data } = await axios.get(`${dbURL}.json`);
                let found = false;
                if (data) {
                    for (let sId in data) {
                        if (data[sId].name.toUpperCase() === subDel) {
                            const chaps = data[sId].chapters || {};
                            for (let cId in chaps) {
                                if (chaps[cId].name.toUpperCase() === chapDel) {
                                    await axios.delete(`${dbURL}/${sId}/chapters/${cId}.json`);
                                    found = true;
                                }
                            }
                        }
                    }
                }
                return api.sendMessage(found ? `✅ ${subDel} থেকে ${chapDel} ডিলিট হয়েছে!` : "❌ পাওয়া যায়নি!", threadID);
            }

            // --- ইমেজ আপলোড + 4K Upscale ---
            if (type === "message_reply" && messageReply.attachments) {
                const photos = messageReply.attachments.filter(att => att.type === "photo");
                if (photos.length === 0) return api.sendMessage("❌ ইমেজে রিপ্লাই দিন!", threadID);

                const input = args.join(" ");
                if (!input.includes("|")) return api.sendMessage("⚠️ Format: Subject | Chapter", threadID);

                const [subName, chapName] = input.split("|").map(item => item.trim().toUpperCase());
                
                const waitMsg = await api.sendMessage(`⌛ ${photos.length}টি ছবি 4K Upscale করে সেভ করা হচ্ছে... (কিছুক্ষণ সময় লাগতে পারে)`, threadID);

                // সাবজেক্ট চেক বা তৈরি
                const { data: allData } = await axios.get(`${dbURL}.json`);
                let subId = null;
                if (allData) {
                    for (let id in allData) {
                        if (allData[id].name.toUpperCase() === subName) { subId = id; break; }
                    }
                }
                if (!subId) {
                    const res = await axios.post(`${dbURL}.json`, { name: subName });
                    subId = res.data.name;
                }

                let imagesArray = [];
                for (let i = 0; i < photos.length; i++) {
                    try {
                        // ১. প্রথমে ইমেজটি Upscale করা
                        const upscaleRes = await axios.get(`${upscaleApi}?imgUrl=${encodeURIComponent(photos[i].url)}`, { responseType: "arraybuffer" });
                        
                        // ২. Upscaled ইমেজকে Base64 এ কনভার্ট করা
                        const base64 = Buffer.from(upscaleRes.data, 'binary').toString('base64');
                        imagesArray.push(`data:image/jpeg;base64,${base64}`);
                    } catch (e) {
                        console.log(`Upscale failed for image ${i+1}, original saving...`);
                        // যদি Upscale ফেল করে, অরিজিনালটাই সেভ হবে
                        const originalRes = await axios.get(photos[i].url, { responseType: 'arraybuffer' });
                        const base64 = Buffer.from(originalRes.data, 'binary').toString('base64');
                        imagesArray.push(`data:image/jpeg;base64,${base64}`);
                    }
                }

                // ডাটাবেসে সেভ
                await axios.post(`${dbURL}/${subId}/chapters.json`, {
                    name: chapName,
                    images: imagesArray,
                    count: photos.length,
                    timestamp: Date.now()
                });

                api.unsendMessage(waitMsg.messageID);
                return api.sendMessage(`✅ ৪কে কোয়ালিটিতে সেভ হয়েছে!\n📚 বিষয়: ${subName}\n📖 চ্যাপ্টার: ${chapName}\n🖼 মোট ছবি: ${photos.length}`, threadID);
            }

        } catch (error) {
            api.sendMessage(`❌ এরর: ${error.message}`, threadID);
        }
    }
};
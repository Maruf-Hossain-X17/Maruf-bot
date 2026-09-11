const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { uploadToImgur } = require("imgur-link");

module.exports.config = {
    name: "imgur",
    version: "1.1",
    author: "ST | Sheikh Tamim",
    countDown: 5,
    role: 0,
    category: "Image Url",
    description: "Upload an image to Imgur and get the link",
    usages: "Reply to an image and use /imgur"
};

module.exports.onStart = async function ({ api, event }) {
    const attachment = event.messageReply?.attachments?.[0]?.url;

    if (!attachment) {
        return api.sendMessage("⚠️ Please reply to an image to upload it to Imgur.", event.threadID, event.messageID);
    }

    const filePath = path.join(__dirname, "temp.jpg");

    try {
        // Download the image
        const response = await axios({
            url: attachment,
            responseType: "stream"
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Upload to Imgur
        const imgurUrl = await uploadToImgur(filePath);

        // Delete the local file after upload
        fs.unlinkSync(filePath);

        api.sendMessage(imgurUrl, event.threadID, event.messageID);
    } catch (error) {
        console.error("Imgur Upload Error:", error);
        api.sendMessage("❌ Failed to upload the image. Please try again later.", event.threadID, event.messageID);
    }
};
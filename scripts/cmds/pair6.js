const axios = require("axios");

const baseApiUrl = async () => {
  const base = await axios.get(
    "https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json"
  );
  return base.data.mahmud;
};

module.exports.config = {
  name: "pair6",
  version: "1.0.0",
  role: 0,
  author: "Bokkor",
  description: "Random Pair Match",
  category: "LOVE",
  guide: "",
  countDown: 10
};

module.exports.onStart = async function ({
  api,
  event,
  threadsData,
  usersData,
  message
}) {
  try {
    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    const uid1 = event.senderID;

    const threadData = await threadsData.get(event.threadID);
    const senderInfo = threadData.members.find(
      m => m.userID == uid1
    );

    const gender = senderInfo?.gender;

    if (!gender) {
      return message.reply("Your gender is not set.");
    }

    const targetGender =
      gender === "MALE"
        ? "FEMALE"
        : "MALE";

    const candidates = threadData.members.filter(
      m =>
        m.gender === targetGender &&
        m.userID != uid1 &&
        m.inGroup
    );

    if (!candidates.length) {
      return message.reply("No match found.");
    }

    const match =
      candidates[Math.floor(Math.random() * candidates.length)];

    const uid2 = match.userID;

    const name1 = await usersData.getName(uid1);
    const name2 = await usersData.getName(uid2);

    const love =
      Math.floor(Math.random() * 36) + 65;

    const baseUrl = await baseApiUrl();

    const pfp1 = `${baseUrl}/api/pfp?mahmud=${uid1}`;
    const pfp2 = `${baseUrl}/api/pfp?mahmud=${uid2}`;

    api.setMessageReaction("✅", event.messageID, () => {}, true);

    await message.reply({
      body: `💞 Successful Pairing

• ${name1}
• ${name2}

Love Percentage: ${love}%`,
      attachment: [
        await global.utils.getStreamFromURL(pfp1),
        await global.utils.getStreamFromURL(pfp2)
      ]
    });

  } catch (error) {
    console.log(error);

    api.setMessageReaction("❌", event.messageID, () => {}, true);

    message.reply(
      `❌ Error: ${error.message}`
    );
  }
};
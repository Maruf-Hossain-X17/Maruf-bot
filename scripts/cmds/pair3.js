const { getStreamFromURL } = global.utils;
module.exports = {
  config: {
    name: "pair3",
    version: "1.0",
    author: "Rulex-al LOUFI",
    shortDescription: {
      en: "pair Girls 😗",
      vi: ""
    },
    category: "LOVE",
    guide: "{prefix}random-female"
  },

  onStart: async function({ event, threadsData, message, usersData }) {
    const uidI = event.senderID;
    const avatarUrl1 = await usersData.getAvatarUrl(uidI);
    const name1 = await usersData.getName(uidI);
    const threadData = await threadsData.get(event.threadID);
    const members = threadData.members.filter(member => member.gender === "FEMALE" && member.inGroup);

    
    const randomIndex = Math.floor(Math.random() * members.length);
    const randomMember = members[randomIndex];
    const name2 = await usersData.getName(`${randomMember.userID}`);
    const avatarUrl2 = await usersData.getAvatarUrl(`${randomMember.userID}`);
    const randomNumber1 = Math.floor(Math.random() * 36) + 65;
    const randomNumber2 = Math.floor(Math.random() * 36) + 65;
    if (!randomMember) return message.reply('mention han');

    message.reply({body:`•Everyone congratulates the new husband and wife:
    ❤️${name1}💕${name2}❤️
Love percentage: "${randomNumber1} % 🤭"
Compatibility ratio: "${randomNumber2} % 💕"

Congratulations 🥳`, attachment: [
				await getStreamFromURL(`${avatarUrl1}`),
				await getStreamFromURL(`${avatarUrl2}`)
			]})
  }
};
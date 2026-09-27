📚 Maruf Bot V2 — Developer Documentation

<p align="center">
  <img src="https://files.catbox.moe/esqncp.jpg" alt="Maruf Bot Developer Documentation Banner" width="100%">
</p><h1 align="center">🤖 Maruf Bot V2 — Developer Documentation</h1><p align="center">
  <strong>Build • Customize • Learn • Innovate</strong>
  <br>
  A customized Facebook Messenger chatbot project powered by GoatBot technology.
</p><p align="center">
  <a href="https://web.maruf-x-hub.page.gd">🌐 Official Website</a> •
  <a href="https://github.com/maruf127679-pixel/Maruf-bot">📦 Bot Repository</a> •
  <a href="https://github.com/maruf127679-pixel/Maruf-bot/issues">💬 Support</a>
</p><p align="center">
  <img src="https://img.shields.io/badge/Node.js-18.x--22.x-brightgreen?style=for-the-badge&logo=node.js" alt="Node.js support">
  <img src="https://img.shields.io/badge/Documentation-Maruf%20Bot-blue?style=for-the-badge" alt="Maruf Bot documentation">
  <img src="https://img.shields.io/github/license/maruf127679-pixel/Maruf-bot?style=for-the-badge" alt="License">
</p>---

📖 About This Documentation

Welcome to the official Maruf Bot V2 Developer Documentation.

This guide explains the project structure, command development, event handlers, database operations, utility functions, configuration, troubleshooting, and security practices.

It is intended for developers who want to learn JavaScript, customize commands, and understand the architecture of the Maruf Bot project.

«Project: Maruf Bot V2
Maintainer: Maruf Hossain
Brand: MARUF-X-HUB
Original project: Goat Bot V2 by NTKhang03
Original license: MIT, subject to the actual upstream license and notices.»

Important Attribution

This project is based on the GoatBot ecosystem. The original author's name, copyright notices, license, and applicable attribution must remain intact.

- Original author: "NTKhang03" (https://github.com/ntkhang03)
- Original source: "Goat-Bot-V2" (https://github.com/ntkhang03/Goat-Bot-V2)
- Customized project: "Maruf Bot" (https://github.com/maruf127679-pixel/Maruf-bot)

---

📑 Table of Contents

- "📖 About This Documentation" (#-about-this-documentation)
- "🧠 Preparation" (#-preparation)
- "🛠️ Built-in Functions" (#️-built-in-functions)
- "⚠️ Important Usage Note" (#️-important-usage-note)
- "💾 Database" (#-database)
- "📦 Create a New Command" (#-create-a-new-command)
- "🎯 Command Configuration" (#-command-configuration)
- "📡 Event Handlers" (#-event-handlers)
- "📁 Folder Structure" (#-folder-structure)
- "🎁 Reference Files" (#-reference-files)
- "📞 Common Errors" (#-common-errors)
- "💡 Best Practices" (#-best-practices)
- "🔐 Security Guidelines" (#-security-guidelines)
- "🌐 Official Links" (#-official-links)
- "✨ Credits and License" (#-credits-and-license)

---

🧠 Preparation

Requirements

Before developing Maruf Bot, you should have:

- Node.js compatible with the current "package.json".
- npm.
- A code editor such as VS Code, Sublime Text, or another JavaScript editor.
- Basic JavaScript knowledge.
- Basic Node.js knowledge.
- Understanding of asynchronous programming.
- Familiarity with the project's API and documentation.

Recommended Learning Resources

Resource| Link
JavaScript — MDN| https://developer.mozilla.org/en-US/docs/Web/JavaScript
JavaScript — W3Schools| https://www.w3schools.com/js/
Node.js Documentation| https://nodejs.org/en/docs/
Node.js Downloads| https://nodejs.org/en/download/
Original GoatBot Project| https://github.com/ntkhang03/Goat-Bot-V2
Facebook Chat API Documentation| https://github.com/ntkhang03/fb-chat-api/blob/master/DOCS.md

---

🛠️ Built-in Functions

The project exposes utility functions through the "global.utils" object.

«The exact functions available depend on the current version of the project. Always check the actual "utils.js" file before using a function.»

Utility Reference

Function| Description| Example
"utils.getTime(format)"| Formats date and time| "utils.getTime("DD/MM/YYYY HH:mm")"
"utils.convertTime(ms)"| Converts milliseconds to readable time| "utils.convertTime(5400000)"
"utils.randomString(n)"| Generates a random string| "utils.randomString(10)"
"utils.randomNumber(min, max)"| Generates a random number| "utils.randomNumber(1, 100)"
"utils.getExtFromMimeType(mime)"| Gets extension from MIME type| "utils.getExtFromMimeType("image/png")"
"utils.getExtFromUrl(url)"| Gets file extension from URL| "utils.getExtFromUrl("https://example.com/a.png")"
"utils.jsonStringifyColor(obj)"| Formats JSON for colored console output| "utils.jsonStringifyColor({ a: 1 })"
"utils.translate(text, lang)"| Translates text using the project's translation system| "utils.translate("Hello", "bn")"
"utils.translateAPI(text, lang)"| Uses a translation API, if configured| "await utils.translateAPI("Hello", "bn")"
"utils.findUid(fbLink)"| Resolves a Facebook link to a user ID, if supported| "await utils.findUid("https://facebook.com/...")"
"utils.getStreamFromURL(url)"| Creates a readable stream from a URL| "await utils.getStreamFromURL(url)"
"utils.getStreamsFromAttachment(atts)"| Gets streams from attachments| "await utils.getStreamsFromAttachment(atts)"
"utils.downloadFile(url, path)"| Downloads a file| "await utils.downloadFile(url, "./tmp/file.png")"
"utils.uploadImgbb(stream)"| Uploads an image, if configured| "await utils.uploadImgbb(stream)"
"utils.shortenURL(url)"| Shortens a URL, if supported| "await utils.shortenURL(url)"
"utils.getType(obj)"| Returns the object type| "utils.getType([])"
"utils.isNumber(value)"| Checks whether a value is numeric| "utils.isNumber("5")"
"utils.removeHomeDir(path)"| Removes the home directory prefix| "utils.removeHomeDir(__dirname)"
"utils.splitPage(arr, n)"| Splits an array into pages| "utils.splitPage([1,2,3,4], 2)"

Google Drive Utilities

If Google Drive integration is installed and configured, the project may expose functions similar to:

await utils.drive.uploadFile(name, mime, file);
await utils.drive.getFile(fileId);
await utils.drive.deleteFile(fileId);
utils.drive.getUrlDownload(fileId);

Check the actual implementation and configuration before using these functions.

Full Utility Source

👉 "View utils.js in the original project" (https://github.com/ntkhang03/Goat-Bot-V2/blob/main/utils.js)

---

⚠️ Important Usage Note

Maruf Bot is intended for legitimate development, learning, and responsible automation.

Do not use the bot for:

- Spam or mass unsolicited messages.
- Harassment or abuse.
- Unauthorized access.
- Fraud or impersonation.
- Malicious or illegal activity.
- Sharing private credentials.
- Distributing harmful content.

Some commands or integrations may have additional restrictions. Review the relevant platform rules and project configuration before enabling them.

---

💾 Database

The project may support different database systems depending on the version and configuration.

Database Configuration

Check the actual "config.json" structure before changing database settings.

A configuration may look similar to:

{
  "database": {
    "type": "sqlite",
    "uriMongodb": "",
    "autoSyncWhenStart": false,
    "autoRefreshThreadInfoFirstTime": false
  }
}

«This is an example. Use the exact configuration keys supported by your installed version.»

Database Comparison

Database| Advantages| Limitations| Suitable for
JSON| Simple and easy to understand| Not ideal for concurrent writes or large datasets| Small experiments
SQLite| Local database with no external server| Requires reliable file storage| Small to medium projects
MongoDB| Remote database and scalable architecture| Requires setup and secure access| Larger deployments

---

👤 Users Data

The "usersData" controller is used to manage user-related information.

Create User

const newUserData = await usersData.create(userID);

If the current version supports manually supplied user information:

const userInfo = (await api.getUserInfo(userID))[userID];
const newUserData = await usersData.create(userID, userInfo);

Get User Data

const userData = await usersData.get(userID);

console.log(userData);

A user record may contain fields such as:

console.log(userData.name);
console.log(userData.userID);
console.log(userData.data);
console.log(userData.banned);

The exact schema depends on the installed project version.

Update User Data

Example:

await usersData.set(userID, {
    money: 500,
    exp: 200
}, "data");

Nested Data

await usersData.set(userID, {
    birthday: "01/01/2000"
}, "data.profile");

Read All Users

const allUsers = await usersData.getAll();
console.log(allUsers);

Other Methods

Depending on the project version, methods may include:

await usersData.getName(userID);
await usersData.getAvatarUrl(userID);
await usersData.refreshInfo(userID);
await usersData.remove(userID);

Check the actual controller implementation before relying on a method.

---

💬 Threads Data

The "threadsData" controller manages thread or group information.

Create Thread

const threadData = await threadsData.create(threadID);

Get Thread Data

const threadData = await threadsData.get(threadID);

console.log(threadData);

Update Thread Data

await threadsData.set(
    threadID,
    "Welcome to Maruf Bot!",
    "data.welcomeMessage"
);

Store an Object

await threadsData.set(
    threadID,
    {
        welcome: "Welcome {name}!",
        leave: "Goodbye {name}!"
    },
    "data"
);

Refresh Thread Information

await threadsData.refreshInfo(threadID);

Remove Thread Data

await threadsData.remove(threadID);

---

🌍 Global Data

Global data can be used for project-wide values.

Get Data

const analytics = await globalData.get(
    "analytics",
    "data",
    {}
);

Update Data

analytics.commandCount =
    (analytics.commandCount || 0) + 1;

await globalData.set(
    "analytics",
    analytics,
    "data"
);

«Use the exact "globalData" API exposed by your installed project.»

---

📦 Create a New Command

📁 Command Location

Most GoatBot-style projects load commands from a folder similar to:

scripts/
└── cmds/
    ├── help.js
    ├── rank.js
    ├── balance.js
    └── mycommand.js

Files ending in ".eg.js" are commonly used as examples or templates and may not be loaded as commands.

Check your loader implementation for the exact rules.

---

📄 Basic Command Structure

module.exports = {
    config: {
        name: "hello",
        version: "1.0.0",
        author: "Maruf",
        countDown: 3,
        role: 0,
        description: "Send a greeting",
        category: "utility",
        guide: "{pn} [name]"
    },

    langs: {
        en: {
            greeting: "Hello %1!"
        }
    },

    onStart: async function ({
        message,
        args
    }) {
        const name = args[0] || "there";

        return message.reply(`👋 Hello, ${name}!`);
    }
};

Important Fields

- "config": Command metadata.
- "onStart": Main command handler.
- "langs": Optional language strings.
- "message": Message helper.
- "args": User-provided command arguments.

---

🎯 Command Configuration

Field| Type| Description
"name"| String| Command name
"version"| String| Command version
"author"| String| Command author
"countDown"| Number| Cooldown in seconds
"role"| Number/Object| Permission level
"description"| String| Short command description
"category"| String| Command category
"guide"| String| Usage instructions
"langs"| Object| Language strings
"envConfig"| Object| Command-specific configuration
"dependencies"| Object| Additional dependencies, if supported

Role Levels

The meaning of role values depends on the project configuration. A common arrangement is:

0 = Everyone
1 = Group administrator
2 = Bot administrator

Example:

config: {
    name: "admincommand",
    version: "1.0.0",
    author: "Maruf",
    role: 2,
    description: "Administrator command",
    category: "admin"
}

---

🎁 Example Commands

Example 1 — Simple Greeting

module.exports = {
    config: {
        name: "hello",
        version: "1.0.0",
        author: "Maruf",
        countDown: 3,
        role: 0,
        description: "Send a greeting",
        category: "utility",
        guide: "{pn} [name]"
    },

    onStart: async function ({ message, args }) {
        const name = args[0] || "there";

        return message.reply(
            `👋 Hello, ${name}! Welcome to Maruf Bot.`
        );
    }
};

Example 2 — Balance Command

module.exports = {
    config: {
        name: "balance",
        version: "1.0.0",
        author: "Maruf",
        countDown: 3,
        role: 0,
        description: "Check your balance",
        category: "economy",
        guide: "{pn}"
    },

    onStart: async function ({
        message,
        event,
        usersData
    }) {
        const userID = event.senderID;
        const userData = await usersData.get(userID);

        const data = userData?.data || {};
        const money = Number(data.money) || 0;
        const exp = Number(data.exp) || 0;

        return message.reply(
            `╭───「 MARUF BOT 」───\n` +
            `│ 💰 Money: ${money}\n` +
            `│ ⭐ EXP: ${exp}\n` +
            `╰──────────────────`
        );
    }
};

Example 3 — Daily Bonus

module.exports = {
    config: {
        name: "daily",
        version: "1.0.0",
        author: "Maruf",
        countDown: 5,
        role: 0,
        description: "Claim a daily reward",
        category: "economy",
        guide: "{pn}"
    },

    onStart: async function ({
        message,
        event,
        usersData
    }) {
        const userID = event.senderID;
        const userData = await usersData.get(userID);

        const data = userData?.data || {};
        const lastDaily = Number(data.lastDaily) || 0;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - lastDaily < oneDay) {
            const remaining = oneDay - (now - lastDaily);
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor(
                (remaining % 3600000) / 60000
            );

            return message.reply(
                `⏳ You have already claimed your reward.\n` +
                `Try again in ${hours}h ${minutes}m.`
            );
        }

        const reward = Math.floor(Math.random() * 401) + 100;
        const currentMoney = Number(data.money) || 0;

        await usersData.set(userID, {
            money: currentMoney + reward,
            lastDaily: now
        }, "data");

        return message.reply(
            `🎁 Daily reward: +${reward} coins!`
        );
    }
};

Example 4 — Welcome Event

module.exports = {
    config: {
        name: "welcome",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Welcome new members",
        category: "events"
    },

    onStart: async function ({
        api,
        event,
        message
    }) {
        if (event.logMessageType !== "log:subscribe") {
            return;
        }

        const addedParticipants =
            event.logMessageData?.addedParticipants || [];

        for (const participant of addedParticipants) {
            const userID = participant.userFbId;

            if (String(userID) === String(api.getCurrentUserID())) {
                continue;
            }

            const userInfo = await api.getUserInfo(userID);
            const name = userInfo?.[userID]?.name || "friend";

            await message.send(
                `👋 Welcome to the group, ${name}!`
            );
        }
    }
};

Example 5 — Send an Image

module.exports = {
    config: {
        name: "image",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Send an image",
        category: "media"
    },

    onStart: async function ({
        message,
        utils
    }) {
        const imageURL = "https://example.com/image.jpg";

        const stream = await utils.getStreamFromURL(imageURL);

        return message.reply({
            attachment: stream
        });
    }
};

«Replace the example URL with a legitimate, accessible image URL.»

Example 6 — Reply Handler

module.exports = {
    config: {
        name: "ask",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Ask for a name",
        category: "fun"
    },

    onStart: async function ({
        message,
        event
    }) {
        const sent = await message.reply(
            "What is your name?"
        );

        global.GoatBot.onReply.set(sent.messageID, {
            commandName: "ask",
            messageID: sent.messageID,
            author: event.senderID
        });
    },

    onReply: async function ({
        message,
        event
    }) {
        return message.reply(
            `Nice to meet you, ${event.body || "friend"}!`
        );
    }
};

Example 7 — Reaction Handler

module.exports = {
    config: {
        name: "react",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Respond to a reaction",
        category: "fun"
    },

    onStart: async function ({
        message,
        event
    }) {
        const sent = await message.reply(
            "React with 👍 to continue!"
        );

        global.GoatBot.onReaction.set(sent.messageID, {
            commandName: "react",
            messageID: sent.messageID,
            author: event.senderID
        });
    },

    onReaction: async function ({
        message,
        event
    }) {
        if (event.reaction === "👍") {
            return message.reply(
                "Thanks for reacting! 🤖"
            );
        }
    }
};

---

📡 Event Handlers

The available handlers depend on the current GoatBot version.

Handler| Purpose
"onStart"| Runs when a command is called
"onChat"| Processes incoming messages
"onFirstChat"| Processes the first message in a chat after startup
"onReply"| Handles replies to registered messages
"onReaction"| Handles reactions to registered messages
"onEvent"| Handles registered events
"onAnyEvent"| Available only if implemented by the project

General Event Flow

Messenger Event
       │
       ▼
Event Handler
       │
       ▼
Command / Event Lookup
       │
       ▼
Permission Check
       │
       ▼
Cooldown Check
       │
       ▼
Execute Handler
       │
       ▼
Send Response / Log Result

«This is a conceptual overview. The actual event flow may differ between project versions.»

---

📁 Folder Structure

A typical GoatBot-style project may contain:

Maruf-bot/
├── scripts/
│   ├── cmds/
│   │   ├── help.js
│   │   ├── rank.js
│   │   ├── balance.js
│   │   ├── daily.js
│   │   └── newcommand.eg.js
│   │
│   ├── events/
│   │   ├── welcome.js
│   │   ├── leave.js
│   │   └── newcommandevent.eg.js
│   │
│   └── ...
│
├── languages/
├── config.json
├── package.json
├── DOCS.md
├── STEP_INSTALL.md
└── README.md

The exact structure depends on the current repository version.

---

🎁 Reference Files

Resource| Link
Maruf Bot Repository| https://github.com/maruf127679-pixel/Maruf-bot
Original GoatBot Repository| https://github.com/ntkhang03/Goat-Bot-V2
Original Command Template| https://github.com/ntkhang03/Goat-Bot-V2/blob/main/scripts/cmds/newcommand.eg.js
Original Event Template| https://github.com/ntkhang03/Goat-Bot-V2/blob/main/scripts/events/newcommandevent.eg.js
Original Commands Folder| https://github.com/ntkhang03/Goat-Bot-V2/tree/main/scripts/cmds
Facebook Chat API Documentation| https://github.com/ntkhang03/fb-chat-api/blob/master/DOCS.md
Maruf Bot Installation Guide| https://github.com/maruf127679-pixel/Maruf-bot/blob/main/STEP_INSTALL.md
Maruf Bot Official Website| https://web.maruf-x-hub.page.gd

---

📞 Common Errors & Fixes

Error| Possible cause| Suggested action
"Cannot find module 'xxx'"| Dependency missing| Install the required package according to the project documentation
"Cannot read properties of undefined"| Missing or unexpected data| Validate the value before accessing it
"xxx is not a function"| Wrong API or function name| Check the actual implementation
Command does not load| Incorrect file or loader rules| Check the command path and file extension
"await" syntax error| Function is not asynchronous| Use an appropriate "async" function
Database write failure| Storage or database issue| Check the database configuration and logs
"SQLITE_CANTOPEN"| Invalid database path or permissions| Verify the database path and write permissions
Dashboard does not open| Incorrect port or deployment configuration| Check the hosting logs and port settings
Authentication error| Invalid or expired credentials| Review the supported authentication method securely

Debugging Checklist

1. Read the complete error message.
2. Check the line number shown in the stack trace.
3. Confirm the Node.js version.
4. Check installed dependencies.
5. Review recent code changes.
6. Test in a controlled environment.
7. Avoid exposing private credentials in logs or screenshots.

---

💡 Best Practices

1. Validate Data

const data = userData?.data || {};
const money = Number(data.money) || 0;

2. Use Error Handling

try {
    const result = await someAsyncOperation();
    console.log(result);
} catch (error) {
    console.error("[Maruf Bot]", error.message);
}

3. Keep Commands Small

Separate large commands into helper functions or modules when appropriate.

4. Use Cooldowns

config: {
    countDown: 5
}

5. Apply Permission Checks

config: {
    role: 2
}

Use the permission model supported by your project.

6. Avoid Blocking Operations

Do not perform unnecessary heavy computation or synchronous file operations inside frequently executed handlers.

7. Validate External API Responses

if (!result || typeof result !== "object") {
    return message.reply("❌ Invalid API response.");
}

8. Keep Dependencies Updated Carefully

Review changelogs and test updates before applying them to a production bot.

---

🔐 Security Guidelines

Never Do This

- Do not expose Facebook session data or login credentials.
- Do not commit ".env" files containing secrets.
- Do not publish API keys, refresh tokens, or client secrets.
- Do not execute untrusted input through "eval()" or "Function()".
- Do not run shell commands directly from untrusted Messenger messages.
- Do not install unknown packages without reviewing them.
- Do not store private credentials in public GitHub issues.
- Do not use the bot for spam, abuse, or unauthorized activity.

Recommended Practices

- Store secrets in environment variables or a secure secret manager.
- Use administrator permissions for sensitive commands.
- Validate user input.
- Keep dependencies reviewed and updated.
- Restrict access to administrative functions.
- Maintain backups of important data.
- Review logs for accidental credential exposure.
- Test changes before production deployment.

Example: Environment Variable

const apiKey = process.env.MY_API_KEY;

if (!apiKey) {
    throw new Error("MY_API_KEY is not configured.");
}

Do not hard-code private API keys in your source code.

---

🌐 Official Links

<p align="center">
  <a href="https://web.maruf-x-hub.page.gd">🌐 MARUF-X-HUB Website</a>
  <br>
  <a href="https://github.com/maruf127679-pixel/Maruf-bot">📦 Maruf Bot GitHub Repository</a>
  <br>
  <a href="https://github.com/maruf127679-pixel">👨‍💻 Maruf Hossain GitHub Profile</a>
</p>---

✨ Credits and License

Original Project

- Original author: "NTKhang03" (https://github.com/ntkhang03)
- Original source: "Goat-Bot-V2" (https://github.com/ntkhang03/Goat-Bot-V2)
- Original license: MIT, according to the upstream project.

Customized Project

- Maintainer: "Maruf Hossain" (https://github.com/maruf127679-pixel)
- Project: "Maruf Bot" (https://github.com/maruf127679-pixel/Maruf-bot)
- Brand: MARUF-X-HUB

Original credits, license notices, and applicable attribution must be preserved. Review the actual license files before redistributing or modifying the project.

---

<p align="center">
  <strong>🚀 MARUF-X-HUB — Explore. Build. Innovate.</strong>
  <br>
  Made with ❤️ by Maruf Hossain
</p><p align="center">
  ⭐ If this project helps you learn, consider supporting the repository with constructive feedback.
</p>
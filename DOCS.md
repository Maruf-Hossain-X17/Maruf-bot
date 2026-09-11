# 📚 Goat Bot V2 — Developer Documentation

> **Original Author:** [NTKhang03](https://github.com/ntkhang03) — Goat Bot V2 (MIT License)
> **Source Code:** https://github.com/ntkhang03/Goat-Bot-V2
> **Enhanced by:** [Maruf](https://github.com/maruf127679-pixel)
>
> ⚠️ Original author credits preserved as required by MIT License.
> Do not remove NTKhang03's name from any file.

---

## 📑 Table of Contents

- [🛠️ Built-in Functions (Utils)](#-built-in-functions-utils)
- [🧠 Preparation](#-preparation)
- [⚠️ Important Note](#️-important-note)
- [💾 Database](#-database)
  - [Config](#config)
  - [Users Data](#-users-data)
  - [Threads Data](#-threads-data)
  - [Global Data](#-global-data)
- [📦 Create New Command](#-create-new-command)
  - [Basic Structure](#-basic-command-structure)
  - [Handler Functions](#-handler-functions)
  - [Handler Parameters](#-handler-parameters)
  - [Example Commands](#-example-commands)
- [🎯 Command Config Fields](#-command-config-fields)
- [📁 Folder Structure](#-folder-structure)
- [🎁 Reference Files](#-reference-files)
- [📞 Common Errors & Fixes](#-common-errors--fixes)
- [💡 Best Practices](#-best-practices)
- [🔐 Security Guidelines](#-security-guidelines)
- [✨ Credits & License](#-credits--license)

---

## 🛠️ Built-in Functions (Utils)

সব command এ `global.utils` object ব্যবহার করা যায়।

| Function | কাজ | Example |
|---|---|---|
| `utils.getTime(format)` | সময় format | `utils.getTime("DD/MM/YYYY HH:mm")` |
| `utils.convertTime(ms)` | ms → "1h 30m" | `utils.convertTime(5400000)` |
| `utils.randomString(n)` | Random string | `utils.randomString(10)` |
| `utils.randomNumber(min, max)` | Random number | `utils.randomNumber(1, 100)` |
| `utils.getExtFromMimeType(mime)` | MIME → ext | `utils.getExtFromMimeType("image/png")` |
| `utils.getExtFromUrl(url)` | URL → ext | `utils.getExtFromUrl("a.png")` |
| `utils.jsonStringifyColor(obj)` | Colorful JSON log | `console.log(utils.jsonStringifyColor({a:1}))` |
| `utils.translate(text, lang)` | Text translate | `utils.translate("Hello", "bn")` |
| `utils.translateAPI(text, lang)` | Fast translate | `await utils.translateAPI("Hi", "bn")` |
| `utils.findUid(fbLink)` | FB UID বের করা | `await utils.findUid("https://fb.com/...")` |
| `utils.getStreamFromURL(url)` | URL → stream | `await utils.getStreamFromURL(imgUrl)` |
| `utils.getStreamsFromAttachment(atts)` | Multiple streams | `await utils.getStreamsFromAttachment(event.attachments)` |
| `utils.downloadFile(url, path)` | File download | `await utils.downloadFile(url, "./tmp/a.png")` |
| `utils.uploadImgbb(stream)` | Image upload | `await utils.uploadImgbb(stream)` |
| `utils.uploadZippyshare(stream)` | File upload | `await utils.uploadZippyshare(stream)` |
| `utils.shortenURL(url)` | URL shorten | `await utils.shortenURL(longUrl)` |
| `utils.getType(obj)` | Object type | `utils.getType([])` → "Array" |
| `utils.isNumber(n)` | Number check | `utils.isNumber("5")` → true |
| `utils.removeHomeDir(path)` | Path clean | `utils.removeHomeDir(__dirname)` |
| `utils.splitPage(arr, n)` | Array pagination | `utils.splitPage([1,2,3,4], 2)` |
| `utils.drive.uploadFile(name, mime, file)` | Google Drive upload | `await utils.drive.uploadFile("a.png", "image/png", stream)` |
| `utils.drive.getFile(id)` | Drive download | `await utils.drive.getFile(fileId)` |
| `utils.drive.deleteFile(id)` | Drive delete | `await utils.drive.deleteFile(fileId)` |
| `utils.drive.getUrlDownload(id)` | Drive direct URL | `utils.drive.getUrlDownload(fileId)` |

> 📖 সম্পূর্ণ list: [utils.js](https://github.com/ntkhang03/Goat-Bot-V2/blob/main/utils.js)

---

## 🧠 Preparation

### যা যা লাগবে

- ✅ **Node.js 16.x+** — [Download](https://nodejs.org/en/download/)
- ✅ **Code Editor** — VSCode (recommended), Sublime Text, Atom
- ✅ **JavaScript Knowledge** — variables, functions, loops, arrays, objects, promises, async/await
- ✅ **Node.js Basics** — `require`, `module.exports`
- ✅ **Facebook Chat API** — [Unofficial API Docs](https://github.com/ntkhang03/fb-chat-api/blob/master/DOCS.md)

### শেখার Resources

- JavaScript: [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript) | [W3Schools](https://www.w3schools.com/js/)
- Node.js: [Official Docs](https://nodejs.org/en/docs/)
- FCA API: [DOCS.md](https://github.com/ntkhang03/fb-chat-api/blob/master/DOCS.md)

---

## ⚠️ Important Note

**GoatBot এ কঠোরভাবে নিষিদ্ধ:**

| Category | Result |
|---|---|
| 18+ Content | ❌ Permanent Ban |
| Vulgarity / Obscenity | ❌ Permanent Ban |
| Pornography | ❌ Permanent Ban |
| Treason / Politics | ❌ Permanent Ban |
| Any illegal content | ❌ Permanent Ban |

**Custom command বানানোর সময় এই নিয়মগুলো মেনে চলো।**

---

## 💾 Database

### Config

`config.json` এ `database.type` সেট করো:

```json
"database": {
    "type": "sqlite",
    "uriMongodb": "",
    "autoSyncWhenStart": false,
    "autoRefreshThreadInfoFirstTime": false
}
```

### Type Comparison

| Type | Pros | Cons | Recommended |
|---|---|---|---|
| **JSON** | Simple, no setup | Slow, unstable for large data | Small bot |
| **SQLite** | No external DB, fast | File-based, disk issues | ✅ Small-medium |
| **MongoDB** | Reliable, scalable | Needs setup + IP whitelist | ✅ Production |

---

### 👤 Users Data

#### Create User
```javascript
// Auto-create (FB API থেকে info নেয়)
const newUserData = await usersData.create(userID);

// Manual info দিয়ে create (fast)
const userInfo = (await api.getUserInfo(userID))[userID];
const newUserData = await usersData.create(userID, userInfo);
```

#### Get User Data
```javascript
const userData = await usersData.get(userID);
console.log(userData.name);          // "Maruf Hossain"
console.log(userData.userID);        // "100066542686904"
console.log(userData.data.money);    // 100
console.log(userData.banned.status); // false
```

#### Set User Data — ২টা উপায়

**উপায় ১: Path দিয়ে (recommended)**
```javascript
// Simple set
await usersData.set(userID, { banned: true }, "data");

// Nested path
await usersData.set(userID, {
    name: "ABC",
    birthday: "01/01/1999"
}, "data.relationship.lover");

// Multiple values
await usersData.set(userID, { money: 500, exp: 200 }, "data");

// Top-level (no path)
await usersData.set(userID, { name: "New Name" });
```

**উপায় ২: Manual merge**
```javascript
const userData = await usersData.get(userID);
userData.data.banned = true;
await usersData.set(userID, { data: userData.data });
```

#### Useful Methods
```javascript
// সব users
const allUsers = await usersData.getAll();

// শুধু নাম
const name = await usersData.getName(userID);

// Avatar URL
const avatarUrl = await usersData.getAvatarUrl(userID);

// Refresh FB info (name, gender, vanity)
await usersData.refreshInfo(userID);

// Delete
await usersData.remove(userID);

// Exists check
const exists = await usersData.existsSync(userID);
```

---

### 💬 Threads Data

#### Create Thread
```javascript
// Auto-create (FB API থেকে info নেয়)
const newThreadData = await threadsData.create(threadID);

// Manual info দিয়ে create (fast)
const threadInfo = await api.getThreadInfo(threadID);
const newThreadData = await threadsData.create(threadID, threadInfo);
```

#### Get Thread Data
```javascript
const threadData = await threadsData.get(threadID);
console.log(threadData.threadName);       // "My Group"
console.log(threadData.adminIDs);         // ["1000...", "2000..."]
console.log(threadData.data.welcome);     // "Hello!"
console.log(threadData.members.length);   // 25
console.log(threadData.isGroup);          // true
```

#### Set Thread Data
```javascript
// Simple string
await threadsData.set(threadID, "Welcome!", "data.welcomeMessage");

// Object
await threadsData.set(threadID, {
    welcome: "Hi {name}",
    leave: "Bye {name}"
}, "data");

// Array
await threadsData.set(threadID, ["user1", "user2"], "data.adminList");
```

#### Refresh Thread Info
```javascript
await threadsData.refreshInfo(threadID);
// Updates: threadName, threadThemeID, emoji, adminIDs, imageSrc, members
```

#### Delete Thread
```javascript
await threadsData.remove(threadID);
```

---

### 🌍 Global Data

```javascript
// Get global value
const value = await globalData.get("key", "data", {});

// Set global value
await globalData.set("key", { someData: "value" }, "data");

// Example: Analytics
const analytics = await globalData.get("analytics", "data", {});
analytics.commandCount = (analytics.commandCount || 0) + 1;
await globalData.set("analytics", analytics, "data");
```

---

## 📦 Create New Command

### 📁 File Location

```
scripts/cmds/mycommand.js       ← Bot এ load হবে
scripts/cmds/mycommand.eg.js    ← Bot এ load হবে না (template)
```

### 📄 Basic Command Structure

```javascript
module.exports = {
    config: {
        name: "mycommand",           // Command name
        version: "1.0.0",
        author: "Maruf",             // তোমার নাম
        countDown: 3,                // Cooldown (seconds)
        role: 0,                     // 0=everyone, 1=admin box, 2=admin bot
        description: "Short description",
        category: "utility",
        guide: "{pn} <arg1> [arg2]"  // {pn} = prefix+name
    },

    langs: {
        en: {
            greeting: "Hello %1! You are %2 years old.",
            error: "❌ Error: %1"
        },
        vi: {
            greeting: "Xin chào %1! Bạn %2 tuổi."
        }
    },

    onStart: async function ({ message, event, args, api, usersData, threadsData, getLang }) {
        // তোমার code
        return message.reply("Hello!");
    }
};
```

### 🎯 Handler Functions

| Handler | কখন run হয় | Use case |
|---|---|---|
| `onStart` | User command call করলে | Normal commands |
| `onChat` | প্রতি message এ | Auto-responders |
| `onFirstChat` | প্রথম message এ | Welcome message |
| `onReply` | User reply দিলে | Multi-step commands |
| `onReaction` | User react করলে | Interactive commands |
| `onEvent` | New user join/leave | Event handlers |
| `onAnyEvent` | যেকোনো event | Logging, monitoring |

### 📝 Handler Parameters

```javascript
onStart: async function ({
    api,              // Facebook API (sendMessage, etc.)
    event,            // Message event
    message,          // Helper: message.reply/send/unsend/reaction
    args,             // Command arguments array
    commandName,      // "mycommand"
    prefix,           // "+"
    role,             // User role (0/1/2)
    userData,         // Current user data
    threadData,       // Current thread data
    usersData,        // User controller
    threadsData,      // Thread controller
    globalData,       // Global data
    dashBoardData,    // Dashboard data
    envCommands,      // Env for commands
    envEvents,        // Env for events
    envGlobal,        // Global env
    getLang,          // Language function
    removeCommandNameFromBody,  // Helper
    isUserCallCommand // true if user called this command
}) { /* ... */ }
```

### 🎁 Example Commands

#### Example 1: Simple Reply

```javascript
module.exports = {
    config: {
        name: "hello",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Say hello",
        category: "utility",
        guide: "{pn} [name]"
    },

    onStart: async function ({ message, args }) {
        const name = args[0] || "there";
        return message.reply(`👋 Hello, ${name}!`);
    }
};
```

#### Example 2: Money System

```javascript
module.exports = {
    config: {
        name: "balance",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Check your balance",
        category: "economy",
        guide: "{pn}"
    },

    onStart: async function ({ message, event, usersData }) {
        const { senderID } = event;
        const userData = await usersData.get(senderID);

        // ✅ Null-safe access
        const money = userData?.data?.money || 0;
        const exp = userData?.data?.exp || 0;

        return message.reply(
            `╭───「 𝗕𝗔𝗟𝗔𝗡𝗖𝗘 」───\n` +
            `│ 💰 Money: ${money}\n` +
            `│ ⭐ EXP: ${exp}\n` +
            `╰──────────────────`
        );
    }
};
```

#### Example 3: Daily Bonus

```javascript
module.exports = {
    config: {
        name: "daily",
        version: "1.0.0",
        author: "Maruf",
        countDown: 5,
        role: 0,
        description: "Get daily reward",
        category: "economy"
    },

    onStart: async function ({ message, event, usersData }) {
        const { senderID } = event;
        const userData = await usersData.get(senderID);

        const lastDaily = userData?.data?.lastDaily || 0;
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (now - lastDaily < ONE_DAY) {
            const remain = ONE_DAY - (now - lastDaily);
            const hours = Math.floor(remain / 3600000);
            const minutes = Math.floor((remain % 3600000) / 60000);
            return message.reply(`⏳ Already claimed! Come back in ${hours}h ${minutes}m.`);
        }

        const reward = Math.floor(Math.random() * 500) + 100;
        const currentMoney = userData?.data?.money || 0;

        await usersData.set(senderID, {
            money: currentMoney + reward,
            lastDaily: now
        }, "data");

        return message.reply(`🎁 Daily reward: +${reward} coins!`);
    }
};
```

#### Example 4: Welcome Event

```javascript
module.exports = {
    config: {
        name: "welcome",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Welcome new members",
        category: "events"
    },

    onEvent: async function ({ api, event, message, threadsData }) {
        const { logMessageType, logMessageData, threadID } = event;

        if (logMessageType !== "log:subscribe") return;

        const threadData = await threadsData.get(threadID);
        const welcomeMsg = threadData?.data?.welcomeMessage || "Welcome {name}!";

        for (const uid of logMessageData.addedParticipants.map(p => p.userFbId)) {
            if (uid === api.getCurrentUserID()) continue;
            const name = (await api.getUserInfo(uid))[uid].name;
            const finalMsg = welcomeMsg.replace(/{name}/g, name);
            await message.send(finalMsg);
        }
    }
};
```

#### Example 5: Send Image/Sticker

```javascript
module.exports = {
    config: {
        name: "sticker",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Send a sticker",
        category: "fun"
    },

    onStart: async function ({ message, utils }) {
        const stickerUrl = "https://example.com/sticker.gif";
        const stream = await utils.getStreamFromURL(stickerUrl);
        return message.reply({ attachment: stream });
    }
};
```

#### Example 6: Reply Handler

```javascript
module.exports = {
    config: {
        name: "ask",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "Ask a question",
        category: "fun"
    },

    onStart: async function ({ message, event }) {
        const sent = await message.reply("What is your name?");
        global.GoatBot.onReply.set(sent.messageID, {
            commandName: "ask",
            messageID: sent.messageID,
            author: event.senderID
        });
    },

    onReply: async function ({ message, event }) {
        const answer = event.body;
        return message.reply(`Nice to meet you, ${answer}!`);
    }
};
```

#### Example 7: Reaction Handler

```javascript
module.exports = {
    config: {
        name: "react",
        version: "1.0.0",
        author: "Maruf",
        role: 0,
        description: "React to message",
        category: "fun"
    },

    onStart: async function ({ message, event }) {
        const sent = await message.reply("React with 👍 to continue!");
        global.GoatBot.onReaction.set(sent.messageID, {
            commandName: "react",
            messageID: sent.messageID,
            author: event.senderID
        });
    },

    onReaction: async function ({ message, event }) {
        if (event.reaction === "👍") {
            return message.reply("Thanks for reacting!");
        }
    }
};
```

---

## 🎯 Command Config Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | ✅ | Command name |
| `version` | String | ✅ | Version (e.g., "1.0.0") |
| `author` | String | ✅ | তোমার নাম |
| `countDown` | Number | ❌ | Cooldown in seconds (default: 1) |
| `role` | Number/Object | ❌ | `0`=all, `1`=admin box, `2`=admin bot |
| `description` | String | ❌ | Short description |
| `category` | String | ❌ | "utility" / "fun" / "economy" |
| `guide` | String | ❌ | Usage guide ({pn} = prefix+name) |
| `langs` | Object | ❌ | Multi-language texts |
| `envConfig` | Object | ❌ | Command config |
| `dependencies` | Object | ❌ | Required npm packages |

### Role Config — Object Form

```javascript
role: {
    onStart: 0,      // Command call — everyone
    onChat: 1,       // On chat — admin box only
    onReply: 1,      // On reply — admin box only
    onReaction: 0    // On reaction — everyone
}
```

### envConfig Example

```javascript
config: {
    name: "setwelcome",
    envConfig: {
        defaultWelcome: "Welcome {name}!",
        maxLength: 2000
    }
}

// Usage:
onStart: async function ({ envCommands, message }) {
    const cfg = envCommands["setwelcome"];
    console.log(cfg.defaultWelcome);
}
```

---

## 📁 Folder Structure

```
scripts/
├── cmds/                          ← Commands
│   ├── help.js
│   ├── rank.js
│   ├── balance.js
│   ├── daily.js
│   ├── newcommand.eg.js           ← Template
│   └── ...
├── events/                        ← Event commands
│   ├── welcome.js
│   ├── leave.js
│   ├── newcommandevent.eg.js
│   └── ...
└── ...
```

---

## 🎁 Reference Files

| File | Link |
|---|---|
| Command Template | [newcommand.eg.js](https://github.com/ntkhang03/Goat-Bot-V2/blob/main/scripts/cmds/newcommand.eg.js) |
| Event Template | [newcommandevent.eg.js](https://github.com/ntkhang03/Goat-Bot-V2/blob/main/scripts/events/newcommandevent.eg.js) |
| Example Commands | [cmds folder](https://github.com/ntkhang03/Goat-Bot-V2/tree/main/scripts/cmds) |
| Utils API | [utils.js](https://github.com/ntkhang03/Goat-Bot-V2/blob/main/utils.js) |
| FCA API | [DOCS.md](https://github.com/ntkhang03/fb-chat-api/blob/master/DOCS.md) |

### VSCode Snippets

`scripts/cmds/` বা `scripts/events/` folder এর `.js` ফাইলে type করো:

| Snippet | Result |
|---|---|
| `GoatBotCommandCreate` | নতুন command template |
| `GoatBotEventCreate` | নতুন event template |
| `GoatBotCommandSetOnReply` | onReply handler যোগ |
| `GoatBotCommandSetOnReaction` | onReaction handler যোগ |
| `GoatBotCommandPushOnEvent` | onEvent handler যোগ |
| `GoatBotCommandSetOnChat` | onChat handler যোগ |

Press <kbd>Tab</kbd> to jump between placeholders.

---

## 📞 Common Errors & Fixes

| Error | কারণ | Fix |
|---|---|---|
| `Cannot read properties of undefined` | Null/undefined access | `?.` optional chaining |
| `Cannot read properties of null (reading 'settings')` | Placeholder data নেই | `userData?.settings \|\| {}` |
| `Cannot find module 'xxx'` | Package missing | `dependencies` এ যোগ করো |
| `xxx is not a function` | Function typo | সঠিক function name check |
| Command load হয় না | File extension `.eg.js` | `.js` করো |
| `await` কাজ করে না | Function `async` না | `async function` করো |
| `database create failed` | DB write timeout | handlerCheckData non-blocking |
| Infinite loop | Circular dependency | Self-require বাদ দাও |
| `SQLITE_CANTOPEN` | Storage path ভুল | `storage: dbPath` ব্যবহার করো |

---

## 💡 Best Practices

### 1. Null-Safe Access (সবসময়)
```javascript
const data = userData?.data || {};
const money = Number(data.money) || 0;
```

### 2. Error Isolation
```javascript
try { /* risky code */ }
catch (err) { console.error("[cmd]", err.message); }
```

### 3. Non-Blocking DB Writes
```javascript
(async () => {
    try { await usersData.set(...); } catch (_) {}
})();
```

### 4. Cooldown Add করো
```javascript
config: { countDown: 5 }  // 5s cooldown
```

### 5. Role Check
```javascript
config: { role: 2 }  // admin bot only
```

### 6. Language Support
```javascript
langs: {
    en: { hello: "Hello %1!" },
    bn: { hello: "হ্যালো %1!" }
}
// Usage: getLang("hello", "Maruf")
```

### 7. Timeout for External APIs
```javascript
const result = await Promise.race([
    someSlowAPI(),
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))
]);
```

---

## 🔐 Security Guidelines

### ❌ যা করা যাবে না

- `eval()` / `Function()` দিয়ে untrusted code চালানো
- `child_process.exec()` shell command (Facebook message থেকে)
- `.env` বা `config.json` এ secrets publicly share
- GitHub token চ্যাট এ বা log এ পাঠানো
- `npm install` runtime এ (memory spike)

### ✅ যা করা উচিত

- `try/catch` সব risky operation এ
- `role: 2` admin-only commands এ
- Validated input সবসময়
- Environment variables secrets এর জন্য
- Memory limit set (`--max-old-space-size`)

---

## ✨ Credits & License

**Original Author:** [NTKhang03](https://github.com/ntkhang03)
**Source:** [Goat-Bot-V2](https://github.com/ntkhang03/Goat-Bot-V2)
**License:** MIT — Original credits must be preserved

**Enhanced Documentation by:** [Maruf](https://github.com/maruf127679-pixel)

---

⚠️ **এই documentation ব্যবহার করার সময় NTKhang03 এর credit রাখতে হবে। এটা MIT License এর শর্ত।**

**Custom command বানানোর সময় কোনো সমস্যা হলে বলো — আমি full code দিব।**

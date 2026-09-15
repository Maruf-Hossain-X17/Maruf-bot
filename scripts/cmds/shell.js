const { exec } = require("child_process");

const ADMIN_UID = "63788388848585"; // 🔑 Maruf's UID

module.exports = {
  config: {
    name: "shell",
    version: "2.0",
    author: "Maruf",
    usePrefix: false,
    countDown: 2,
    role: 2,

    shortDescription: "Execute shell commands",
    longDescription: "Executes terminal commands directly from Messenger.",
    category: "OWNER",

    guide: {
      vi: "{p}{n} <command>",
      en: "{p}{n} <command>"
    }
  },

  onStart: async function ({ args, message, event }) {
    // 🔒 Only Maruf can use this command
    if (String(event.senderID) !== ADMIN_UID) {
      return message.reply(
        "⛔ | বস, এই কমান্ডটি শুধুমাত্র ডেভেলপার মারুফ (Maruf) ব্যবহার করতে পারবে!"
      );
    }

    // Command তৈরি
    const command = args.join(" ").trim();

    if (!command) {
      return message.reply(
        "⚠️ | Please provide a shell command.\n\nExample:\nshell ls -la"
      );
    }

    // ⏳ Command চলছে
    message.reply(`⏳ | Executing:\n\`${command}\``);

    exec(
      command,
      {
        timeout: 120000, // 2 minutes timeout
        maxBuffer: 10 * 1024 * 1024, // 10 MB
        shell: "/bin/bash"
      },
      (error, stdout, stderr) => {
        stdout = stdout ? stdout.trim() : "";
        stderr = stderr ? stderr.trim() : "";

        // ❌ Command failed
        if (error) {
          let output = `❌ Command failed!\n\n`;
          output += `Command: ${command}\n\n`;
          output += `Error:\n${error.message}`;

          if (stderr) {
            output += `\n\nstderr:\n${stderr}`;
          }

          if (output.length > 1900) {
            output = output.slice(0, 1850) + "\n\n...output truncated.";
          }

          return message.reply(output);
        }

        // ✅ No output
        if (!stdout && !stderr) {
          return message.reply(
            `✅ | Command executed successfully.\n\nCommand: ${command}\n📭 No output.`
          );
        }

        // ⚠️ stderr থাকলেও command সফল হলে warning হিসেবে দেখাবে
        let output = "✅ Command executed successfully.\n\n";

        if (stdout) {
          output += `📤 Output:\n${stdout}`;
        }

        if (stderr) {
          output += `\n\n⚠️ stderr:\n${stderr}`;
        }

        // Messenger message limit
        if (output.length > 1900) {
          output =
            output.slice(0, 1850) +
            "\n\n...and more output was truncated.";
        }

        return message.reply(output);
      }
    );
  }
};
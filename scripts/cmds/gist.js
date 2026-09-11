const fs = require('fs');
const axios = require('axios');

// --- WARNING: THIS FUNCTION IS NOW UNUSED! ---
// The script will now use the official GitHub Gist API, 
// so the baseApiUrl function is no longer needed/used.
const baseApiUrl = async () => {
  // Keeping this function stub but it will be ignored in the updated onStart
  console.log("Note: baseApiUrl is no longer used for Gist creation.");
  return 'UNUSED';
};

// 🚨 IMPORTANT: Replace "YOUR_GITHUB_PAT_HERE" with your actual GitHub Personal Access Token
// Ensure the PAT has the 'gist' scope enabled. DO NOT SHARE THIS TOKEN PUBLICLY!
const GITHUB_TOKEN = "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"; 

module.exports.config = {
  name: "gist",
  version: "7.0.0", // Updated version to reflect GitHub integration
  role: 2,
  author: "dipto (Updated by AI)",
  usePrefix: true,
  description: "Convert code into a reliable GitHub Gist link",
  category: "convert",
  guide: { en: "[filename] or [reply to code and provide a filename for the gist]" },
  countDown: 1
};

module.exports.onStart = async function ({ api, event, args }) {
  let code = ''; 
  let gistFileName = args[0] ? `${args[0]}.js` : null; // Default to .js if filename is provided

  const admin = ["100066542686904"];
  
  if (!admin.includes(event.senderID)) {
    api.sendMessage("⚠ | You do not have permission to use this command.", event.threadID, event.messageID);
    return;
  }

  // Check for reply or filename
  if (!args[0] && event.type !== "message_reply") {
      api.sendMessage("⚠ | Please provide a file name (e.g., 'mycommand') or reply to the code.", event.threadID, event.messageID);
      return;
  }

  if (event.type === "message_reply") {
      code = event.messageReply.body;
      if (!gistFileName) {
          // If replying but no filename is provided, use a default
          gistFileName = "replied_code_snippet.js";
      }

  } else {
      const path = `scripts/cmds/${args[0]}.js`;

      // Check if file exists before reading
      if (!fs.existsSync(path)) {
         api.sendMessage(`❌ | Command file not found at: ${path}`, event.threadID, event.messageID);
         return;
      }

      try {
        code = await fs.promises.readFile(path, 'utf-8');
      } catch (readError) {
        api.sendMessage(`❌ | Error reading file: ${readError.message}`, event.threadID, event.messageID);
        return;
      }
      
      gistFileName = `${args[0]}.js`; // Confirm filename structure
  }

  // Check if GITHUB_TOKEN is set
  if (GITHUB_TOKEN === "YOUR_GITHUB_PAT_HERE" || !GITHUB_TOKEN) {
      api.sendMessage("❌ | Gist Creation Failed: GitHub Personal Access Token is not configured. Please update the GITHUB_TOKEN variable in the code.", event.threadID, event.messageID);
      return;
  }
  
  // --- Create Gist using Official GitHub API ---
  const githubApiUrl = 'https://api.github.com/gists';

  const payload = {
      description: `Gist created via bot command: ${gistFileName}`,
      public: true, // Set to true to make it public, false for secret
      files: {
          [gistFileName]: { // Use the dynamically created filename
              content: code 
          }
      }
  };

  try {
      api.sendMessage(`⏳ | Creating GitHub Gist for **${gistFileName}**...`, event.threadID);
      
      const response = await axios.post(githubApiUrl, payload, {
          headers: {
              'Authorization': `token ${GITHUB_TOKEN}`, // Authentication with PAT
              'Content-Type': 'application/json'
          }
      });

      const gistUrl = response.data.html_url;

      if (gistUrl) {
          api.sendMessage(`✅ GitHub Gist created successfully:\n\n${gistUrl}`, event.threadID, event.messageID);
      } else {
          throw new Error(`GitHub API returned an invalid URL in the response.`);
      }

  } catch (error) {
    // --- Detailed Error Handling ---
    let errorMessage = error.message;

    if (error.response) {
      // Check for 401/403 (Invalid Token) or other GitHub errors
      const status = error.response.status;
      let errorDetail = JSON.stringify(error.response.data);
      
      if (status === 401 || status === 403) {
          errorMessage = `GitHub Authentication Failed (Status ${status}). Your Personal Access Token (PAT) may be invalid, expired, or missing the 'gist' scope.`;
      } else {
          errorMessage = `GitHub Request Failed (Status ${status}). Details: ${errorDetail}`;
      }
    }

    console.error("An error occurred during GIST creation:", errorMessage);

    api.sendMessage(`❌ | Gist Creation Failed. Error: ${errorMessage}`, event.threadID, event.messageID);
  }
};
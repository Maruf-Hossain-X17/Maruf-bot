/**
 * start.js — Maruf Bot
 * Copies Render Secret Files into project root before launching the bot.
 * Must be the Dockerfile ENTRYPOINT.
 */

const fs = require("fs-extra");
const path = require("path");

const SECRETS = [
	{ src: "/etc/secrets/config.json", dest: "config.json", required: true },
	{ src: "/etc/secrets/configCommands.json", dest: "configCommands.json", required: false },
	{ src: "/etc/secrets/account.txt", dest: "account.txt", required: false },
	{ src: "/etc/secrets/appstate.json", dest: "appstate.json", required: false }
];

function log(tag, msg) {
	const time = new Date().toISOString().replace("T", " ").slice(0, 19);
	console.log(`[${time}] [START] ${tag} ${msg}`);
}

for (const { src, dest, required } of SECRETS) {
	const abs = path.resolve(__dirname, dest);

	if (!fs.existsSync(src)) {
		if (required) {
			log("❌", `Required secret missing: ${src}`);
			log("💡", `Add it in Render → Environment → Secret Files`);
			process.exit(1);
		} else {
			log("⚠️", `Optional secret not found: ${src} (skipped)`);
		}
		continue;
	}

	try {
		// Read the secret content
		const content = fs.readFileSync(src, "utf-8");

		// Validate JSON files
		if (dest.endsWith(".json")) {
			try {
				JSON.parse(content);
			} catch (err) {
				log("❌", `Invalid JSON in ${src}: ${err.message}`);
				process.exit(1);
			}
		}

		// Write to destination (overwrite any old broken symlink)
		try {
			if (fs.existsSync(abs) || fs.lstatSync(abs).isSymbolicLink?.()) {
				fs.unlinkSync(abs);
			}
		} catch (_) {}

		fs.writeFileSync(abs, content);
		log("✅", `Loaded ${src} → ${dest} (${content.length} bytes)`);
	} catch (err) {
		log("❌", `Failed to load ${src}: ${err.message}`);
		if (required) process.exit(1);
	}
}

log("🚀", "Starting bot...");

// Launch the actual bot
require("./Goat.js");
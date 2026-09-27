/**
 * Goat Bot V2 - updater.js (Bug-fixed & Powerful Edition)
 * Original: NTKhang03
 * Enhanced: retry, timeout, backup rotation, safe file ops, async npm
 *
 * ⚠️ Note: This version is configured for Maruf Bot repo.
 * To use with another repo, change REPO_OWNER / REPO_NAME below.
 */

const axios = require("axios");
const _ = require("lodash");
const fs = require("fs-extra");
const path = require("path");
const log = require("./logger/log.js");
const { exec } = require("child_process");

let chalk;
try {
	chalk = require("./func/colors.js").colors;
} catch (e) {
	chalk = require("chalk");
}
// fallback for chalk.hex in old versions
if (!chalk.hex) chalk.hex = () => (s) => s;

// ============ CONFIG ============
const REPO_OWNER = "maruf127679-pixel";
const REPO_NAME = "Maruf-bot";
const REPO_BRANCH = "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ""; // optional
const HTTP_TIMEOUT = 60000;
const MAX_RETRY = 3;
const MAX_BACKUPS = 5; // keep last N backups
const UPDATE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const rawBase = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}`;
const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const htmlBase = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}`;

const axiosInstance = axios.create({
	timeout: HTTP_TIMEOUT,
	headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {},
	httpsAgent: new (require("https").Agent)({ keepAlive: true })
});

async function retryAsync(fn, retries = MAX_RETRY, delay = 1500) {
	let lastErr;
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			const status = err?.response?.status;
			if (status && status < 500 && status !== 429) break;
			if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
		}
	}
	throw lastErr;
}

// ============ LANGUAGE ============

const sep = path.sep;
const currentConfig = require("./config.json");
const langCode = currentConfig.language;

let pathLanguageFile = `${process.cwd()}/languages/${langCode}.lang`;
if (!fs.existsSync(pathLanguageFile)) {
	log.warn(
		"LANGUAGE",
		`Can't find language file ${langCode}, using default language file "${path.normalize(`${process.cwd()}/languages/en.lang`)}"`
	);
	pathLanguageFile = `${process.cwd()}/languages/en.lang`;
}

const readLanguage = fs.readFileSync(pathLanguageFile, "utf-8");
const languageData = readLanguage
	.split(/\r?\n|\r/)
	.filter(line => line && !line.trim().startsWith("#") && !line.trim().startsWith("//") && line !== "");

global.language = {};
for (const sentence of languageData) {
	const getSeparator = sentence.indexOf("=");
	if (getSeparator === -1) continue;
	const itemKey = sentence.slice(0, getSeparator).trim();
	const itemValue = sentence.slice(getSeparator + 1).trim();
	const dotIndex = itemKey.indexOf(".");
	if (dotIndex === -1) continue;
	const head = itemKey.slice(0, dotIndex);
	const key = itemKey.replace(head + ".", "");
	const value = itemValue.replace(/\\n/gi, "\n");
	if (!global.language[head]) global.language[head] = {};
	global.language[head][key] = value;
}

function getText(head, key, ...args) {
	if (!global.language[head]?.[key]) return `Can't find text: "${head}.${key}"`;
	let text = global.language[head][key];
	for (let i = args.length - 1; i >= 0; i--)
		text = text.replace(new RegExp(`%${i + 1}`, "g"), args[i]);
	return text;
}

// ============ FS OVERRIDE ============

const defaultWriteFileSync = fs.writeFileSync;
const defaultCopyFileSync = fs.copyFileSync;

function checkAndAutoCreateFolder(pathFolder) {
	try {
		const normalized = path.normalize(pathFolder);
		if (normalized && normalized !== "." && !fs.existsSync(normalized)) {
			fs.mkdirSync(normalized, { recursive: true });
		}
	} catch (_) {}
}

fs.writeFileSync = function (fullPath, data, ...args) {
	try {
		fullPath = path.normalize(fullPath);
		const dir = path.dirname(fullPath);
		checkAndAutoCreateFolder(dir);
	} catch (_) {}
	return defaultWriteFileSync(fullPath, data, ...args);
};

fs.copyFileSync = function (src, dest, ...args) {
	try {
		src = path.normalize(src);
		dest = path.normalize(dest);
		const dir = path.dirname(dest);
		checkAndAutoCreateFolder(dir);
	} catch (_) {}
	return defaultCopyFileSync(src, dest, ...args);
};

// ============ SORT OBJ ============

function sortObj(obj, parentObj, rootKeys, stringKey = "") {
	const root = sortObjAsRoot(obj, rootKeys);
	stringKey = stringKey || "";
	if (stringKey) stringKey += ".";

	for (const key in root) {
		if (
			typeof root[key] === "object" &&
			!Array.isArray(root[key]) &&
			root[key] !== null
		) {
			const subKey = stringKey + key;
			root[key] = sortObj(
				root[key],
				parentObj,
				Object.keys(_.get(parentObj, subKey) || {})
			);
		}
	}
	return root;
}

function sortObjAsRoot(subObj, rootKeys) {
	const _obj = {};
	for (const key in subObj) {
		const idx = rootKeys.indexOf(key);
		_obj[key] = idx === -1 ? 9999 : idx;
	}
	const sorted = Object.keys(_obj).sort((a, b) => _obj[a] - _obj[b]);
	const out = {};
	for (const key of sorted) out[key] = subObj[key];
	return out;
}

// ============ BACKUP ROTATION ============

function rotateBackups(backupsPath, keep = MAX_BACKUPS) {
	try {
		const dirs = fs
			.readdirSync(backupsPath)
			.filter(name => name.startsWith("backup_"))
			.map(name => ({
				name,
				full: path.join(backupsPath, name),
				mtime: fs.statSync(path.join(backupsPath, name)).mtimeMs
			}))
			.sort((a, b) => b.mtime - a.mtime); // newest first

		for (const old of dirs.slice(keep)) {
			try {
				fs.removeSync(old.full);
				log.info("UPDATE", `Removed old backup: ${chalk.yellow(old.name)}`);
			} catch (_) {}
		}
	} catch (_) {}
}

// ============ MAIN ============

(async () => {
	try {
		// ---- 1. check cooldown ----
		let lastCommit;
		try {
			const { data } = await retryAsync(() => axiosInstance.get(`${apiBase}/commits/${REPO_BRANCH}`));
			lastCommit = data;
		} catch (err) {
			return log.error("ERROR", `Can't reach GitHub API: ${err.message}`);
		}

		const lastCommitDate = new Date(lastCommit.commit.committer.date);
		const diff = Date.now() - lastCommitDate.getTime();
		if (diff < UPDATE_COOLDOWN_MS) {
			const remain = UPDATE_COOLDOWN_MS - diff;
			const minutes = Math.floor(remain / 1000 / 60);
			const seconds = Math.floor((remain / 1000) % 60);
			return log.error("ERROR", getText("updater", "updateTooFast", minutes, seconds));
		}

		// ---- 2. get versions.json ----
		let versions;
		try {
			const { data } = await retryAsync(() => axiosInstance.get(`${rawBase}/versions.json`));
			versions = data;
		} catch (err) {
			return log.error("ERROR", `Can't fetch versions.json: ${err.message}`);
		}

		if (!Array.isArray(versions)) return log.error("ERROR", "Invalid versions.json format");

		const currentVersion = require("./package.json").version;
		const indexCurrentVersion = versions.findIndex(v => v.version === currentVersion);

		if (indexCurrentVersion === -1) {
			return log.error("ERROR", getText("updater", "cantFindVersion", chalk.yellow(currentVersion)));
		}

		const versionsNeedToUpdate = versions.slice(indexCurrentVersion + 1);
		if (versionsNeedToUpdate.length === 0) {
			return log.info("SUCCESS", getText("updater", "latestVersion"));
		}

		fs.writeFileSync(`${process.cwd()}/versions.json`, JSON.stringify(versions, null, 2));
		log.info("UPDATE", getText("updater", "newVersions", chalk.yellow(versionsNeedToUpdate.length)));

		// ---- 3. merge update plan (FIXED: proper loop nesting) ----
		const createUpdate = {
			version: "",
			files: {},
			deleteFiles: {},
			reinstallDependencies: false
		};

		for (const version of versionsNeedToUpdate) {
			// files
			for (const filePath in version.files || {}) {
				if (["config.json", "configCommands.json"].includes(filePath)) {
					createUpdate.files[filePath] = {
						...(createUpdate.files[filePath] || {}),
						...version.files[filePath]
					};
				} else {
					createUpdate.files[filePath] = version.files[filePath];
				}
				delete createUpdate.deleteFiles[filePath];
			}
			// deleteFiles (FIXED: was inside files loop)
			for (const filePath in version.deleteFiles || {}) {
				createUpdate.deleteFiles[filePath] = version.deleteFiles[filePath];
			}
			// reinstall
			if (version.reinstallDependencies) createUpdate.reinstallDependencies = true;

			createUpdate.version = version.version;
		}

		// ---- 4. prepare backups folder ----
		const backupsPath = `${process.cwd()}/backups`;
		if (!fs.existsSync(backupsPath)) fs.mkdirSync(backupsPath, { recursive: true });
		const folderBackup = `${backupsPath}/backup_${currentVersion}`;

		// move old-style backup folders into backups/
		try {
			const foldersBackup = fs
				.readdirSync(process.cwd())
				.filter(f => f.startsWith("backup_") && fs.lstatSync(path.join(process.cwd(), f)).isDirectory());
			for (const folder of foldersBackup) {
				fs.moveSync(path.join(process.cwd(), folder), path.join(backupsPath, folder), { overwrite: true });
			}
		} catch (_) {}

		log.info("UPDATE", `Update to version ${chalk.yellow(createUpdate.version)}`);
		const { files, deleteFiles, reinstallDependencies } = createUpdate;

		// ---- 5. apply files ----
		for (const filePath in files) {
			const description = files[filePath];
			const fullPath = path.join(process.cwd(), filePath);
			let getFile;

			try {
				const response = await retryAsync(() =>
					axiosInstance.get(`${rawBase}/${filePath}`, { responseType: "arraybuffer" })
				);
				getFile = response.data;
			} catch (e) {
				log.warn("UPDATE", `Skip ${filePath} (download failed: ${e.message})`);
				continue;
			}

			// config merge
			if (["config.json", "configCommands.json"].includes(filePath)) {
				let currentConfigData;
				try {
					currentConfigData = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
				} catch (_) {
					currentConfigData = {};
				}
				const configValueUpdate = files[filePath];

				for (const key in configValueUpdate) {
					const value = configValueUpdate[key];
					if (typeof value === "string" && value.startsWith("DEFAULT_")) {
						const keyOfDefault = value.replace("DEFAULT_", "");
						_.set(currentConfigData, key, _.get(currentConfigData, keyOfDefault));
					} else if (
						typeof value === "object" &&
						value !== null &&
						!Array.isArray(value) &&
						typeof _.get(currentConfigData, key) === "object"
					) {
						_.merge(currentConfigData, { [key]: value });
					} else {
						_.set(currentConfigData, key, value);
					}
				}

				const sorted = sortObj(currentConfigData, currentConfigData, Object.keys(currentConfigData));
				if (fs.existsSync(fullPath)) {
					fs.copyFileSync(fullPath, `${folderBackup}/${filePath}`);
				}
				fs.writeFileSync(fullPath, JSON.stringify(sorted, null, 2));

				console.log(chalk.bold.blue("[↑]"), filePath);
				console.log(chalk.bold.yellow("[!]"), getText("updater", "configChanged", chalk.yellow(filePath)));
			} else {
				const contentsSkip = ["DO NOT UPDATE", "SKIP UPDATE", "DO NOT UPDATE THIS FILE"];
				const fileExists = fs.existsSync(fullPath);

				if (fileExists) {
					try {
						fs.copyFileSync(fullPath, `${folderBackup}/${filePath}`);
					} catch (_) {}
				}

				// skip check
				let firstLine = "";
				if (fileExists) {
					try {
						firstLine = fs.readFileSync(fullPath, "utf-8").trim().split(/\r?\n|\r/)[0];
					} catch (_) {}
				}

				const skipIdx = contentsSkip.findIndex(c => firstLine.includes(c));
				if (skipIdx !== -1) {
					console.log(
						chalk.bold.yellow("[!]"),
						getText("updater", "skipFile", chalk.yellow(filePath), chalk.yellow(contentsSkip[skipIdx]))
					);
					continue;
				}

				fs.writeFileSync(fullPath, Buffer.from(getFile));

				console.log(
					fileExists ? chalk.bold.blue("[↑]") : chalk.bold.green("[+]"),
					`${filePath}:`,
					chalk.hex("#858585")(
						typeof description === "string"
							? description
							: typeof description === "object"
								? JSON.stringify(description, null, 2)
								: description
					)
				);
			}
		}

		// ---- 6. delete files ----
		for (const filePath in deleteFiles) {
			const description = deleteFiles[filePath];
			const fullPath = path.join(process.cwd(), filePath);
			if (!fs.existsSync(fullPath)) continue;

			try {
				if (fs.lstatSync(fullPath).isDirectory()) {
					fs.removeSync(fullPath);
				} else {
					fs.copyFileSync(fullPath, `${folderBackup}/${filePath}`);
					fs.unlinkSync(fullPath);
				}
				console.log(chalk.bold.red("[-]"), `${filePath}:`, chalk.hex("#858585")(description));
			} catch (e) {
				log.warn("UPDATE", `Can't delete ${filePath}: ${e.message}`);
			}
		}

		// ---- 7. update package.json ----
		try {
			const { data: packageHTML } = await retryAsync(() => axiosInstance.get(`${htmlBase}/package.json`));
			const json = packageHTML.split('data-target="react-app.embeddedData">')[1].split("</script>")[0];
			const packageJSON = JSON.parse(json).payload.blob.rawLines.join("\n");
			fs.writeFileSync(`${process.cwd()}/package.json`, JSON.stringify(JSON.parse(packageJSON), null, 2));
		} catch (e) {
			log.warn("UPDATE", `Can't update package.json: ${e.message}`);
		}

		log.info(
			"UPDATE",
			getText(
				"updater",
				"updateSuccess",
				!reinstallDependencies ? getText("updater", "restartToApply") : ""
			)
		);

		// ---- 8. reinstall dependencies ----
		if (reinstallDependencies) {
			log.info("UPDATE", getText("updater", "installingPackages"));
			await new Promise((resolve, reject) => {
				exec("npm install", { stdio: "inherit" }, (err) => {
					if (err) reject(err);
					else resolve();
				});
			}).catch(err => {
				log.error("UPDATE", `npm install failed: ${err.message}`);
			});
			log.info("UPDATE", getText("updater", "installSuccess"));
		}

		log.info("UPDATE", getText("updater", "backupSuccess", chalk.yellow(folderBackup)));

		// rotate old backups
		rotateBackups(backupsPath, MAX_BACKUPS);
	} catch (err) {
		log.error("UPDATE", `Unexpected error: ${err.message}`);
		console.error(err);
	}
})();
/**
 * @author NTKhang
 * Fixed by Maruf — SQLite storage path fix + verbose logging
 */

module.exports = async function () {
	const { Sequelize } = require("sequelize");
	const path = require("path");
	const fs = require("fs-extra");

	// ——— data directory ———
	const dataDir = path.join(__dirname, "..", "data");
	const dbPath = path.join(dataDir, "data.sqlite");

	console.log("[SQLITE] Data dir:", dataDir);
	console.log("[SQLITE] DB path:", dbPath);

	// Ensure dir exists & writable
	try {
		fs.ensureDirSync(dataDir);
		const testFile = path.join(dataDir, ".write-test");
		fs.writeFileSync(testFile, "ok");
		fs.unlinkSync(testFile);
		console.log("[SQLITE] ✅ Directory writable");
	} catch (err) {
		console.error("[SQLITE] ❌ Directory not writable:", err.message);
		throw err;
	}

	// ✅ FIX: storage, not host!
	const sequelize = new Sequelize({
		dialect: "sqlite",
		storage: dbPath,
		logging: false,
		pool: { max: 1, min: 0, acquire: 15000, idle: 5000 },
		retry: { match: [/SQLITE_BUSY/], max: 3 }
	});

	console.log("[SQLITE] Connecting...");
	try {
		await sequelize.authenticate();
		console.log("[SQLITE] ✅ Authenticated");
	} catch (err) {
		console.error("[SQLITE] ❌ Authenticate failed:", err.message);
		throw err;
	}

	const threadModel = require("../models/sqlite/thread.js")(sequelize);
	const userModel = require("../models/sqlite/user.js")(sequelize);
	const dashBoardModel = require("../models/sqlite/userDashBoard.js")(sequelize);
	const globalModel = require("../models/sqlite/global.js")(sequelize);

	console.log("[SQLITE] Syncing tables...");
	try {
		await sequelize.sync({ force: false, alter: false });
		console.log("[SQLITE] ✅ Synced");
	} catch (err) {
		console.error("[SQLITE] ❌ Sync failed:", err.message);
		throw err;
	}

	// Verify file was created
	if (fs.existsSync(dbPath)) {
		const size = fs.statSync(dbPath).size;
		console.log("[SQLITE] ✅ DB file size:", size, "bytes");
	} else {
		console.error("[SQLITE] ❌ DB file NOT created at", dbPath);
		throw new Error("SQLite file was not created");
	}

	return {
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		sequelize
	};
};
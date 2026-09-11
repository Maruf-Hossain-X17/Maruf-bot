/**
 * @author NTKhang
 * Modified by Maruf — SQLite connection with debug logging
 */

module.exports = async function () {
	const { Sequelize } = require("sequelize");
	const path = require("path");
	const fs = require("fs-extra");

	// ——— ensure data dir exists & writable ———
	const dataDir = path.join(__dirname, "..", "data");
	try {
		fs.ensureDirSync(dataDir);
		// test writability
		const testFile = path.join(dataDir, ".write-test");
		fs.writeFileSync(testFile, "ok");
		fs.unlinkSync(testFile);
	} catch (err) {
		console.error("[SQLITE] Cannot write to data directory:", err.message);
		throw err;
	}

	const dbPath = path.join(dataDir, "data.sqlite");

	const sequelize = new Sequelize({
		dialect: "sqlite",
		storage: dbPath,          // ✅ storage, not host
		logging: false,
		pool: { max: 1, min: 0, acquire: 10000, idle: 5000 },
		retry: { match: [/SQLITE_BUSY/], max: 3 },
		dialectOptions: {
			// increase timeout for slow disks
			timeout: 15000
		}
	});

	console.log("[SQLITE] Connecting to", dbPath);

	try {
		await sequelize.authenticate();
		console.log("[SQLITE] ✅ Connected");
	} catch (err) {
		console.error("[SQLITE] ❌ Authenticate failed:", err.message);
		throw err;
	}

	const threadModel = require("../models/sqlite/thread.js")(sequelize);
	const userModel = require("../models/sqlite/user.js")(sequelize);
	const dashBoardModel = require("../models/sqlite/userDashBoard.js")(sequelize);
	const globalModel = require("../models/sqlite/global.js")(sequelize);

	try {
		await sequelize.sync({ force: false, alter: false });
		console.log("[SQLITE] ✅ Synced");
	} catch (err) {
		console.error("[SQLITE] ❌ Sync failed:", err.message);
		throw err;
	}

	return {
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		sequelize
	};
};
/**
 * @author NTKhang
 * Modified by Maruf — SQLite connection fix (host → storage)
 * Original author credit preserved as required by MIT license.
 */

module.exports = async function () {
	const { Sequelize } = require("sequelize");
	const path = require("path");
	const fs = require("fs-extra");

	// Ensure data directory exists
	const dataDir = path.join(__dirname, "..", "data");
	fs.ensureDirSync(dataDir);

	const dbPath = path.join(dataDir, "data.sqlite");

	// ✅ FIX: SQLite uses "storage" not "host"
	const sequelize = new Sequelize({
		dialect: "sqlite",
		storage: dbPath,
		logging: false,
		pool: {
			max: 5,
			min: 0,
			acquire: 30000,
			idle: 10000
		},
		retry: {
			match: [/SQLITE_BUSY/],
			max: 5
		}
	});

	const threadModel = require("../models/sqlite/thread.js")(sequelize);
	const userModel = require("../models/sqlite/user.js")(sequelize);
	const dashBoardModel = require("../models/sqlite/userDashBoard.js")(sequelize);
	const globalModel = require("../models/sqlite/global.js")(sequelize);

	await sequelize.authenticate();
	await sequelize.sync({ force: false });

	return {
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		sequelize
	};
};
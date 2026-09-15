const express = require('express');
const path = require('path');
const os = require('os');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Bot Stats Route
app.get('/api/stats', (req, res) => {
    // Apnar Bot er instance baseline dynamic data
    const activeGroups = global.db?.groups?.length || 18; // Apnar bot code er group list or fallback count
    const totalCommands = global.client?.commands?.size || 45; // Apnar bot er total commands count

    res.json({
        status: 'ONLINE 🟢',
        uptime: Math.floor(process.uptime()),
        memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB',
        cpu: (os.loadavg()[0] * 10).toFixed(1) + '%',
        groups: activeGroups,
        commands: totalCommands
    });
});

app.listen(PORT, () => {
    console.log(`[DASHBOARD] 🚀 Glassmorphic 3D Dashboard running on port ${PORT}`);
});
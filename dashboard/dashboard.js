const express = require('express');
const path = require('path');
const os = require('os');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic Bot Stats API Endpoint
app.get('/api/stats', (req, res) => {
    // GoatBot v2 internal data structures fallback to global tracking
    const activeGroups = global.db?.allThreadData?.length 
                      || global.db?.threads?.size 
                      || global.GoatBot?.threads?.size 
                      || 0;

    const totalCommands = global.GoatBot?.commands?.size 
                        || global.GoatBot?.commandUtils?.commands?.size 
                        || 0;

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
    console.log(`[DASHBOARD] 🚀 3D Glassmorphic Panel live on port ${PORT}`);
});
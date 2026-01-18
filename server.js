// ===================================
// מערכת ניהול אוטובוסים - שרת Node.js
// ===================================
// שרת פשוט שמנהל 3 קבצי JSON:
// 1. users.json - משתמשים
// 2. data.json - תלמידים ואוטובוסים
// 3. settings.json - הגדרות API
// ===================================

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.')); // Serve static files

// File paths
const FILES = {
    users: path.join(__dirname, 'users.json'),
    data: path.join(__dirname, 'data.json'),
    settings: path.join(__dirname, 'settings.json')
};

// Helper: Read JSON file
async function readJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        throw error;
    }
}

// Helper: Write JSON file
async function writeJSON(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        throw error;
    }
}

// ===== USERS API =====

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const data = await readJSON(FILES.users);
        res.json(data.users || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read users' });
    }
});

// Get user by UID
app.get('/api/users/:uid', async (req, res) => {
    try {
        const data = await readJSON(FILES.users);
        const user = (data.users || []).find(u => u.uid === req.params.uid);
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to read user' });
    }
});

// Save user
app.post('/api/users', async (req, res) => {
    try {
        const data = await readJSON(FILES.users);
        const users = data.users || [];
        const index = users.findIndex(u => u.uid === req.body.uid);

        if (index >= 0) {
            users[index] = req.body;
        } else {
            users.push(req.body);
        }

        data.users = users;
        await writeJSON(FILES.users, data);
        res.json(req.body);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save user' });
    }
});

// Update user role
app.patch('/api/users/:uid/role', async (req, res) => {
    try {
        const data = await readJSON(FILES.users);
        const users = data.users || [];
        const user = users.find(u => u.uid === req.params.uid);

        if (user) {
            user.role = req.body.role;
            data.users = users;
            await writeJSON(FILES.users, data);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Approve user
app.patch('/api/users/:uid/approve', async (req, res) => {
    try {
        const data = await readJSON(FILES.users);
        const users = data.users || [];
        const user = users.find(u => u.uid === req.params.uid);

        if (user) {
            user.approved = true;
            data.users = users;
            await writeJSON(FILES.users, data);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// Delete user
app.delete('/api/users/:uid', async (req, res) => {
    try {
        const data = await readJSON(FILES.users);
        data.users = (data.users || []).filter(u => u.uid !== req.params.uid);
        await writeJSON(FILES.users, data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ===== DATA API (Buses & Students) =====

// Get all buses
app.get('/api/buses', async (req, res) => {
    try {
        const data = await readJSON(FILES.data);
        res.json(data.buses || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read buses' });
    }
});

// Save bus
app.post('/api/buses', async (req, res) => {
    try {
        const data = await readJSON(FILES.data);
        const buses = data.buses || [];

        if (!req.body.id) {
            req.body.id = 'bus_' + Date.now();
        }

        const index = buses.findIndex(b => b.id === req.body.id);
        if (index >= 0) {
            buses[index] = req.body;
        } else {
            buses.push(req.body);
        }

        data.buses = buses;
        await writeJSON(FILES.data, data);
        res.json(req.body);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save bus' });
    }
});

// Delete bus
app.delete('/api/buses/:id', async (req, res) => {
    try {
        const data = await readJSON(FILES.data);
        data.buses = (data.buses || []).filter(b => b.id !== req.params.id);
        await writeJSON(FILES.data, data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete bus' });
    }
});

// Get all students
app.get('/api/students', async (req, res) => {
    try {
        const data = await readJSON(FILES.data);
        res.json(data.students || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read students' });
    }
});

// Save student
app.post('/api/students', async (req, res) => {
    try {
        const data = await readJSON(FILES.data);
        const students = data.students || [];

        if (!req.body.id) {
            req.body.id = 'student_' + Date.now();
        }

        const index = students.findIndex(s => s.id === req.body.id);
        if (index >= 0) {
            students[index] = req.body;
        } else {
            students.push(req.body);
        }

        data.students = students;
        await writeJSON(FILES.data, data);
        res.json(req.body);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save student' });
    }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
    try {
        const data = await readJSON(FILES.data);
        data.students = (data.students || []).filter(s => s.id !== req.params.id);
        await writeJSON(FILES.data, data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

// ===== SETTINGS API =====

// Get settings
app.get('/api/settings', async (req, res) => {
    try {
        const data = await readJSON(FILES.settings);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

// Save settings
app.post('/api/settings', async (req, res) => {
    try {
        await writeJSON(FILES.settings, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Update settings (merge)
app.patch('/api/settings', async (req, res) => {
    try {
        const data = await readJSON(FILES.settings);
        const updated = { ...data, ...req.body };
        await writeJSON(FILES.settings, updated);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`👥 Users DB: ${FILES.users}`);
    console.log(`🚌 Data DB: ${FILES.data}`);
    console.log(`⚙️  Settings DB: ${FILES.settings}`);
});

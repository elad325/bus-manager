// ===================================
// מערכת ניהול אוטובוסים - אחסון נתונים
// ===================================
// משתמש ב-3 מסדי נתונים JSON נפרדים:
// 1. users.json - משתמשים
// 2. data.json - תלמידים ואוטובוסים
// 3. settings.json - הגדרות API
// ===================================

class StorageService {
    constructor() {
        this.apiUrl = window.location.origin; // Same server
        this.prefix = APP_CONFIG.localStoragePrefix;
    }

    // ===== BUSES =====

    async getBuses() {
        try {
            const response = await fetch(`${this.apiUrl}/api/buses`);
            if (!response.ok) throw new Error('Failed to fetch buses');
            return await response.json();
        } catch (error) {
            console.error('Error getting buses:', error);
            return this.getLocalBuses();
        }
    }

    getLocalBuses() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.buses);
        return data ? JSON.parse(data) : [];
    }

    async saveBus(bus) {
        try {
            const response = await fetch(`${this.apiUrl}/api/buses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bus)
            });
            if (!response.ok) throw new Error('Failed to save bus');
            return await response.json();
        } catch (error) {
            console.error('Error saving bus:', error);
            return this.saveLocalBus(bus);
        }
    }

    saveLocalBus(bus) {
        const buses = this.getLocalBuses();
        const index = buses.findIndex(b => b.id === bus.id);
        if (index >= 0) {
            buses[index] = bus;
        } else {
            if (!bus.id) {
                bus.id = 'bus_' + Date.now();
            }
            buses.push(bus);
        }
        localStorage.setItem(this.prefix + APP_CONFIG.keys.buses, JSON.stringify(buses));
        return bus;
    }

    async deleteBus(busId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/buses/${busId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete bus');
            return true;
        } catch (error) {
            console.error('Error deleting bus:', error);
            return this.deleteLocalBus(busId);
        }
    }

    deleteLocalBus(busId) {
        const buses = this.getLocalBuses().filter(b => b.id !== busId);
        localStorage.setItem(this.prefix + APP_CONFIG.keys.buses, JSON.stringify(buses));
        return true;
    }

    // ===== STUDENTS =====

    async getStudents() {
        try {
            const response = await fetch(`${this.apiUrl}/api/students`);
            if (!response.ok) throw new Error('Failed to fetch students');
            return await response.json();
        } catch (error) {
            console.error('Error getting students:', error);
            return this.getLocalStudents();
        }
    }

    getLocalStudents() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.students);
        return data ? JSON.parse(data) : [];
    }

    async saveStudent(student) {
        try {
            const response = await fetch(`${this.apiUrl}/api/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(student)
            });
            if (!response.ok) throw new Error('Failed to save student');
            return await response.json();
        } catch (error) {
            console.error('Error saving student:', error);
            return this.saveLocalStudent(student);
        }
    }

    saveLocalStudent(student) {
        const students = this.getLocalStudents();
        const index = students.findIndex(s => s.id === student.id);
        if (index >= 0) {
            students[index] = student;
        } else {
            if (!student.id) {
                student.id = 'student_' + Date.now();
            }
            students.push(student);
        }
        localStorage.setItem(this.prefix + APP_CONFIG.keys.students, JSON.stringify(students));
        return student;
    }

    async deleteStudent(studentId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/students/${studentId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete student');
            return true;
        } catch (error) {
            console.error('Error deleting student:', error);
            return this.deleteLocalStudent(studentId);
        }
    }

    deleteLocalStudent(studentId) {
        const students = this.getLocalStudents().filter(s => s.id !== studentId);
        localStorage.setItem(this.prefix + APP_CONFIG.keys.students, JSON.stringify(students));
        return true;
    }

    // ===== USERS =====

    async getUsers() {
        try {
            const response = await fetch(`${this.apiUrl}/api/users`);
            if (!response.ok) throw new Error('Failed to fetch users');
            return await response.json();
        } catch (error) {
            console.error('Error getting users:', error);
            return this.getLocalUsers();
        }
    }

    getLocalUsers() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.users);
        return data ? JSON.parse(data) : [];
    }

    async saveUser(user) {
        try {
            const response = await fetch(`${this.apiUrl}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!response.ok) throw new Error('Failed to save user');
            return await response.json();
        } catch (error) {
            console.error('Error saving user:', error);
            return this.saveLocalUser(user);
        }
    }

    saveLocalUser(user) {
        const users = this.getLocalUsers();
        const index = users.findIndex(u => u.uid === user.uid);
        if (index >= 0) {
            users[index] = user;
        } else {
            users.push(user);
        }
        localStorage.setItem(this.prefix + APP_CONFIG.keys.users, JSON.stringify(users));
        return user;
    }

    async getUserByUid(uid) {
        try {
            const response = await fetch(`${this.apiUrl}/api/users/${uid}`);
            if (response.status === 404) return null;
            if (!response.ok) throw new Error('Failed to fetch user');
            return await response.json();
        } catch (error) {
            console.error('Error getting user:', error);
            const users = this.getLocalUsers();
            return users.find(u => u.uid === uid) || null;
        }
    }

    async updateUserRole(uid, role) {
        try {
            const response = await fetch(`${this.apiUrl}/api/users/${uid}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            if (!response.ok) throw new Error('Failed to update role');
            return true;
        } catch (error) {
            console.error('Error updating user role:', error);
            const users = this.getLocalUsers();
            const user = users.find(u => u.uid === uid);
            if (user) {
                user.role = role;
                localStorage.setItem(this.prefix + APP_CONFIG.keys.users, JSON.stringify(users));
            }
            return true;
        }
    }

    async approveUser(uid) {
        try {
            const response = await fetch(`${this.apiUrl}/api/users/${uid}/approve`, {
                method: 'PATCH'
            });
            if (!response.ok) throw new Error('Failed to approve user');
            return true;
        } catch (error) {
            console.error('Error approving user:', error);
            const users = this.getLocalUsers();
            const user = users.find(u => u.uid === uid);
            if (user) {
                user.approved = true;
                localStorage.setItem(this.prefix + APP_CONFIG.keys.users, JSON.stringify(users));
            }
            return true;
        }
    }

    async rejectUser(uid) {
        try {
            const response = await fetch(`${this.apiUrl}/api/users/${uid}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to reject user');
            return true;
        } catch (error) {
            console.error('Error rejecting user:', error);
            const users = this.getLocalUsers().filter(u => u.uid !== uid);
            localStorage.setItem(this.prefix + APP_CONFIG.keys.users, JSON.stringify(users));
            return true;
        }
    }

    async getPendingUsers() {
        const users = await this.getUsers();
        return users.filter(u => !u.approved);
    }

    // ===== SETTINGS =====

    async getSettings() {
        try {
            const response = await fetch(`${this.apiUrl}/api/settings`);
            if (!response.ok) throw new Error('Failed to fetch settings');
            return await response.json();
        } catch (error) {
            console.error('Error getting settings:', error);
            const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.settings);
            return data ? JSON.parse(data) : {};
        }
    }

    async saveSettings(settings) {
        try {
            const response = await fetch(`${this.apiUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!response.ok) throw new Error('Failed to save settings');

            // Also save to localStorage as backup
            localStorage.setItem(this.prefix + APP_CONFIG.keys.settings, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            localStorage.setItem(this.prefix + APP_CONFIG.keys.settings, JSON.stringify(settings));
            return true;
        }
    }

    // ===== STATS =====

    async getStats() {
        const buses = await this.getBuses();
        const students = await this.getStudents();
        const users = await this.getUsers();

        return {
            totalBuses: buses.length,
            totalStudents: students.length,
            totalRoutes: buses.filter(b => b.startLocation && b.endLocation).length,
            totalUsers: users.length
        };
    }
}

// Create global instance
window.storage = new StorageService();

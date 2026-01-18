// ===================================
// מערכת ניהול אוטובוסים - אחסון נתונים
// ===================================
// כותב ישירות ל-GitHub - כל שינוי = commit!
// ===================================

class StorageService {
    constructor() {
        this.prefix = APP_CONFIG.localStoragePrefix;
        this.FILES = {
            users: 'users.json',
            data: 'data.json',
            settings: 'settings.json'
        };
    }

    // Check if GitHub is configured
    isGitHubConfigured() {
        return window.githubStorage && window.githubStorage.isConfigured();
    }

    // ===== BUSES =====

    async getBuses() {
        try {
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.data);
                return data ? (data.buses || []) : [];
            }
        } catch (error) {
            console.error('Error getting buses from GitHub:', error);
        }
        return this.getLocalBuses();
    }

    getLocalBuses() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.buses);
        return data ? JSON.parse(data) : [];
    }

    async saveBus(bus) {
        try {
            if (this.isGitHubConfigured()) {
                // Get current data
                let data = await window.githubStorage.getFile(this.FILES.data) || { buses: [], students: [] };
                const buses = data.buses || [];

                // Add or update bus
                if (!bus.id) {
                    bus.id = 'bus_' + Date.now();
                }
                const index = buses.findIndex(b => b.id === bus.id);
                if (index >= 0) {
                    buses[index] = bus;
                } else {
                    buses.push(bus);
                }

                data.buses = buses;

                // Save to GitHub (creates commit!)
                await window.githubStorage.saveFile(
                    this.FILES.data,
                    data,
                    `Update bus: ${bus.name || bus.id}`
                );

                return bus;
            }
        } catch (error) {
            console.error('Error saving bus to GitHub:', error);
        }
        return this.saveLocalBus(bus);
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
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.data) || { buses: [], students: [] };
                data.buses = (data.buses || []).filter(b => b.id !== busId);

                await window.githubStorage.saveFile(
                    this.FILES.data,
                    data,
                    `Delete bus: ${busId}`
                );

                return true;
            }
        } catch (error) {
            console.error('Error deleting bus from GitHub:', error);
        }
        return this.deleteLocalBus(busId);
    }

    deleteLocalBus(busId) {
        const buses = this.getLocalBuses().filter(b => b.id !== busId);
        localStorage.setItem(this.prefix + APP_CONFIG.keys.buses, JSON.stringify(buses));
        return true;
    }

    // ===== STUDENTS =====

    async getStudents() {
        try {
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.data);
                return data ? (data.students || []) : [];
            }
        } catch (error) {
            console.error('Error getting students from GitHub:', error);
        }
        return this.getLocalStudents();
    }

    getLocalStudents() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.students);
        return data ? JSON.parse(data) : [];
    }

    async saveStudent(student) {
        try {
            if (this.isGitHubConfigured()) {
                let data = await window.githubStorage.getFile(this.FILES.data) || { buses: [], students: [] };
                const students = data.students || [];

                if (!student.id) {
                    student.id = 'student_' + Date.now();
                }
                const index = students.findIndex(s => s.id === student.id);
                if (index >= 0) {
                    students[index] = student;
                } else {
                    students.push(student);
                }

                data.students = students;

                await window.githubStorage.saveFile(
                    this.FILES.data,
                    data,
                    `Update student: ${student.name || student.id}`
                );

                return student;
            }
        } catch (error) {
            console.error('Error saving student to GitHub:', error);
        }
        return this.saveLocalStudent(student);
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
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.data) || { buses: [], students: [] };
                data.students = (data.students || []).filter(s => s.id !== studentId);

                await window.githubStorage.saveFile(
                    this.FILES.data,
                    data,
                    `Delete student: ${studentId}`
                );

                return true;
            }
        } catch (error) {
            console.error('Error deleting student from GitHub:', error);
        }
        return this.deleteLocalStudent(studentId);
    }

    deleteLocalStudent(studentId) {
        const students = this.getLocalStudents().filter(s => s.id !== studentId);
        localStorage.setItem(this.prefix + APP_CONFIG.keys.students, JSON.stringify(students));
        return true;
    }

    // ===== USERS =====

    async getUsers() {
        try {
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.users);
                return data ? (data.users || []) : [];
            }
        } catch (error) {
            console.error('Error getting users from GitHub:', error);
        }
        return this.getLocalUsers();
    }

    getLocalUsers() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.users);
        return data ? JSON.parse(data) : [];
    }

    async saveUser(user) {
        try {
            if (this.isGitHubConfigured()) {
                let data = await window.githubStorage.getFile(this.FILES.users) || { users: [] };
                const users = data.users || [];

                const index = users.findIndex(u => u.uid === user.uid);
                if (index >= 0) {
                    users[index] = user;
                } else {
                    users.push(user);
                }

                data.users = users;

                await window.githubStorage.saveFile(
                    this.FILES.users,
                    data,
                    `Update user: ${user.email}`
                );

                return user;
            }
        } catch (error) {
            console.error('Error saving user to GitHub:', error);
        }
        return this.saveLocalUser(user);
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
        const users = await this.getUsers();
        return users.find(u => u.uid === uid) || null;
    }

    async updateUserRole(uid, role) {
        try {
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.users) || { users: [] };
                const user = (data.users || []).find(u => u.uid === uid);
                if (user) {
                    user.role = role;
                    await window.githubStorage.saveFile(
                        this.FILES.users,
                        data,
                        `Update user role: ${uid}`
                    );
                }
                return true;
            }
        } catch (error) {
            console.error('Error updating user role:', error);
        }

        const users = this.getLocalUsers();
        const user = users.find(u => u.uid === uid);
        if (user) {
            user.role = role;
            localStorage.setItem(this.prefix + APP_CONFIG.keys.users, JSON.stringify(users));
        }
        return true;
    }

    async approveUser(uid) {
        try {
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.users) || { users: [] };
                const user = (data.users || []).find(u => u.uid === uid);
                if (user) {
                    user.approved = true;
                    await window.githubStorage.saveFile(
                        this.FILES.users,
                        data,
                        `Approve user: ${uid}`
                    );
                }
                return true;
            }
        } catch (error) {
            console.error('Error approving user:', error);
        }

        const users = this.getLocalUsers();
        const user = users.find(u => u.uid === uid);
        if (user) {
            user.approved = true;
            localStorage.setItem(this.prefix + APP_CONFIG.keys.users, JSON.stringify(users));
        }
        return true;
    }

    async rejectUser(uid) {
        try {
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.users) || { users: [] };
                data.users = (data.users || []).filter(u => u.uid !== uid);
                await window.githubStorage.saveFile(
                    this.FILES.users,
                    data,
                    `Reject user: ${uid}`
                );
                return true;
            }
        } catch (error) {
            console.error('Error rejecting user:', error);
        }

        const users = this.getLocalUsers().filter(u => u.uid !== uid);
        localStorage.setItem(this.prefix + APP_CONFIG.keys.users, JSON.stringify(users));
        return true;
    }

    async getPendingUsers() {
        const users = await this.getUsers();
        return users.filter(u => !u.approved);
    }

    // ===== SETTINGS =====

    async getSettings() {
        try {
            if (this.isGitHubConfigured()) {
                const data = await window.githubStorage.getFile(this.FILES.settings);
                return data || {};
            }
        } catch (error) {
            console.error('Error getting settings from GitHub:', error);
        }

        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.settings);
        return data ? JSON.parse(data) : {};
    }

    async saveSettings(settings) {
        try {
            if (this.isGitHubConfigured()) {
                await window.githubStorage.saveFile(
                    this.FILES.settings,
                    settings,
                    'Update settings'
                );

                // Also save to localStorage as backup
                localStorage.setItem(this.prefix + APP_CONFIG.keys.settings, JSON.stringify(settings));
                return true;
            }
        } catch (error) {
            console.error('Error saving settings to GitHub:', error);
        }

        localStorage.setItem(this.prefix + APP_CONFIG.keys.settings, JSON.stringify(settings));
        return true;
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

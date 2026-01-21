// ===================================
// מערכת ניהול אוטובוסים - אחסון נתונים
// ===================================
// כותב ישירות ל-GitHub - כל שינוי = commit!
// ===================================

class StorageService {
    constructor() {
        this.prefix = APP_CONFIG.localStoragePrefix;
        this.FILES = {
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

    async saveSettings(newSettings) {
        try {
            if (this.isGitHubConfigured()) {
                // Get current settings and merge with new ones
                const currentSettings = await this.getSettings() || {};
                const mergedSettings = { ...currentSettings, ...newSettings };

                await window.githubStorage.saveFile(
                    this.FILES.settings,
                    mergedSettings,
                    'Update settings'
                );

                // Also save to localStorage as backup
                localStorage.setItem(this.prefix + APP_CONFIG.keys.settings, JSON.stringify(mergedSettings));
                return true;
            }
        } catch (error) {
            console.error('Error saving settings to GitHub:', error);
        }

        // Fallback to localStorage - also merge settings
        const currentSettings = this.getLocalSettings();
        const mergedSettings = { ...currentSettings, ...newSettings };
        localStorage.setItem(this.prefix + APP_CONFIG.keys.settings, JSON.stringify(mergedSettings));
        return true;
    }

    getLocalSettings() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.settings);
        return data ? JSON.parse(data) : {};
    }

    // ===== STATS =====

    async getStats() {
        const buses = await this.getBuses();
        const students = await this.getStudents();

        return {
            totalBuses: buses.length,
            totalStudents: students.length,
            totalRoutes: buses.filter(b => b.startLocation && b.endLocation).length
        };
    }
}

// Create global instance
window.storage = new StorageService();

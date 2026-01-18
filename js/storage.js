// ===================================
// מערכת ניהול אוטובוסים - אחסון נתונים
// ===================================
// תומך בשלושה Firebase databases נפרדים:
// 1. Users DB - משתמשים
// 2. Data DB - תלמידים ואוטובוסים
// 3. Settings DB - הגדרות
// ===================================

class StorageService {
    constructor() {
        this.prefix = APP_CONFIG.localStoragePrefix;
        this.useFirebase = false;
        this.usersDb = null;     // 👥 Users DB - משתמשים
        this.dataDb = null;      // 🚌 Data DB - תלמידים ואוטובוסים
        this.settingsDb = null;  // ⚙️ Settings DB - הגדרות
        this.db = null;          // Backward compatibility
    }

    // Initialize with Firebase databases
    // usersFirestore - for users
    // dataFirestore - for buses and students
    // settingsFirestore - for settings
    init(dataFirestore = null, settingsFirestore = null, usersFirestore = null) {
        if (usersFirestore) {
            this.usersDb = usersFirestore;
            console.log('👥 Users DB initialized in storage');
        }

        if (dataFirestore) {
            this.dataDb = dataFirestore;
            this.db = dataFirestore; // Backward compatibility
            this.useFirebase = true;
            console.log('🚌 Data DB initialized in storage');
        }

        if (settingsFirestore) {
            this.settingsDb = settingsFirestore;
            console.log('⚙️ Settings DB initialized in storage');
        }
    }

    // ===== BUSES =====

    async getBuses() {
        if (this.dataDb) {
            try {
                const snapshot = await this.dataDb.collection('buses').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Error getting buses from Firebase:', error);
                return this.getLocalBuses();
            }
        }
        return this.getLocalBuses();
    }

    getLocalBuses() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.buses);
        return data ? JSON.parse(data) : [];
    }

    async saveBus(bus) {
        if (this.dataDb) {
            try {
                if (bus.id) {
                    await this.dataDb.collection('buses').doc(bus.id).set(bus);
                } else {
                    const docRef = await this.dataDb.collection('buses').add(bus);
                    bus.id = docRef.id;
                }
                return bus;
            } catch (error) {
                console.error('Error saving bus to Firebase:', error);
                return this.saveLocalBus(bus);
            }
        }
        return this.saveLocalBus(bus);
    }

    saveLocalBus(bus) {
        const buses = this.getLocalBuses();
        if (!bus.id) {
            bus.id = 'bus_' + Date.now();
        }
        const index = buses.findIndex(b => b.id === bus.id);
        if (index >= 0) {
            buses[index] = bus;
        } else {
            buses.push(bus);
        }
        localStorage.setItem(this.prefix + APP_CONFIG.keys.buses, JSON.stringify(buses));
        return bus;
    }

    async deleteBus(busId) {
        if (this.dataDb) {
            try {
                await this.dataDb.collection('buses').doc(busId).delete();
                return true;
            } catch (error) {
                console.error('Error deleting bus from Firebase:', error);
                return this.deleteLocalBus(busId);
            }
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
        if (this.dataDb) {
            try {
                const snapshot = await this.dataDb.collection('students').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Error getting students from Firebase:', error);
                return this.getLocalStudents();
            }
        }
        return this.getLocalStudents();
    }

    getLocalStudents() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.students);
        return data ? JSON.parse(data) : [];
    }

    async getStudentsByBus(busId) {
        const students = await this.getStudents();
        return students.filter(s => s.busId === busId);
    }

    async saveStudent(student) {
        if (this.dataDb) {
            try {
                if (student.id) {
                    await this.dataDb.collection('students').doc(student.id).set(student);
                } else {
                    const docRef = await this.dataDb.collection('students').add(student);
                    student.id = docRef.id;
                }
                return student;
            } catch (error) {
                console.error('Error saving student to Firebase:', error);
                return this.saveLocalStudent(student);
            }
        }
        return this.saveLocalStudent(student);
    }

    saveLocalStudent(student) {
        const students = this.getLocalStudents();
        if (!student.id) {
            student.id = 'student_' + Date.now();
        }
        const index = students.findIndex(s => s.id === student.id);
        if (index >= 0) {
            students[index] = student;
        } else {
            students.push(student);
        }
        localStorage.setItem(this.prefix + APP_CONFIG.keys.students, JSON.stringify(students));
        return student;
    }

    async deleteStudent(studentId) {
        if (this.dataDb) {
            try {
                await this.dataDb.collection('students').doc(studentId).delete();
                return true;
            } catch (error) {
                console.error('Error deleting student from Firebase:', error);
                return this.deleteLocalStudent(studentId);
            }
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
        if (this.usersDb) {
            try {
                const snapshot = await this.usersDb.collection('users').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Error getting users from Firebase:', error);
                return this.getLocalUsers();
            }
        }
        return this.getLocalUsers();
    }

    getLocalUsers() {
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.users);
        return data ? JSON.parse(data) : [];
    }

    async saveUser(user) {
        if (this.usersDb) {
            try {
                await this.usersDb.collection('users').doc(user.uid).set({
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt || new Date().toISOString()
                });
                return user;
            } catch (error) {
                console.error('Error saving user to Firebase:', error);
                return this.saveLocalUser(user);
            }
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
        if (this.usersDb) {
            try {
                const doc = await this.usersDb.collection('users').doc(uid).get();
                if (doc.exists) {
                    return { id: doc.id, ...doc.data() };
                }
            } catch (error) {
                console.error('Error getting user from Firebase:', error);
            }
        }
        const users = this.getLocalUsers();
        return users.find(u => u.uid === uid) || null;
    }

    async updateUserRole(uid, role) {
        if (this.usersDb) {
            try {
                await this.usersDb.collection('users').doc(uid).update({ role });
                return true;
            } catch (error) {
                console.error('Error updating user role:', error);
            }
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
        if (this.usersDb) {
            try {
                await this.usersDb.collection('users').doc(uid).update({ approved: true });
                return true;
            } catch (error) {
                console.error('Error approving user:', error);
            }
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
        if (this.usersDb) {
            try {
                await this.usersDb.collection('users').doc(uid).delete();
                return true;
            } catch (error) {
                console.error('Error rejecting user:', error);
            }
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

    // Get settings from Settings DB or localStorage
    async getSettings() {
        // First, try to get from Settings DB (separate database)
        if (this.settingsDb) {
            try {
                const doc = await this.settingsDb.collection('settings').doc('app_settings').get();
                if (doc.exists) {
                    console.log('⚙️ Using settings from Settings DB');
                    return doc.data();
                }
            } catch (error) {
                console.error('Error getting settings from Settings DB:', error);
            }
        }

        // Fallback to localStorage
        const data = localStorage.getItem(this.prefix + APP_CONFIG.keys.settings);
        return data ? JSON.parse(data) : {};
    }

    // Save settings to both Settings DB and localStorage
    async saveSettings(settings) {
        // Save to Settings DB if available
        if (this.settingsDb) {
            try {
                await this.settingsDb.collection('settings').doc('app_settings').set(settings, { merge: true });
                console.log('⚙️ Settings saved to Settings DB');
            } catch (error) {
                console.error('Error saving settings to Settings DB:', error);
            }
        }

        // Always save to localStorage as backup
        localStorage.setItem(this.prefix + APP_CONFIG.keys.settings, JSON.stringify(settings));
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

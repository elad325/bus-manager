// ===================================
// מערכת ניהול אוטובוסים - אימות משתמשים
// ===================================
// אימות פשוט מבוסס localStorage
// ===================================

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.onAuthChangeCallback = null;
    }

    // Initialize Auth
    async init() {
        // Check for stored user session
        const storedUser = localStorage.getItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.currentUser);
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                this.currentUser = userData;
                this.isAdmin = userData.role === 'admin';

                if (this.onAuthChangeCallback) {
                    this.onAuthChangeCallback(this.currentUser, this.isAdmin);
                }
            } catch (e) {
                console.error('Error parsing stored user:', e);
            }
        }

        return true;
    }

    // Register new user
    async register(email, password) {
        const users = await window.storage.getUsers();

        // Check if email exists
        if (users.some(u => u.email === email)) {
            return { success: false, error: 'האימייל כבר קיים במערכת' };
        }

        // Validate password
        if (password.length < 6) {
            return { success: false, error: 'הסיסמה חייבת להכיל לפחות 6 תווים' };
        }

        // Create user
        const isFirstUser = users.length === 0;
        const role = isFirstUser ? 'admin' : 'viewer';
        const user = {
            uid: 'local_' + Date.now(),
            email: email,
            password: btoa(password), // Simple encoding (not secure, for demo only)
            role: role,
            approved: isFirstUser, // First user is auto-approved
            createdAt: new Date().toISOString()
        };

        await window.storage.saveUser(user);

        // Only set as current user if approved
        if (user.approved) {
            this.currentUser = { uid: user.uid, email: user.email, role: user.role };
            this.isAdmin = user.role === 'admin';

            localStorage.setItem(
                APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.currentUser,
                JSON.stringify(this.currentUser)
            );

            if (this.onAuthChangeCallback) {
                this.onAuthChangeCallback(this.currentUser, this.isAdmin);
            }

            return { success: true, user: this.currentUser };
        } else {
            // User needs approval
            if (this.onAuthChangeCallback) {
                this.onAuthChangeCallback(null, false, 'pending');
            }
            return { success: true, user: null, pending: true };
        }
    }

    // Login
    async login(email, password) {
        const users = await window.storage.getUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            return { success: false, error: 'משתמש לא נמצא' };
        }

        if (user.password !== btoa(password)) {
            return { success: false, error: 'סיסמה שגויה' };
        }

        // Check if user is approved
        if (!user.approved) {
            if (this.onAuthChangeCallback) {
                this.onAuthChangeCallback(null, false, 'pending');
            }
            return { success: false, error: 'החשבון ממתין לאישור מנהל', pending: true };
        }

        this.currentUser = { uid: user.uid, email: user.email, role: user.role };
        this.isAdmin = user.role === 'admin';

        localStorage.setItem(
            APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.currentUser,
            JSON.stringify(this.currentUser)
        );

        if (this.onAuthChangeCallback) {
            this.onAuthChangeCallback(this.currentUser, this.isAdmin);
        }

        return { success: true, user: this.currentUser };
    }

    // Logout
    async logout() {
        this.currentUser = null;
        this.isAdmin = false;

        localStorage.removeItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.currentUser);

        if (this.onAuthChangeCallback) {
            this.onAuthChangeCallback(null, false);
        }
    }

    // On auth state change
    onAuthChange(callback) {
        this.onAuthChangeCallback = callback;

        // Call immediately if user is already set
        if (this.currentUser) {
            callback(this.currentUser, this.isAdmin);
        }
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getUser() {
        return this.currentUser;
    }

    // Check admin status
    checkIsAdmin() {
        return this.isAdmin;
    }
}

// Create global instance
window.auth = new AuthService();

// ===================================
// מערכת ניהול אוטובוסים - אימות משתמשים
// ===================================

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.auth = null;
        this.useFirebase = false;
        this.onAuthChangeCallback = null;
    }

    // Initialize Firebase Auth
    async init() {
        const config = getFirebaseConfig();

        if (isFirebaseConfigured()) {
            try {
                // Initialize Firebase if not already done
                if (!firebase.apps.length) {
                    firebase.initializeApp(config);
                }

                this.auth = firebase.auth();
                this.useFirebase = true;

                // Initialize storage with Firestore
                window.storage.init(firebase.firestore());

                // Listen for auth state changes
                this.auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        await this.handleUserSignIn(user);
                    } else {
                        this.currentUser = null;
                        this.isAdmin = false;
                    }

                    if (this.onAuthChangeCallback) {
                        this.onAuthChangeCallback(this.currentUser, this.isAdmin);
                    }
                });

                return true;
            } catch (error) {
                console.error('Error initializing Firebase Auth:', error);
                return this.initLocalAuth();
            }
        }

        return this.initLocalAuth();
    }

    // Initialize local auth (for demo/offline mode)
    initLocalAuth() {
        this.useFirebase = false;

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

    // Handle user sign in
    async handleUserSignIn(firebaseUser) {
        let userData = await window.storage.getUserByUid(firebaseUser.uid);

        if (!userData) {
            // First user is admin and auto-approved, others need approval
            const users = await window.storage.getUsers();
            const isFirstUser = users.length === 0;

            userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: isFirstUser ? 'admin' : 'viewer',
                approved: isFirstUser, // First user is auto-approved
                createdAt: new Date().toISOString()
            };

            await window.storage.saveUser(userData);

            // If not first user, show pending message
            if (!isFirstUser) {
                this.currentUser = null;
                this.isAdmin = false;
                if (this.onAuthChangeCallback) {
                    this.onAuthChangeCallback(null, false, 'pending');
                }
                return;
            }
        }

        // Check if user is approved
        if (!userData.approved) {
            this.currentUser = null;
            this.isAdmin = false;
            if (this.onAuthChangeCallback) {
                this.onAuthChangeCallback(null, false, 'pending');
            }
            return;
        }

        this.currentUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: userData.role
        };
        this.isAdmin = userData.role === 'admin';
    }

    // Register new user
    async register(email, password) {
        if (this.useFirebase && this.auth) {
            try {
                const result = await this.auth.createUserWithEmailAndPassword(email, password);
                return { success: true, user: result.user };
            } catch (error) {
                return { success: false, error: this.getErrorMessage(error.code) };
            }
        }

        // Local registration
        return this.localRegister(email, password);
    }

    async localRegister(email, password) {
        const users = window.storage.getLocalUsers();

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

        window.storage.saveLocalUser(user);

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
        if (this.useFirebase && this.auth) {
            try {
                const result = await this.auth.signInWithEmailAndPassword(email, password);
                return { success: true, user: result.user };
            } catch (error) {
                return { success: false, error: this.getErrorMessage(error.code) };
            }
        }

        // Local login
        return this.localLogin(email, password);
    }

    async localLogin(email, password) {
        const users = window.storage.getLocalUsers();
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
        if (this.useFirebase && this.auth) {
            try {
                await this.auth.signOut();
            } catch (error) {
                console.error('Error signing out:', error);
            }
        }

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

    // Get error message in Hebrew
    getErrorMessage(errorCode) {
        const messages = {
            'auth/email-already-in-use': 'האימייל כבר קיים במערכת',
            'auth/invalid-email': 'כתובת אימייל לא תקינה',
            'auth/operation-not-allowed': 'פעולה זו אינה מורשית',
            'auth/weak-password': 'הסיסמה חלשה מדי',
            'auth/user-disabled': 'החשבון הושבת',
            'auth/user-not-found': 'משתמש לא נמצא',
            'auth/wrong-password': 'סיסמה שגויה',
            'auth/too-many-requests': 'יותר מדי ניסיונות, נסה שוב מאוחר יותר'
        };

        return messages[errorCode] || 'אירעה שגיאה, נסה שוב';
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

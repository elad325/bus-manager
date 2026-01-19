// ===================================
// מערכת ניהול אוטובוסים - אימות משתמשים
// ===================================
// אימות דרך GitHub - בטוח לחלוטין!
// ===================================

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.onAuthChangeCallback = null;
    }

    // Initialize Auth - check GitHub authentication
    async init() {
        // Check if GitHub is configured
        if (window.githubStorage && window.githubStorage.isConfigured()) {
            try {
                // Authenticate with GitHub
                const githubUser = await this.authenticateWithGitHub();

                if (githubUser) {
                    await this.handleUserSignIn(githubUser);
                    return true;
                }
            } catch (error) {
                console.error('GitHub authentication failed:', error);
            }
        }

        // No GitHub auth - show login page
        return true;
    }

    // Authenticate with GitHub using the configured token
    async authenticateWithGitHub() {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${window.githubStorage.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('GitHub authentication failed');
            }

            const user = await response.json();
            return {
                username: user.login,
                email: user.email || `${user.login}@github.com`,
                name: user.name || user.login,
                avatar: user.avatar_url
            };
        } catch (error) {
            console.error('Error authenticating with GitHub:', error);
            return null;
        }
    }

    // Handle user sign in
    async handleUserSignIn(githubUser) {
        // Check if user exists in our system
        let userData = await window.storage.getUserByUsername(githubUser.username);

        if (!userData) {
            // New user - check if first user
            const users = await window.storage.getUsers();
            const isFirstUser = users.length === 0;

            userData = {
                username: githubUser.username,
                email: githubUser.email,
                name: githubUser.name,
                avatar: githubUser.avatar,
                role: isFirstUser ? 'admin' : 'viewer',
                approved: isFirstUser,
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

        // User is authenticated and approved
        this.currentUser = {
            username: userData.username,
            email: userData.email,
            name: userData.name,
            avatar: userData.avatar,
            role: userData.role
        };
        this.isAdmin = userData.role === 'admin';

        // Store in localStorage for UI
        localStorage.setItem(
            APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.currentUser,
            JSON.stringify(this.currentUser)
        );

        if (this.onAuthChangeCallback) {
            this.onAuthChangeCallback(this.currentUser, this.isAdmin);
        }
    }

    // Login - redirect to GitHub setup if not configured
    async login() {
        if (!window.githubStorage || !window.githubStorage.isConfigured()) {
            return {
                success: false,
                error: 'נא להגדיר את GitHub בעמוד ההגדרות',
                needsSetup: true
            };
        }

        // Try to authenticate
        const githubUser = await this.authenticateWithGitHub();

        if (githubUser) {
            await this.handleUserSignIn(githubUser);

            if (this.currentUser) {
                return { success: true, user: this.currentUser };
            } else {
                return {
                    success: false,
                    error: 'החשבון ממתין לאישור מנהל',
                    pending: true
                };
            }
        }

        return {
            success: false,
            error: 'אימות GitHub נכשל - בדוק את הטוקן'
        };
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

// ===================================
// מערכת ניהול אוטובוסים - אימות (מבוטל)
// ===================================
// גישה פתוחה לכולם - ללא אימות!
// ===================================

class AuthService {
    constructor() {
        // No authentication - open access for everyone
        this.initialized = false;
    }

    // Initialize (does nothing - no authentication)
    async init() {
        this.initialized = true;
        return { success: true };
    }

    // Always returns success - no login required
    async login() {
        return { success: true };
    }

    // Does nothing - no logout needed
    async logout() {
        return { success: true };
    }

    // Always logged in (no authentication)
    isLoggedIn() {
        return true;
    }

    // Everyone has access
    getUser() {
        return { username: 'guest', email: 'guest@example.com' };
    }

    // Everyone is admin (no restrictions)
    checkIsAdmin() {
        return true;
    }

    // No auth state changes
    onAuthChange(callback) {
        // Do nothing
    }
}

// Create global instance
window.auth = new AuthService();

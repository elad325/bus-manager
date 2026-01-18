// ===================================
// מערכת ניהול אוטובוסים - אפליקציה ראשית
// ===================================

class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.initialized = false;
    }

    // Initialize the application
    async init() {
        try {
            // Initialize 3 separate Firebase databases
            await this.initFirebaseDatabases();

            // Initialize auth with Users DB
            await window.auth.init();

            // Set up auth state listener
            window.auth.onAuthChange((user, isAdmin) => {
                this.handleAuthChange(user, isAdmin);
            });

            // Check if user is already logged in
            if (window.auth.isLoggedIn()) {
                this.showMainApp();
            } else {
                this.showLoginPage();
            }

            this.setupEventListeners();
            this.hideLoadingScreen();
            this.initialized = true;

        } catch (error) {
            console.error('Error initializing app:', error);
            this.hideLoadingScreen();
            this.showLoginPage();
        }
    }

    // Initialize 3 separate Firebase databases
    async initFirebaseDatabases() {
        try {
            let usersDb = null;
            let dataDb = null;
            let settingsDb = null;

            // 👥 Initialize Users DB
            if (isFirebaseUsersConfigured()) {
                const usersConfig = getFirebaseUsersConfig();
                let usersApp;
                const existingUsersApp = firebase.apps.find(app => app.name === 'users');
                if (existingUsersApp) {
                    usersApp = existingUsersApp;
                } else {
                    usersApp = firebase.initializeApp(usersConfig, 'users');
                }
                usersDb = usersApp.firestore();
                console.log('👥 Users DB initialized');
            }

            // 🚌 Initialize Data DB
            if (isFirebaseDataConfigured()) {
                const dataConfig = getFirebaseDataConfig();
                let dataApp;
                const existingDataApp = firebase.apps.find(app => app.name === 'data');
                if (existingDataApp) {
                    dataApp = existingDataApp;
                } else {
                    dataApp = firebase.initializeApp(dataConfig, 'data');
                }
                dataDb = dataApp.firestore();
                console.log('🚌 Data DB initialized');
            }

            // ⚙️ Initialize Settings DB
            if (isFirebaseSettingsConfigured()) {
                const settingsConfig = getFirebaseSettingsConfig();
                let settingsApp;
                const existingSettingsApp = firebase.apps.find(app => app.name === 'settings');
                if (existingSettingsApp) {
                    settingsApp = existingSettingsApp;
                } else {
                    settingsApp = firebase.initializeApp(settingsConfig, 'settings');
                }
                settingsDb = settingsApp.firestore();
                console.log('⚙️ Settings DB initialized');
            }

            // Initialize storage with all 3 databases
            window.storage.init(dataDb, settingsDb, usersDb);

        } catch (error) {
            console.error('Error initializing Firebase databases:', error);
        }
    }

    // Setup global event listeners
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register button
        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.handleRegister());
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) this.navigateTo(page);
            });
        });

        // Settings forms
        const apiSettingsForm = document.getElementById('api-settings-form');
        if (apiSettingsForm) {
            apiSettingsForm.addEventListener('submit', (e) => this.handleApiSettings(e));
        }

        // Google Sheets settings
        const sheetsSettingsForm = document.getElementById('sheets-settings-form');
        if (sheetsSettingsForm) {
            sheetsSettingsForm.addEventListener('submit', (e) => this.handleSheetsSettings(e));
        }

        // Sheets sign in/out buttons
        const sheetsSignInBtn = document.getElementById('sheets-signin-btn');
        if (sheetsSignInBtn) {
            sheetsSignInBtn.addEventListener('click', () => window.sheetsStorage.signIn());
        }

        const sheetsSignOutBtn = document.getElementById('sheets-signout-btn');
        if (sheetsSignOutBtn) {
            sheetsSignOutBtn.addEventListener('click', () => window.sheetsStorage.signOut());
        }

        // Sync buttons
        const syncToSheetsBtn = document.getElementById('sync-to-sheets-btn');
        if (syncToSheetsBtn) {
            syncToSheetsBtn.addEventListener('click', () => window.sheetsStorage.syncToSheets());
        }

        const syncFromSheetsBtn = document.getElementById('sync-from-sheets-btn');
        if (syncFromSheetsBtn) {
            syncFromSheetsBtn.addEventListener('click', () => window.sheetsStorage.syncFromSheets());
        }

        // Modal overlay click to close
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.closeAllModals();
                }
            });
        }

        // Confirm delete button
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                if (this.pendingDeleteAction) {
                    this.pendingDeleteAction();
                    this.closeConfirmModal();
                }
            });
        }

        // Close confirm modal
        document.querySelectorAll('[data-close="confirm-modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeConfirmModal());
        });
    }

    // Handle auth state change
    async handleAuthChange(user, isAdmin) {
        if (user) {
            this.showMainApp();
            this.updateUserUI(user, isAdmin);
            await this.initializeModules();
        } else {
            this.showLoginPage();
        }
    }

    // Initialize sub-modules
    async initializeModules() {
        await window.busManager.init();
        await window.studentManager.init();
        await window.routeManager.init();

        // Try to initialize maps if key is available
        if (getGoogleMapsKey()) {
            await window.mapsService.init();
        }

        this.updateDashboardStats();
        this.loadSettingsValues();
    }

    // Show loading screen
    showLoadingScreen() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.remove('fade-out');
        }
    }

    // Hide loading screen
    hideLoadingScreen() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.add('fade-out');
            setTimeout(() => {
                loading.style.display = 'none';
            }, 500);
        }
    }

    // Show login page
    showLoginPage() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    // Show main app
    showMainApp() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.navigateTo('dashboard');
    }

    // Update user UI
    updateUserUI(user, isAdmin) {
        const emailEl = document.getElementById('user-email');
        const roleEl = document.getElementById('user-role');

        if (emailEl) emailEl.textContent = user.email;
        if (roleEl) roleEl.textContent = isAdmin ? 'מנהל' : 'צופה';

        // Show/hide admin-only elements
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });
    }

    // Navigate to page
    navigateTo(page) {
        this.currentPage = page;

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Show/hide pages
        document.querySelectorAll('.page-content').forEach(p => {
            p.classList.add('hidden');
        });

        const pageEl = document.getElementById(`${page}-page`);
        if (pageEl) {
            pageEl.classList.remove('hidden');
        }

        // Page-specific actions
        if (page === 'dashboard') {
            this.updateDashboardStats();
        }
    }

    // Handle login
    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        const btnText = document.getElementById('login-btn-text');

        errorEl.classList.add('hidden');
        btnText.textContent = 'מתחבר...';

        const result = await window.auth.login(email, password);

        if (result.success) {
            this.showMainApp();
        } else {
            errorEl.textContent = result.error;
            errorEl.classList.remove('hidden');
        }

        btnText.textContent = 'התחבר';
    }

    // Handle register
    async handleRegister() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');

        if (!email || !password) {
            errorEl.textContent = 'אנא מלא את כל השדות';
            errorEl.classList.remove('hidden');
            return;
        }

        errorEl.classList.add('hidden');

        const result = await window.auth.register(email, password);

        if (result.success) {
            if (result.pending) {
                // User registered but needs approval
                errorEl.textContent = 'ההרשמה בוצעה בהצלחה! החשבון ממתין לאישור מנהל.';
                errorEl.style.color = 'var(--warning)';
                errorEl.classList.remove('hidden');
            } else {
                this.showMainApp();
                this.showToast('החשבון נוצר בהצלחה!', 'success');
            }
        } else {
            errorEl.textContent = result.error;
            errorEl.style.color = 'var(--danger)';
            errorEl.classList.remove('hidden');
        }
    }

    // Handle logout
    async handleLogout() {
        await window.auth.logout();
        this.showLoginPage();
        this.showToast('התנתקת בהצלחה', 'success');
    }

    // Handle API settings
    async handleApiSettings(e) {
        e.preventDefault();

        const apiKey = document.getElementById('google-api-key').value.trim();
        saveGoogleMapsKey(apiKey);

        // Reinitialize maps
        if (apiKey) {
            await window.mapsService.init();
        }

        this.showToast('הגדרות API נשמרו בהצלחה', 'success');
    }

    // Handle Google Sheets settings
    async handleSheetsSettings(e) {
        e.preventDefault();

        const config = {
            clientId: document.getElementById('sheets-client-id').value.trim(),
            apiKey: document.getElementById('sheets-api-key').value.trim(),
            spreadsheetId: document.getElementById('sheets-spreadsheet-id').value.trim()
        };

        window.sheetsStorage.saveConfig(config);

        // Update status indicator
        const statusDot = document.querySelector('#sheets-status .status-dot');
        const statusText = document.querySelector('#sheets-status .status-text');

        if (config.clientId && config.apiKey && config.spreadsheetId) {
            try {
                const success = await window.sheetsStorage.init();
                if (success) {
                    statusDot.classList.add('connected');
                    statusText.textContent = 'מוכן - לחץ התחבר';
                    this.showToast('הגדרות Google Sheets נשמרו', 'success');
                } else {
                    statusDot.classList.remove('connected');
                    statusText.textContent = 'שגיאה באתחול';
                    this.showToast('שגיאה בהגדרת Google Sheets', 'error');
                }
            } catch (error) {
                statusDot.classList.remove('connected');
                statusText.textContent = 'שגיאה';
                this.showToast('שגיאה בהגדרת Google Sheets', 'error');
            }
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'לא מוגדר';
            this.showToast('יש למלא את כל השדות', 'warning');
        }
    }

    // Load settings values
    loadSettingsValues() {
        // Google API Key
        const googleKeyInput = document.getElementById('google-api-key');
        if (googleKeyInput) {
            googleKeyInput.value = getGoogleMapsKey();
        }

        // Google Sheets config
        const sheetsConfig = window.sheetsStorage.getConfig();
        const sheetsClientId = document.getElementById('sheets-client-id');
        const sheetsApiKey = document.getElementById('sheets-api-key');
        const sheetsSpreadsheetId = document.getElementById('sheets-spreadsheet-id');

        if (sheetsClientId) sheetsClientId.value = sheetsConfig.clientId || '';
        if (sheetsApiKey) sheetsApiKey.value = sheetsConfig.apiKey || '';
        if (sheetsSpreadsheetId) sheetsSpreadsheetId.value = sheetsConfig.spreadsheetId || '';

        // Update Sheets status
        const statusDot = document.querySelector('#sheets-status .status-dot');
        const statusText = document.querySelector('#sheets-status .status-text');

        if (statusDot && statusText) {
            if (sheetsConfig.clientId && sheetsConfig.apiKey && sheetsConfig.spreadsheetId) {
                statusText.textContent = 'מוגדר - לחץ התחבר';
            } else {
                statusDot.classList.remove('connected');
                statusText.textContent = 'לא מוגדר';
            }
        }

        // Load users list for admin
        this.loadUsersList();
    }

    // Load users list
    async loadUsersList() {
        if (!window.auth.checkIsAdmin()) return;

        const usersList = document.getElementById('users-list');
        if (!usersList) return;

        const users = await window.storage.getUsers();
        const pendingUsers = users.filter(u => !u.approved);
        const approvedUsers = users.filter(u => u.approved);

        if (users.length === 0) {
            usersList.innerHTML = '<p style="color: var(--text-muted);">אין משתמשים במערכת</p>';
            return;
        }

        let html = '';

        // Show pending users first
        if (pendingUsers.length > 0) {
            html += '<div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 193, 7, 0.1); border-radius: 0.5rem; border: 1px solid rgba(255, 193, 7, 0.3);">';
            html += `<h3 style="margin: 0 0 1rem 0; color: var(--warning);">⏳ משתמשים ממתינים לאישור (${pendingUsers.length})</h3>`;
            html += pendingUsers.map(user => `
                <div class="user-item" style="background: rgba(255, 255, 255, 0.05); margin-bottom: 0.5rem; padding: 0.75rem; border-radius: 0.5rem;">
                    <div class="user-info">
                        <span class="user-email-display">${this.escapeHtml(user.email)}</span>
                        <span class="user-role-badge" style="background: var(--warning);">ממתין</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary btn-sm approve-user-btn" data-user-id="${this.escapeHtml(user.uid)}">✓ אשר</button>
                        <button class="btn btn-danger btn-sm reject-user-btn" data-user-id="${this.escapeHtml(user.uid)}">✗ דחה</button>
                    </div>
                </div>

            `).join('');
            html += '</div>';
        }

        // Show approved users
        if (approvedUsers.length > 0) {
            html += `<h3 style="margin: 0 0 1rem 0;">✓ משתמשים מאושרים</h3>`;
            html += approvedUsers.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <span class="user-email-display">${this.escapeHtml(user.email)}</span>
                        <span class="user-role-badge">${user.role === 'admin' ? 'מנהל' : 'צופה'}</span>
                    </div>
                    ${user.uid !== window.auth.getUser()?.uid ? `
                    <select class="select-input user-role-select" style="width: auto;" data-user-id="${this.escapeHtml(user.uid)}">
                        <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>צופה</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>מנהל</option>
                    </select>
                    ` : ''}
                </div>
            `).join('');
        }

        usersList.innerHTML = html;

        // Add event listeners to role selects (safer than inline onchange)

        usersList.querySelectorAll('.user-role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const uid = e.target.getAttribute('data-user-id');
                this.updateUserRole(uid, e.target.value);
            });
        });


        // Add event listeners to approve buttons
        usersList.querySelectorAll('.approve-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.target.getAttribute('data-user-id');
                this.approveUser(uid);
            });
        });

        // Add event listeners to reject buttons
        usersList.querySelectorAll('.reject-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.target.getAttribute('data-user-id');
                this.rejectUser(uid);
            });
        });


    }

    // Update user role
    async updateUserRole(uid, role) {
        await window.storage.updateUserRole(uid, role);
        this.showToast('הרשאות המשתמש עודכנו', 'success');
    }

    // Approve user
    async approveUser(uid) {
        await window.storage.approveUser(uid);
        this.showToast('המשתמש אושר בהצלחה', 'success');
        this.loadUsersList(); // Reload users list
    }

    // Reject user
    async rejectUser(uid) {
        this.showConfirmModal(
            'האם אתה בטוח שברצונך לדחות משתמש זה?',
            async () => {
                await window.storage.rejectUser(uid);
                this.showToast('המשתמש נדחה', 'success');
                this.loadUsersList(); // Reload users list
            }
        );
    }

    // Update dashboard stats
    async updateDashboardStats() {
        const stats = await window.storage.getStats();

        const totalBuses = document.getElementById('total-buses');
        const totalStudents = document.getElementById('total-students');
        const totalRoutes = document.getElementById('total-routes');
        const totalUsers = document.getElementById('total-users');

        if (totalBuses) totalBuses.textContent = stats.totalBuses;
        if (totalStudents) totalStudents.textContent = stats.totalStudents;
        if (totalRoutes) totalRoutes.textContent = stats.totalRoutes;
        if (totalUsers) totalUsers.textContent = stats.totalUsers;

        // Update recent items
        this.updateRecentItems();
    }

    // Update recent items on dashboard
    async updateRecentItems() {
        const buses = await window.storage.getBuses();
        const students = await window.storage.getStudents();

        const recentBuses = document.getElementById('recent-buses');
        const recentStudents = document.getElementById('recent-students');

        if (recentBuses) {
            if (buses.length === 0) {
                recentBuses.innerHTML = '<p style="color: var(--text-muted);">אין אוטובוסים</p>';
            } else {
                recentBuses.innerHTML = buses.slice(-5).reverse().map(bus => `
                    <div class="list-item" style="display: flex; gap: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                        <span>🚌</span>
                        <span>${this.escapeHtml(bus.name)}</span>
                    </div>
                `).join('');
            }
        }

        if (recentStudents) {
            if (students.length === 0) {
                recentStudents.innerHTML = '<p style="color: var(--text-muted);">אין תלמידים</p>';
            } else {
                recentStudents.innerHTML = students.slice(-5).reverse().map(student => `
                    <div class="list-item" style="display: flex; gap: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                        <span>👨‍🎓</span>
                        <span>${this.escapeHtml(student.firstName)} ${this.escapeHtml(student.lastName)}</span>
                    </div>
                `).join('');
            }
        }
    }

    // Show confirm modal
    showConfirmModal(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const overlay = document.getElementById('modal-overlay');
        const messageEl = document.getElementById('confirm-message');

        if (messageEl) messageEl.textContent = message;

        this.pendingDeleteAction = onConfirm;

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
    }

    // Close confirm modal
    closeConfirmModal() {
        const modal = document.getElementById('confirm-modal');
        const overlay = document.getElementById('modal-overlay');

        if (modal) modal.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');

        this.pendingDeleteAction = null;
    }

    // Close all modals
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.getElementById('modal-overlay')?.classList.add('hidden');
    }

    // Show toast notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    // Escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global app instance and initialize
window.app = new App();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});

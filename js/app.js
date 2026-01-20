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
            // No authentication - direct access for everyone
            this.showMainApp();
            this.setupEventListeners();
            await this.initializeModules(); // Load settings and initialize modules
            this.hideLoadingScreen();
            this.initialized = true;

        } catch (error) {
            console.error('Error initializing app:', error);
            this.hideLoadingScreen();
            this.showMainApp();
        }
    }

    // Setup global event listeners
    setupEventListeners() {
        // No login/logout buttons - open access for everyone

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

        // GitHub settings
        const githubSettingsForm = document.getElementById('github-settings-form');
        if (githubSettingsForm) {
            githubSettingsForm.addEventListener('submit', (e) => this.handleGitHubSettings(e));
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

    // Authentication removed - direct access for everyone

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

    // Show main app
    showMainApp() {
        document.getElementById('main-app').classList.remove('hidden');
        this.navigateTo('dashboard');
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

    // Login/logout removed - open access for everyone

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

    // Handle GitHub settings
    async handleGitHubSettings(e) {
        e.preventDefault();

        const owner = document.getElementById('github-owner').value.trim();
        const repo = document.getElementById('github-repo').value.trim();
        const token = document.getElementById('github-token').value.trim();
        const branch = document.getElementById('github-branch').value.trim() || 'main';

        if (!owner || !repo || !token) {
            this.showToast('יש למלא את כל השדות', 'warning');
            return;
        }

        // Save config
        window.githubStorage.saveConfig(owner, repo, token, branch);

        // Test connection
        this.updateGitHubStatus(false, 'בודק חיבור...');

        const result = await window.githubStorage.testConnection();

        if (result.success) {
            this.updateGitHubStatus(true, `✅ מחובר ל-${result.repo.full_name}`);
            this.showToast('GitHub מוגדר בהצלחה! כל שינוי יישמר אוטומטית ב-Git', 'success');
        } else {
            this.updateGitHubStatus(false, `❌ שגיאה: ${result.error}`);
            this.showToast('שגיאה בחיבור ל-GitHub', 'error');
        }
    }

    // Update GitHub status indicator
    updateGitHubStatus(isConnected, message) {
        const statusDiv = document.getElementById('github-status');
        const statusDot = statusDiv.querySelector('.status-dot');
        const statusText = statusDiv.querySelector('.status-text');

        if (statusDiv) {
            statusDiv.style.display = 'flex';
        }

        if (statusDot) {
            if (isConnected) {
                statusDot.classList.add('connected');
            } else {
                statusDot.classList.remove('connected');
            }
        }

        if (statusText) {
            statusText.textContent = message;
        }
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

        // GitHub configuration
        const githubOwnerInput = document.getElementById('github-owner');
        const githubRepoInput = document.getElementById('github-repo');
        const githubBranchInput = document.getElementById('github-branch');
        const githubTokenInput = document.getElementById('github-token');

        // Auto-detect from URL
        const detected = GitHubStorage.autoDetectRepo();
        if (detected.detected) {
            if (githubOwnerInput) githubOwnerInput.value = detected.owner;
            if (githubRepoInput) githubRepoInput.value = detected.repo;
        }

        // Load existing config
        const githubConfig = localStorage.getItem('github_config');
        if (githubConfig) {
            try {
                const parsed = JSON.parse(githubConfig);
                if (githubOwnerInput) githubOwnerInput.value = parsed.owner || '';
                if (githubRepoInput) githubRepoInput.value = parsed.repo || '';
                if (githubBranchInput) githubBranchInput.value = parsed.branch || 'main';
                if (githubTokenInput) githubTokenInput.value = parsed.token || '';

                // Update status
                if (parsed.token && parsed.owner && parsed.repo) {
                    this.updateGitHubStatus(true, `מחובר ל-${parsed.owner}/${parsed.repo}`);
                }
            } catch (e) {
                console.error('Error loading GitHub config:', e);
            }
        }

        // User management removed - open access for everyone
    }

    // User management functions removed - open access for everyone

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

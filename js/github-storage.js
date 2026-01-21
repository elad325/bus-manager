// ===================================
// GitHub Storage - כתיבה ישירות ל-Git
// ===================================
// כל שינוי = commit אוטומטי ב-GitHub!
// ===================================

class GitHubStorage {
    constructor() {
        this.token = null;
        this.owner = null;  // Username/org
        this.repo = null;   // Repository name
        this.branch = 'main'; // או 'master'
        this.apiUrl = 'https://api.github.com';

        // Cache for file SHAs (needed for updates)
        this.fileCache = {};

        // Encryption key (simple obfuscation - NOT truly secure!)
        this.encryptionKey = 'BusManager2024-SecretKey-' + 'v1.0.0';

        this.loadConfig();
    }

    // Simple encryption (XOR cipher - NOT secure, just obfuscation)
    encrypt(text) {
        if (!text) return '';
        const key = this.encryptionKey;
        let encrypted = '';
        for (let i = 0; i < text.length; i++) {
            encrypted += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        // Encode to base64 to make it URL-safe
        return btoa(encrypted);
    }

    // Simple decryption
    decrypt(encryptedText) {
        if (!encryptedText) return '';
        try {
            const encrypted = atob(encryptedText);
            const key = this.encryptionKey;
            let decrypted = '';
            for (let i = 0; i < encrypted.length; i++) {
                decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return decrypted;
        } catch (e) {
            console.error('Decryption failed:', e);
            return '';
        }
    }

    // Load GitHub config from localStorage
    loadConfig() {
        const config = localStorage.getItem('github_config');
        if (config) {
            try {
                const parsed = JSON.parse(config);
                this.token = parsed.token;
                this.owner = parsed.owner;
                this.repo = parsed.repo;
                this.branch = parsed.branch || 'main';
                console.log(`📂 GitHub: ${this.owner}/${this.repo}@${this.branch}`);
            } catch (e) {
                console.error('Error loading GitHub config:', e);
            }
        }
    }

    // Save GitHub config to localStorage and GitHub
    async saveConfig(owner, repo, token, branch = 'main') {
        const config = { owner, repo, token, branch };
        localStorage.setItem('github_config', JSON.stringify(config));
        this.owner = owner;
        this.repo = repo;
        this.token = token;
        this.branch = branch;

        // Also backup encrypted token to GitHub (after setting it locally)
        await this.backupTokenToGitHub();
    }

    // Backup encrypted token to GitHub settings
    async backupTokenToGitHub() {
        if (!this.isConfigured()) {
            console.log('GitHub not configured, skipping backup');
            return;
        }

        try {
            // Get current settings
            let settings = {};
            try {
                settings = await window.storage.getSettings() || {};
            } catch (e) {
                console.log('No existing settings, creating new');
            }

            // Encrypt and save token
            const encryptedToken = this.encrypt(this.token);
            settings.githubToken = encryptedToken;
            settings.githubOwner = this.owner;
            settings.githubRepo = this.repo;
            settings.githubBranch = this.branch;

            await window.storage.saveSettings(settings);
            console.log('✅ GitHub token backed up to settings.json (encrypted)');
        } catch (error) {
            console.error('Failed to backup token to GitHub:', error);
            // Don't throw - backup is optional
        }
    }

    // Restore token from GitHub settings
    async restoreTokenFromGitHub(temporaryToken) {
        try {
            // Temporarily set token to fetch settings
            const originalToken = this.token;
            this.token = temporaryToken;

            const settings = await window.storage.getSettings();

            if (settings && settings.githubToken) {
                const decryptedToken = this.decrypt(settings.githubToken);
                const owner = settings.githubOwner;
                const repo = settings.githubRepo;
                const branch = settings.githubBranch || 'main';

                if (decryptedToken && owner && repo) {
                    // Save to localStorage
                    await this.saveConfig(owner, repo, decryptedToken, branch);
                    console.log('✅ Token restored from GitHub successfully');
                    return { success: true };
                } else {
                    throw new Error('Invalid or missing GitHub config in settings');
                }
            } else {
                throw new Error('No GitHub token found in settings.json');
            }
        } catch (error) {
            console.error('Failed to restore token from GitHub:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if GitHub is configured
    isConfigured() {
        return !!(this.token && this.owner && this.repo);
    }

    // Auto-detect owner/repo from current URL (GitHub Pages)
    static autoDetectRepo() {
        const url = window.location.href;

        // Pattern: https://username.github.io/repo-name/
        const githubPagesPattern = /https?:\/\/([^.]+)\.github\.io\/([^\/]+)/;
        const match = url.match(githubPagesPattern);

        if (match) {
            return {
                owner: match[1],
                repo: match[2],
                detected: true
            };
        }

        // If not GitHub Pages, return null
        return {
            owner: null,
            repo: null,
            detected: false
        };
    }

    // Get file from GitHub
    async getFile(path) {
        if (!this.isConfigured()) {
            throw new Error('GitHub not configured');
        }

        try {
            const url = `${this.apiUrl}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // File doesn't exist yet
                    return null;
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();

            // Cache the SHA for later updates
            this.fileCache[path] = data.sha;

            // Decode content from base64 (with proper UTF-8 support for Hebrew)
            const content = decodeURIComponent(escape(atob(data.content)));
            return JSON.parse(content);

        } catch (error) {
            console.error(`Error getting file ${path}:`, error);
            throw error;
        }
    }

    // Save file to GitHub (creates a commit!)
    async saveFile(path, content, message) {
        if (!this.isConfigured()) {
            throw new Error('GitHub not configured');
        }

        try {
            const url = `${this.apiUrl}/repos/${this.owner}/${this.repo}/contents/${path}`;

            // Get current file SHA to avoid conflicts
            let currentSHA = this.fileCache[path];

            // If we don't have the SHA cached, fetch it
            if (!currentSHA) {
                try {
                    const getResponse = await fetch(`${url}?ref=${this.branch}`, {
                        headers: {
                            'Authorization': `Bearer ${this.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (getResponse.ok) {
                        const fileData = await getResponse.json();
                        currentSHA = fileData.sha;
                        this.fileCache[path] = currentSHA;
                    }
                } catch (e) {
                    // File might not exist yet, that's ok
                    console.log(`File ${path} doesn't exist yet, creating new file`);
                }
            }

            // Convert content to JSON and encode to base64
            const jsonContent = JSON.stringify(content, null, 2);
            const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));

            const body = {
                message: message || `Update ${path}`,
                content: base64Content,
                branch: this.branch
            };

            // If file exists, include its SHA
            if (currentSHA) {
                body.sha = currentSHA;
            }

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();

                // If SHA mismatch, try to fetch fresh SHA and retry once
                if (error.message && error.message.includes('does not match')) {
                    console.log(`SHA mismatch for ${path}, fetching fresh SHA and retrying...`);
                    const getResponse = await fetch(`${url}?ref=${this.branch}`, {
                        headers: {
                            'Authorization': `Bearer ${this.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (getResponse.ok) {
                        const fileData = await getResponse.json();
                        body.sha = fileData.sha;
                        this.fileCache[path] = fileData.sha;

                        // Retry the save
                        const retryResponse = await fetch(url, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${this.token}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(body)
                        });

                        if (!retryResponse.ok) {
                            const retryError = await retryResponse.json();
                            throw new Error(`GitHub API error: ${retryError.message}`);
                        }

                        const retryData = await retryResponse.json();
                        this.fileCache[path] = retryData.content.sha;
                        console.log(`✅ Committed to GitHub: ${path} (retry succeeded)`);
                        return retryData;
                    }
                }

                throw new Error(`GitHub API error: ${error.message}`);
            }

            const data = await response.json();

            // Update cached SHA
            this.fileCache[path] = data.content.sha;

            console.log(`✅ Committed to GitHub: ${path}`);
            return data;

        } catch (error) {
            console.error(`Error saving file ${path}:`, error);
            throw error;
        }
    }

    // Get repository info
    async getRepoInfo() {
        if (!this.isConfigured()) {
            throw new Error('GitHub not configured');
        }

        try {
            const url = `${this.apiUrl}/repos/${this.owner}/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting repo info:', error);
            throw error;
        }
    }

    // Test GitHub connection
    async testConnection() {
        try {
            const info = await this.getRepoInfo();
            console.log(`✅ Connected to GitHub: ${info.full_name}`);
            return { success: true, repo: info };
        } catch (error) {
            console.error('❌ GitHub connection failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
window.githubStorage = new GitHubStorage();

// Authentication Manager
class AuthManager {
    constructor() {
        this.SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    }

    // Generate unique user ID
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Hash password (simple hash for demo - use bcrypt in production)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    // Validate email format
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Register new user
    async register(email, password, confirmPassword) {
        // Validate inputs
        if (!email || !password || !confirmPassword) {
            return { success: false, error: 'All fields are required' };
        }

        if (!this.isValidEmail(email)) {
            return { success: false, error: 'Invalid email format' };
        }

        if (password.length < 6) {
            return { success: false, error: 'Password must be at least 6 characters' };
        }

        if (password !== confirmPassword) {
            return { success: false, error: 'Passwords do not match' };
        }

        // Check if user already exists
        const result = await chrome.storage.local.get(['users']);
        const users = result.users || {};

        if (users[email]) {
            return { success: false, error: 'Email already registered' };
        }

        // Create new user
        const userId = this.generateUserId();
        const hashedPassword = this.hashPassword(password);

        users[email] = {
            id: userId,
            email: email,
            password: hashedPassword,
            createdAt: Date.now(),
            verified: false
        };

        await chrome.storage.local.set({ users });

        return { 
            success: true, 
            message: 'Registration successful! Please login.',
            userId: userId 
        };
    }

    // Login user
    async login(email, password) {
        // Validate inputs
        if (!email || !password) {
            return { success: false, error: 'Email and password are required' };
        }

        // Get users
        const result = await chrome.storage.local.get(['users']);
        const users = result.users || {};

        // Check if user exists
        if (!users[email]) {
            return { success: false, error: 'Invalid email or password' };
        }

        // Verify password
        const hashedPassword = this.hashPassword(password);
        if (users[email].password !== hashedPassword) {
            return { success: false, error: 'Invalid email or password' };
        }

        // Create session
        const sessionData = {
            userId: users[email].id,
            email: email,
            loginTime: Date.now(),
            expiresAt: Date.now() + this.SESSION_DURATION
        };

        await chrome.storage.local.set({ 
            currentSession: sessionData,
            isLoggedIn: true
        });

        return { 
            success: true, 
            message: 'Login successful!',
            user: {
                id: users[email].id,
                email: email
            }
        };
    }

    // Check if session is valid
    async isSessionValid() {
        const result = await chrome.storage.local.get(['currentSession', 'isLoggedIn']);
        
        if (!result.isLoggedIn || !result.currentSession) {
            return false;
        }

        const session = result.currentSession;
        const now = Date.now();

        // Check if session expired (30 days)
        if (now > session.expiresAt) {
            await this.logout();
            return false;
        }

        return true;
    }

    // Get current user
    async getCurrentUser() {
        const result = await chrome.storage.local.get(['currentSession']);
        if (!result.currentSession) {
            return null;
        }

        return {
            id: result.currentSession.userId,
            email: result.currentSession.email
        };
    }

    // Logout
    async logout() {
        await chrome.storage.local.remove(['currentSession', 'isLoggedIn']);
        return { success: true, message: 'Logged out successfully' };
    }

    // Change password
    async changePassword(email, oldPassword, newPassword) {
        const result = await chrome.storage.local.get(['users', 'currentSession']);
        const users = result.users || {};

        if (!users[email]) {
            return { success: false, error: 'User not found' };
        }

        const oldHash = this.hashPassword(oldPassword);
        if (users[email].password !== oldHash) {
            return { success: false, error: 'Current password is incorrect' };
        }

        if (newPassword.length < 6) {
            return { success: false, error: 'New password must be at least 6 characters' };
        }

        users[email].password = this.hashPassword(newPassword);
        await chrome.storage.local.set({ users });

        return { success: true, message: 'Password changed successfully' };
    }

    // Delete account
    async deleteAccount(email, password) {
        const result = await chrome.storage.local.get(['users']);
        const users = result.users || {};

        if (!users[email]) {
            return { success: false, error: 'User not found' };
        }

        const hashedPassword = this.hashPassword(password);
        if (users[email].password !== hashedPassword) {
            return { success: false, error: 'Incorrect password' };
        }

        delete users[email];
        await chrome.storage.local.set({ users });
        await this.logout();

        return { success: true, message: 'Account deleted successfully' };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
}

// Export for background script
if (typeof self !== 'undefined') {
    self.AuthManager = AuthManager;
}
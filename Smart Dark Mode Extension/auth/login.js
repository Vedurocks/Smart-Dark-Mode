// Login page logic
const authManager = new AuthManager();

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const registerConfirmPassword = document.getElementById('register-confirm-password');
    const registerBtn = document.getElementById('register-btn');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');

    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    // Show/Hide forms
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        clearMessages();
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        clearMessages();
    });

    // Clear all messages
    function clearMessages() {
        loginError.classList.add('hidden');
        loginError.textContent = '';
        registerError.classList.add('hidden');
        registerError.textContent = '';
        registerSuccess.classList.add('hidden');
        registerSuccess.textContent = '';
    }

    // Show error message
    function showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }

    // Show success message
    function showSuccess(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }

    // Login handler
    loginBtn.addEventListener('click', async () => {
        clearMessages();
        
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            showError(loginError, 'Please fill in all fields');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.classList.add('loading');

        const result = await authManager.login(email, password);

        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');

        if (result.success) {
            window.close();
        } else {
            showError(loginError, result.error);
        }
    });

    // Register handler
    registerBtn.addEventListener('click', async () => {
        clearMessages();

        const email = registerEmail.value.trim();
        const password = registerPassword.value;
        const confirmPassword = registerConfirmPassword.value;

        registerBtn.disabled = true;
        registerBtn.classList.add('loading');

        const result = await authManager.register(email, password, confirmPassword);

        registerBtn.disabled = false;
        registerBtn.classList.remove('loading');

        if (result.success) {
            showSuccess(registerSuccess, result.message);
            
            registerEmail.value = '';
            registerPassword.value = '';
            registerConfirmPassword.value = '';

            setTimeout(() => {
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                clearMessages();
            }, 2000);
        } else {
            showError(registerError, result.error);
        }
    });

    // Enter key support
    loginEmail.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginPassword.focus();
    });

    loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    registerEmail.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') registerPassword.focus();
    });

    registerPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') registerConfirmPassword.focus();
    });

    registerConfirmPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') registerBtn.click();
    });
});
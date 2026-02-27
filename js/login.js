/**
 * Login Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    if (isAuthenticated()) {
        const user = getCurrentUser();
        if (user && user.role) {
            redirectToDashboard(user.role);
        } else {
            // Clear invalid data and redirect to login
            logout();
        }
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('loginError');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const selectedRole = null; // Role will be determined from backend response

        // Validate
        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }

        // Show loading state
        const btn = loginForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Signing in...';
        btn.disabled = true;

        try {
            const { user, token } = await login(email, password);
            
            console.log('Login successful:', { user, token }); // Debug log
            
            // Check if user data exists
            if (!user || !user.role) {
                throw new Error('Invalid response from server: missing user data or role');
            }
            
            // Redirect to appropriate dashboard based on user role
            redirectToDashboard(user.role);
            
        } catch (error) {
            console.error('Login error:', error); // Debug log
            showError(error.message || 'Login failed. Please try again.');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    function redirectToDashboard(role) {
        switch(role) {
            case 'admin':
                window.location.href = 'admin-new.html';
                break;
            case 'driver':
                window.location.href = 'driver-new.html';
                break;
            case 'supplier':
                window.location.href = 'supplier.html';
                break;
            case 'manufacturer':
                window.location.href = 'manufacturer.html';
                break;
            default:
                window.location.href = 'admin.html';
        }
    }
});

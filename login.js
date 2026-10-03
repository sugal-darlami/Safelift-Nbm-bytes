/**
 * SafeLift 360 — Professional Login Page Logic (Stage 3.2 Real Authentication)
 */

(function () {
    'use strict';

    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const emailGroup = document.getElementById('emailGroup');
    const passwordGroup = document.getElementById('passwordGroup');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeOffIcon = document.getElementById('eyeOffIcon');
    const statusAlert = document.getElementById('statusAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertText = document.getElementById('alertText');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const signInBtn = document.getElementById('signInBtn');

    /**
     * Standard RFC-compliant email regex for frontend format check
     */
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Display a global alert banner above the form
     */
    function showAlert(type, message) {
        if (!statusAlert || !alertText) return;

        statusAlert.className = `status-alert ${type}`;
        alertText.textContent = message;

        if (type === 'error') {
            alertIcon.textContent = '⚠️';
        } else if (type === 'success') {
            alertIcon.textContent = '✓';
        } else {
            alertIcon.textContent = 'ℹ️';
        }

        statusAlert.style.display = 'flex';
    }

    /**
     * Hide the global alert banner
     */
    function hideAlert() {
        if (!statusAlert) return;
        statusAlert.style.display = 'none';
        statusAlert.className = 'status-alert';
    }

    /**
     * Set field error state
     */
    function setFieldError(groupEl, errorEl, message) {
        if (!groupEl || !errorEl) return;
        groupEl.classList.add('has-error');
        errorEl.textContent = message;
    }

    /**
     * Clear field error state
     */
    function clearFieldError(groupEl, errorEl) {
        if (!groupEl || !errorEl) return;
        groupEl.classList.remove('has-error');
        errorEl.textContent = '';
    }

    /**
     * Clear all errors
     */
    function clearAllErrors() {
        clearFieldError(emailGroup, emailError);
        clearFieldError(passwordGroup, passwordError);
        hideAlert();
    }

    /**
     * Validate the login inputs
     */
    function validateForm() {
        clearAllErrors();
        let isValid = true;
        let firstInvalidField = null;

        const emailValue = emailInput ? emailInput.value.trim() : '';
        const passwordValue = passwordInput ? passwordInput.value : '';

        // 1. Email validation
        if (!emailValue) {
            setFieldError(emailGroup, emailError, 'Please enter your email address.');
            isValid = false;
            firstInvalidField = firstInvalidField || emailInput;
        } else if (!isValidEmail(emailValue)) {
            setFieldError(emailGroup, emailError, 'Please enter a valid email address.');
            isValid = false;
            firstInvalidField = firstInvalidField || emailInput;
        }

        // 2. Password validation
        if (!passwordValue) {
            setFieldError(passwordGroup, passwordError, 'Please enter your password.');
            isValid = false;
            firstInvalidField = firstInvalidField || passwordInput;
        }

        if (!isValid && firstInvalidField) {
            firstInvalidField.focus();
        }

        return isValid;
    }

    /**
     * Handle Form Submission (Stage 3.2 Real Authentication API)
     */
    async function handleFormSubmit(e) {
        e.preventDefault();

        const isValid = validateForm();
        if (!isValid) {
            return;
        }

        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        const originalBtnHtml = signInBtn ? signInBtn.innerHTML : '';
        if (signInBtn) {
            signInBtn.disabled = true;
            signInBtn.innerHTML = '<span>Signing in...</span>';
        }
        hideAlert();

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // const targetPage = (data.user && data.user.role === 'admin') ? 'admin.html' : 'dashboard.html';
                // const destName = (data.user && data.user.role === 'admin') ? 'Admin Dashboard...' : 'Employee Dashboard...';
                let targetPage;
                let destName;

                if (data.user && data.user.role === 'super_admin') {
                    targetPage = 'super-admin.html';
                    destName = 'Super Admin Dashboard...';
                } else if (data.user && data.user.role === 'admin') {
                    targetPage = 'admin.html';
                    destName = 'Admin Dashboard...';
                } else {
                    targetPage = 'dashboard.html';
                    destName = 'Employee Dashboard...';
                } //
                showAlert('success', `Login successful! Redirecting to ${destName}`);

                if (emailInput) emailInput.disabled = true;
                if (passwordInput) passwordInput.disabled = true;

                setTimeout(() => {
                    window.location.href = targetPage;
                }, 1000);
            } else {
                showAlert('error', data.message || 'Invalid email or password.');
                if (signInBtn) {
                    signInBtn.disabled = false;
                    signInBtn.innerHTML = originalBtnHtml;
                }
            }

        } catch (err) {
            console.error('Login fetch error:', err);
            showAlert('error', 'Network error. Unable to connect to server.');
            if (signInBtn) {
                signInBtn.disabled = false;
                signInBtn.innerHTML = originalBtnHtml;
            }
        }
    }

    /**
     * Toggle Password Visibility
     */
    function togglePasswordVisibility() {
        if (!passwordInput || !togglePasswordBtn) return;

        const isCurrentlyPassword = passwordInput.getAttribute('type') === 'password';

        if (isCurrentlyPassword) {
            passwordInput.setAttribute('type', 'text');
            togglePasswordBtn.setAttribute('aria-label', 'Hide password');
            if (eyeIcon) eyeIcon.classList.add('hidden');
            if (eyeOffIcon) eyeOffIcon.classList.remove('hidden');
        } else {
            passwordInput.setAttribute('type', 'password');
            togglePasswordBtn.setAttribute('aria-label', 'Show password');
            if (eyeIcon) eyeIcon.classList.remove('hidden');
            if (eyeOffIcon) eyeOffIcon.classList.add('hidden');
        }
    }

    /**
     * Handle "Forgot your password?" click
     */
    function handleForgotPassword(e) {
        e.preventDefault();
        showAlert('info', 'Please contact your administrator to reset your password.');
    }

    // Attach Event Listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleFormSubmit);
    }

    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    }

    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', handleForgotPassword);
    }

    // Clear field-level errors dynamically on user input
    if (emailInput) {
        emailInput.addEventListener('input', function () {
            clearFieldError(emailGroup, emailError);
            if (statusAlert && statusAlert.classList.contains('error')) {
                hideAlert();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', function () {
            clearFieldError(passwordGroup, passwordError);
            if (statusAlert && statusAlert.classList.contains('error')) {
                hideAlert();
            }
        });
    }

    // Expose helpers for automated testing if window is present
    if (typeof window !== 'undefined') {
        window.SafeLiftLogin = {
            validateForm: validateForm,
            isValidEmail: isValidEmail,
            togglePasswordVisibility: togglePasswordVisibility,
            showAlert: showAlert,
            hideAlert: hideAlert
        };
    }
})();

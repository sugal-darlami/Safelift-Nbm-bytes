/**
 * SafeLift 360 — Company Registration Request Logic (Stage 6.2)
 */

(function () {
    'use strict';

    // DOM Elements
    const registerForm = document.getElementById('registerForm');
    const formContainer = document.getElementById('formContainer');
    const successCard = document.getElementById('successCard');

    const companyNameInput = document.getElementById('companyNameInput');
    const contactPersonInput = document.getElementById('contactPersonInput');
    const emailInput = document.getElementById('emailInput');
    const phoneInput = document.getElementById('phoneInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');

    const companyNameGroup = document.getElementById('companyNameGroup');
    const contactPersonGroup = document.getElementById('contactPersonGroup');
    const emailGroup = document.getElementById('emailGroup');
    const phoneGroup = document.getElementById('phoneGroup');
    const passwordGroup = document.getElementById('passwordGroup');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');

    const companyNameError = document.getElementById('companyNameError');
    const contactPersonError = document.getElementById('contactPersonError');
    const emailError = document.getElementById('emailError');
    const phoneError = document.getElementById('phoneError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');

    const submitRequestBtn = document.getElementById('submitRequestBtn');
    const statusAlert = document.getElementById('statusAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertText = document.getElementById('alertText');

    /**
     * Standard RFC-compliant email regex
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
     * Clear all field errors and global alert
     */
    function clearAllErrors() {
        clearFieldError(companyNameGroup, companyNameError);
        clearFieldError(contactPersonGroup, contactPersonError);
        clearFieldError(emailGroup, emailError);
        clearFieldError(phoneGroup, phoneError);
        clearFieldError(passwordGroup, passwordError);
        clearFieldError(confirmPasswordGroup, confirmPasswordError);
        hideAlert();
    }

    /**
     * Validate the company registration inputs on client side
     */
    function validateForm() {
        clearAllErrors();
        let isValid = true;
        let firstInvalidField = null;

        const companyNameVal = companyNameInput ? companyNameInput.value.trim() : '';
        const contactPersonVal = contactPersonInput ? contactPersonInput.value.trim() : '';
        const emailVal = emailInput ? emailInput.value.trim() : '';
        const passwordVal = passwordInput ? passwordInput.value : '';
        const confirmPasswordVal = confirmPasswordInput ? confirmPasswordInput.value : '';

        // 1. Company Name Validation
        if (!companyNameVal) {
            setFieldError(companyNameGroup, companyNameError, 'Please enter your company name.');
            isValid = false;
            firstInvalidField = firstInvalidField || companyNameInput;
        }

        // 2. Contact Person Validation
        if (!contactPersonVal) {
            setFieldError(contactPersonGroup, contactPersonError, 'Please enter the contact person / owner name.');
            isValid = false;
            firstInvalidField = firstInvalidField || contactPersonInput;
        }

        // 3. Email Validation
        if (!emailVal) {
            setFieldError(emailGroup, emailError, 'Please enter your business email address.');
            isValid = false;
            firstInvalidField = firstInvalidField || emailInput;
        } else if (!isValidEmail(emailVal)) {
            setFieldError(emailGroup, emailError, 'Please enter a valid business email address.');
            isValid = false;
            firstInvalidField = firstInvalidField || emailInput;
        }

        // 4. Password Validation
        if (!passwordVal) {
            setFieldError(passwordGroup, passwordError, 'Please enter your password.');
            isValid = false;
            firstInvalidField = firstInvalidField || passwordInput;
        } else if (passwordVal.length < 8) {
            setFieldError(passwordGroup, passwordError, 'Password must be at least 8 characters.');
            isValid = false;
            firstInvalidField = firstInvalidField || passwordInput;
        }

        // 5. Confirm Password Validation
        if (!confirmPasswordVal) {
            setFieldError(confirmPasswordGroup, confirmPasswordError, 'Please confirm your password.');
            isValid = false;
            firstInvalidField = firstInvalidField || confirmPasswordInput;
        } else if (passwordVal !== confirmPasswordVal) {
            setFieldError(confirmPasswordGroup, confirmPasswordError, 'Passwords do not match.');
            isValid = false;
            firstInvalidField = firstInvalidField || confirmPasswordInput;
        }

        if (!isValid && firstInvalidField) {
            firstInvalidField.focus();
        }

        return isValid;
    }

    /**
     * Handle Company Registration Form Submission
     */
    async function handleFormSubmit(e) {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const companyName = companyNameInput.value.trim();
        const contactPerson = contactPersonInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Loading UI state
        submitRequestBtn.disabled = true;
        const originalBtnHtml = submitRequestBtn.innerHTML;
        submitRequestBtn.innerHTML = '<span>Submitting Request...</span>';
        hideAlert();

        try {
            const response = await fetch('/api/company/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    company_name: companyName,
                    contact_person: contactPerson,
                    email: email,
                    phone: phone,
                    password: password,
                    confirm_password: confirmPassword
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Show submission confirmation UI (NO AUTO LOGIN)
                if (formContainer) formContainer.style.display = 'none';
                if (successCard) successCard.style.display = 'block';
            } else {
                // Server validation error or duplicate request
                showAlert('error', data.message || 'Submission failed. Please try again.');
                submitRequestBtn.disabled = false;
                submitRequestBtn.innerHTML = originalBtnHtml;
            }

        } catch (err) {
            console.error('Company Registration API fetch error:', err);
            showAlert('error', 'Network error. Unable to reach server. Please check your connection.');
            submitRequestBtn.disabled = false;
            submitRequestBtn.innerHTML = originalBtnHtml;
        }
    }

    // Attach Event Listeners
    if (registerForm) {
        registerForm.addEventListener('submit', handleFormSubmit);
    }

    // Dynamic error clearing on user input
    if (companyNameInput) {
        companyNameInput.addEventListener('input', () => clearFieldError(companyNameGroup, companyNameError));
    }
    if (contactPersonInput) {
        contactPersonInput.addEventListener('input', () => clearFieldError(contactPersonGroup, contactPersonError));
    }
    if (emailInput) {
        emailInput.addEventListener('input', () => clearFieldError(emailGroup, emailError));
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', () => clearFieldError(phoneGroup, phoneError));
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', () => clearFieldError(passwordGroup, passwordError));
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => clearFieldError(confirmPasswordGroup, confirmPasswordError));
    }

})();

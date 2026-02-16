// --------------------------------------------------------------------
// LOGIC & BEHAVIOR
// --------------------------------------------------------------------

// --------------------------------------------------------------------
// DEBUGGING: CHECK STATUS ON PAGE LOAD
// --------------------------------------------------------------------
const savedUser = localStorage.getItem('earnova_user');
console.log("------------------------------------------------");
console.log("[DEBUG] Current LocalStorage Status:", savedUser ? "User Found" : "Empty (No Account)");
if (savedUser) {
    console.log("[DEBUG] User Data:", JSON.parse(savedUser));
}
console.log("------------------------------------------------");


// Selectors
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const paymentModal = document.getElementById('payment-modal');

// Forms
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// Payment elements
const paystackPayBtn = document.getElementById('paystack-pay-btn');
const resetLoginBtn = document.getElementById('reset-login-btn');

// Store user data temporarily for payment
let tempUserData = {
    name: '',
    email: '',
    password: ''
};

// Toggle View Function
function toggleView(target) {
    // -----------------------------------------------------------
    // FUNCTIONALITY: Check if user exists before showing signup
    // -----------------------------------------------------------
    if (target === 'signup') {
        const existingUser = localStorage.getItem('earnova_user');
        
        if (existingUser) {
            console.log("[DEBUG] Blocked Signup: User already exists.");
            alert('You already have an account on this device. Please log in.');
            return; // Stop execution
        }
    }
    // -----------------------------------------------------------

    // Add a fade out effect
    const active = target === 'signup' ? loginView : signupView;
    const next = target === 'signup' ? signupView : loginView;

    active.style.opacity = '0';
    active.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
        active.style.display = 'none';
        next.style.display = 'block';
        // Trigger reflow
        void next.offsetWidth; 
        next.style.opacity = '1';
        next.style.transform = 'translateY(0)';
        
        // Reset inputs when switching
        clearErrors();
    }, 300);
}

// Helper: Validate Email
const isValidEmail = (email) => {
    return String(email).toLowerCase().match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

// Clear Errors
function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
}

// Show Error
function showError(inputId, msgId) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(msgId).classList.add('visible');
    // Shake animation
    const group = document.getElementById(inputId).parentElement;
    group.animate([
        { transform: 'translateX(0)' }, 
        { transform: 'translateX(-5px)' }, 
        { transform: 'translateX(5px)' }, 
        { transform: 'translateX(0)' }
    ], { duration: 300 });
}

// Initialize Paystack Payment
function initPaystackPayment() {
    const paystackPublicKey = 'pk_test_335a79da994d7c1777f46c1ef44abf7f4535491a';
    
    const handler = PaystackPop.setup({
        key: paystackPublicKey,
        email: tempUserData.email,
        amount: 3000 * 100, // Amount in kobo (₦3,000)
        ref: '' + Math.floor((Math.random() * 1000000000) + 1), // Generate unique reference
        onClose: function() {
            alert('Payment window was closed without completing payment. Please try again.');
        },
        onSuccess: function(response) {
            // Prepare User Data
            const newUser = {
                name: tempUserData.name,
                email: tempUserData.email,
                password: tempUserData.password,
                paymentRef: response.reference
            };

            // Store complete user data in localStorage
            localStorage.setItem('earnova_user', JSON.stringify(newUser));
            
            // DEBUG: Show in console
            console.log("[DEBUG] PAYMENT SUCCESSFUL. SAVED NEW USER:", newUser);

            // Alert user with payment reference
            alert('Payment successful! Account Created. Reference: ' + response.reference);
            
            // Hide the Pay Now button
            paystackPayBtn.style.display = 'none';

            // Auto-redirect or reset to login view so they can login now
            setTimeout(() => {
                resetToLogin();
                alert('Please log in with your new details.');
            }, 1000);
        }
    });
    handler.openIframe();
}

// Paystack Pay Button Handler
paystackPayBtn.addEventListener('click', (e) => {
    e.preventDefault();
    initPaystackPayment();
});

// Login Submit Handler
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();
    
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    let valid = true;

    if (!isValidEmail(email)) {
        showError('login-email', 'login-email-error');
        valid = false;
    }

    if (valid) {
        const btn = loginForm.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Verifying...';
        btn.style.opacity = '0.7';
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.opacity = '1';

            // Check against LocalStorage
            const storedUserStr = localStorage.getItem('earnova_user');
            
            console.log("[DEBUG] Attempting Login...");
            console.log("[DEBUG] Stored User:", storedUserStr);

            if (storedUserStr) {
                const storedUser = JSON.parse(storedUserStr);
                if (email === storedUser.email && pass === storedUser.password) {
                    alert('Login successful! Redirecting to Dashboard...');
                    // Here you would typically redirect: window.location.href = 'dashboard.html';
                } else {
                    console.log("[DEBUG] Login Failed: Password or Email mismatch");
                    alert('Invalid email or password.');
                }
            } else {
                console.log("[DEBUG] Login Failed: No user found in storage");
                alert('No account found. Please create an account (if you haven\'t already).');
            }
        }, 1500);
    }
});

// Signup Submit Handler
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();
    
    // SAFETY CHECK: Double check storage before processing signup
    if (localStorage.getItem('earnova_user')) {
        console.log("[DEBUG] Signup Prevented: User already exists.");
        alert('You already have an account on this device. Please log in.');
        return;
    }

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const confirm = document.getElementById('reg-confirm').value;
    let valid = true;

    if (name.length < 2) {
        showError('reg-name', 'reg-name-error');
        valid = false;
    }

    if (!isValidEmail(email)) {
        showError('reg-email', 'reg-email-error');
        valid = false;
    }

    if (pass.length < 6) {
        showError('reg-pass', 'reg-pass-error');
        valid = false;
    }

    if (pass !== confirm) {
        showError('reg-confirm', 'reg-confirm-error');
        valid = false;
    }

    if (valid) {
        // Double check localStorage just in case they manually manipulated the DOM
        if (localStorage.getItem('earnova_user')) {
            alert('An account already exists. Please refresh and log in.');
            return;
        }

        // Store data temporarily until payment is confirmed
        tempUserData = {
            name: name,
            email: email,
            password: pass
        };
        
        // Success! Show Payment Modal
        const btn = signupForm.querySelector('button');
        btn.innerText = 'Processing...';
        
        setTimeout(() => {
            btn.innerText = 'Create Account';
            // Hide Card
            document.querySelector('.auth-card').style.opacity = '0';
            document.querySelector('.auth-card').style.transform = 'scale(0.9)';
            
            // Reset Pay Now button for new payment attempt
            paystackPayBtn.style.display = 'block';
            
            // Show Overlay
            paymentModal.classList.add('active');
        }, 1000);
    }
});

// Reset to Login from Modal
function resetToLogin() {
    paymentModal.classList.remove('active');
    
    setTimeout(() => {
        // Reset Forms
        signupForm.reset();
        loginForm.reset();
        
        // Show Card again
        document.querySelector('.auth-card').style.opacity = '1';
        document.querySelector('.auth-card').style.transform = 'scale(1) translateY(0)';
        
        // Go to login view
        signupView.style.display = 'none';
        loginView.style.display = 'block';
        loginView.style.opacity = '1';
        
        // Reset temporary data
        tempUserData = { name: '', email: '', password: '' };
        paystackPayBtn.style.display = 'block';
    }, 300);
}

// Floating label effect / Focus styling logic (optional JS enhancement)
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', () => {
        input.parentElement.querySelector('label').style.color = 'var(--primary-blue)';
    });
    input.addEventListener('blur', () => {
        input.parentElement.querySelector('label').style.color = 'var(--text-primary)';
    });
});

// Expose toggleView to window for HTML access
window.toggleView = toggleView;
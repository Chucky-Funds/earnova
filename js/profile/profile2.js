

   /* ------------------------------------------------------------
       script 3
    ------------------------------------------------------------ */

// Delete Account Handler
document.addEventListener('DOMContentLoaded', function () {
    var deleteBtn = document.getElementById('delete-account-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
            if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
            var currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            if (!currentUser.email) return;
            var accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
            accounts = accounts.filter(function(acc) { return acc.email !== currentUser.email; });
            localStorage.setItem('accounts', JSON.stringify(accounts));
            sessionStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
    }
});










   /* ------------------------------------------------------------
       script 4
    ------------------------------------------------------------ */
    
// Password Update Handler
document.addEventListener('DOMContentLoaded', function () {
    var updatePasswordBtn = document.getElementById('update-password-btn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var currentInput = document.getElementById('current-password-input');
            var newInput = document.getElementById('new-password-input');
            var currentPassword = currentInput.value;
            var newPassword = newInput.value;
            if (!currentPassword || !newPassword) {
                alert('Please fill in both password fields.');
                return;
            }
            var currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            if (!currentUser.password || currentUser.password !== currentPassword) {
                alert('Current password is incorrect.');
                return;
            }
            if (currentPassword === newPassword) {
                alert('New password must be different from the current password.');
                return;
            }
            // Update password in sessionStorage
            currentUser.password = newPassword;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            // Update password in localStorage accounts
            var accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
            var idx = accounts.findIndex(function(acc) { return acc.email === currentUser.email; });
            if (idx !== -1) {
                accounts[idx].password = newPassword;
                localStorage.setItem('accounts', JSON.stringify(accounts));
            }
            currentInput.value = '';
            newInput.value = '';
            alert('Password updated successfully!');
        });
    }
});












   /* ------------------------------------------------------------
       script 5
    ------------------------------------------------------------ */
    
// Profile Update Handler
document.addEventListener('DOMContentLoaded', function () {
    var updateBtn = document.getElementById('update-profile-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var nameInput = document.getElementById('profile-fullname');
            var emailInput = document.getElementById('profile-email');
            var newName = nameInput.value.trim();
            var newEmail = emailInput.value.trim();
            if (!newName) {
                alert('Full name cannot be empty.');
                return;
            }
            if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
                alert('Please enter a valid email address.');
                return;
            }
            // Get current user and old email
            var currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            var oldEmail = currentUser.email;
            // Check if new email is already used by another account
            var accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
            var emailTaken = accounts.some(function(acc) { return acc.email === newEmail && acc.email !== oldEmail; });
            if (emailTaken) {
                alert('This email is already in use by another account.');
                return;
            }
            // Update sessionStorage
            currentUser.name = newName;
            currentUser.email = newEmail;
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            // Update localStorage accounts
            var idx = accounts.findIndex(function(acc) { return acc.email === oldEmail; });
            if (idx !== -1) {
                accounts[idx].name = newName;
                accounts[idx].email = newEmail;
                localStorage.setItem('accounts', JSON.stringify(accounts));
            }
            // Update UI (welcome message, avatar, etc.)
            var welcome = document.querySelector('.page-title');
            if (welcome) welcome.textContent = 'Welcome back, ' + newName.split(' ')[0];
            var avatar = document.querySelector('.avatar');
            if (avatar) {
                var initials = newName.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
                avatar.textContent = initials;
            }
            alert('Profile updated successfully! You can now log in with your new email.');
        });
    }
});











   /* ------------------------------------------------------------
       script 5
    ------------------------------------------------------------ */
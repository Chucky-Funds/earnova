// Paystack Public Key
const PAYSTACK_PUBLIC_KEY = 'pk_test_335a79da994d7c1777f46c1ef44abf7f4535491a';

// Level table for daily question limit
function getDailyQuestionLimit(xp) {
  if (xp < 500) return 1;     // Level 1
  if (xp < 750) return 2;     // Level 2
  if (xp < 1125) return 3;    // Level 3
  if (xp < 1688) return 4;    // Level 4
  if (xp < 2532) return 6;    // Level 5
  if (xp < 3798) return 7;    // Level 6
  if (xp < 5697) return 8;    // Level 7
  if (xp < 8546) return 9;    // Level 8
  if (xp < 12819) return 12;  // Level 9
  if (xp < 19229) return 13;  // Level 10
  if (xp < 28844) return 16;  // Level 11
  if (xp < 43266) return 18;  // Level 12
  if (xp < 64899) return 21;  // Level 13
  if (xp < 97349) return 24;  // Level 14
  return 24;                  // Level 15 (Final)
}

// Returns today's answered count, resets if date changed
function checkDailyQuestionLimit() {
  const today = new Date().toLocaleDateString();
  const storedDate = localStorage.getItem('earnova_last_question_date');
  let answeredToday = parseInt(localStorage.getItem('earnova_daily_question_count')) || 0;
  if (storedDate !== today) {
    answeredToday = 0;
    localStorage.setItem('earnova_last_question_date', today);
    localStorage.setItem('earnova_daily_question_count', 0);
  }
  return answeredToday;
}

// Increments today's answered count
function incrementDailyQuestion() {
  let answeredToday = checkDailyQuestionLimit();
  answeredToday++;
  localStorage.setItem('earnova_daily_question_count', answeredToday);
  localStorage.setItem('earnova_last_question_date', new Date().toLocaleDateString());
}

// Wrapper for question card click
window.handleQuestionClick = function(index, surveyId) {
  // Defensive: ensure SURVEY_DATA exists
  if (!Array.isArray(SURVEY_DATA) || SURVEY_DATA.length === 0) return;
  
  const completedArr = getCompletedQuestionCards();
  const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
  const limit = getDailyQuestionLimit(currentXP);
  const answeredToday = checkDailyQuestionLimit();
  
  // Check 1: Already completed
  if (completedArr.includes(surveyId)) {
    alert('You have already answered this question.');
    return;
  }
  
  // Check 2: Daily limit
  if (answeredToday >= limit) {
    // Assuming getLevel is available globally (defined in html script or here)
    const lvl = typeof getLevel === 'function' ? getLevel(currentXP) : 1;
    alert(`Daily Question Limit Reached! Level ${lvl} allows ${limit} questions per day.`);
    return;
  }
  
  // Success: open modal for the correct survey
  let surveyIdx = -1;
  for (let i = 0; i < SURVEY_DATA.length; i++) {
    if (SURVEY_DATA[i].id == surveyId) { surveyIdx = i; break; }
  }
  
  // Fallback if ID lookup fails
  if (surveyIdx === -1) surveyIdx = index % SURVEY_DATA.length;
  
  if (typeof openSurveyModal === 'function') openSurveyModal(surveyIdx);
};

// UI updater for question cards
function updateQuestionUI() {
  const completedArr = getCompletedQuestionCards();
  const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
  const limit = getDailyQuestionLimit(currentXP);
  const answeredToday = checkDailyQuestionLimit();
  const isLimitReached = answeredToday >= limit;
  
  const cards = document.querySelectorAll('.task-card[id^="q-card-"]');
  
  cards.forEach(card => {
    const surveyId = card.getAttribute('data-survey-id');
    const btn = card.querySelector('button');
    
    // Reset state first
    card.classList.remove('completed');
    card.style.opacity = '';
    card.style.cursor = '';
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Perform Task';
      btn.style.opacity = '';
      btn.style.cursor = '';
    }
    
    // Check Completed State
    if (completedArr.includes(surveyId)) {
      card.classList.add('completed');
      card.style.opacity = '0.5';
      card.style.cursor = 'not-allowed';
      if (btn) {
        btn.innerText = 'Completed';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }
      return;
    }
    
    // Check Daily Limit State
    if (isLimitReached) {
      card.classList.add('completed'); 
      card.style.opacity = '0.5';
      card.style.cursor = 'not-allowed';
      if (btn) {
        btn.innerText = 'Daily Limit';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }
    }
  });
}

// Call updateQuestionUI on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateQuestionUI);
} else {
  updateQuestionUI();
}

// Hook: after survey reward is claimed, increment and update UI
(function() {
  if (!window._questionLimitPatched) {
    const origMark = window.markQuestionCardCompleted;
    window.markQuestionCardCompleted = function(survey) {
      if (origMark) origMark.apply(this, arguments);
      incrementDailyQuestion();
      updateQuestionUI();
    };
    window._questionLimitPatched = true;
  }
})();

// Earnova: payment-gated auth and profile population
(function(){
  'use strict';

  function getAccounts(){
    return JSON.parse(localStorage.getItem('accounts') || '[]');
  }

  function saveAccounts(accounts){
    localStorage.setItem('accounts', JSON.stringify(accounts));
  }

  // Debug helpers
  window.viewAllAccounts = function(){ console.log(getAccounts()); };
  window.clearAllAccounts = function(){ localStorage.removeItem('accounts'); console.log('accounts cleared'); };

  let signupForm = document.getElementById('signup-form');
  let loginForm = document.getElementById('login-form');
  let paymentModal = document.getElementById('payment-modal');
  let paystackPayBtn = document.getElementById('paystack-pay-btn');

  let tempAccount = null;

  function replaceWithClone(el){
    if(!el || !el.parentNode) return el;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }

  function showPaymentModalFor(account){
    tempAccount = Object.assign({}, account, { paymentCompleted: false });
    const details = document.querySelector('.payment-details');
    if(details){
      details.innerHTML = `
        <div class="payment-row"><span class="payment-label">Amount:</span><span class="payment-value" style="color: var(--secondary-orange);">₦3,000.00</span></div>
      `;
    }
    if(paymentModal) paymentModal.classList.add('active');
  }

  function closePaymentModal(){
    if(paymentModal) paymentModal.classList.remove('active');
    tempAccount = null;
  }

  function initPaystackForTempAccount(){
    if(!tempAccount) return;
    if(typeof PaystackPop === 'undefined'){
      closePaymentModal();
      return;
    }

    const handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: tempAccount.email,
      amount: 300000, // ₦3,000 in kobo
      currency: 'NGN',
      callback: function(response){
        tempAccount.paymentCompleted = true;
        addPaidAccount(tempAccount);
        try{ sessionStorage.setItem('currentUser', JSON.stringify(tempAccount)); }catch(e){}
        closePaymentModal();
        alert('Payment successful! Your account is now activated.');
        if(typeof toggleView === 'function'){
          toggleView('login');
        } else {
          window.location.href = 'login.html';
        }
      },
      onClose: function(){
        closePaymentModal();
      }
    });
    handler.openIframe();
  }
  
  function addPaidAccount(account){
    const accounts = getAccounts();
    const exists = accounts.some(a => a.email === account.email);
    if(!exists){
      accounts.push(account);
      saveAccounts(accounts);
    }
  }

  window.resetToLogin = function(){
    closePaymentModal();
    if(typeof toggleView === 'function') toggleView('login');
    tempAccount = null;
  };

  function handleSignupSubmit(e){
    e.preventDefault();
    const name = (document.getElementById('reg-name') || {}).value || '';
    const email = (document.getElementById('reg-email') || {}).value || '';
    const password = (document.getElementById('reg-pass') || {}).value || '';
    const confirm = (document.getElementById('reg-confirm') || {}).value || '';

    if(name.trim().length === 0) { showFieldError('reg-name','reg-name-error'); return; }
    if(!isValidEmail(email)) { showFieldError('reg-email','reg-email-error'); return; }
    if(password.length < 6) { showFieldError('reg-pass','reg-pass-error'); return; }
    if(password !== confirm) { showFieldError('reg-confirm','reg-confirm-error'); return; }

    const account = { name: name.trim(), email: email.trim().toLowerCase(), password: password, paymentCompleted: false };
    showPaymentModalFor(account);
  }

  function showFieldError(inputId, msgId){
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if(input) input.classList.add('error');
    if(msg) msg.classList.add('visible');
  }

  function isValidEmail(email){
    return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
  }

  function handleLoginSubmit(e){
    e.preventDefault();
    const email = (document.getElementById('login-email') || {}).value || '';
    const password = (document.getElementById('login-pass') || {}).value || '';

    if(!isValidEmail(email)) { showFieldError('login-email','login-email-error'); return; }

    const accounts = getAccounts();
    const user = accounts.find(a => a.email === email.trim().toLowerCase());
    if(!user || user.password !== password || user.paymentCompleted !== true){
      alert('You have not completed payment or account does not exist.');
      return;
    }

    try{ sessionStorage.setItem('currentUser', JSON.stringify(user)); }catch(e){}
    window.location.href = 'profile.html';
  }

  function populateProfileFromSession(){
    let current = null;
    try{ current = JSON.parse(sessionStorage.getItem('currentUser') || 'null'); }catch(e){ current = null; }
    if(!current) return;

    const dashTitle = document.querySelector('#dashboard .page-title');
    if(dashTitle) dashTitle.innerText = `Welcome back, ${current.name}`;

    const avatar = document.querySelector('.avatar');
    if(avatar){
      const initials = current.name.split(' ').map(s => s[0] || '').slice(0,2).join('').toUpperCase();
      avatar.innerText = initials;
    }

    // Profile form inputs in the #profile section
    const profileSection = document.getElementById('profile');
    if(profileSection){
      // Assuming inputs: Full Name, Email, Phone
      const nameInput = document.getElementById('profile-fullname');
      const emailInput = document.getElementById('profile-email');
      
      if(nameInput) nameInput.value = current.name;
      if(emailInput) emailInput.value = current.email;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    signupForm = document.getElementById('signup-form');
    loginForm = document.getElementById('login-form');
    paymentModal = document.getElementById('payment-modal');
    paystackPayBtn = document.getElementById('paystack-pay-btn');

    if(signupForm){
      signupForm = replaceWithClone(signupForm);
      signupForm.addEventListener('submit', handleSignupSubmit);
    }

    if(loginForm){
      loginForm = replaceWithClone(loginForm);
      loginForm.addEventListener('submit', handleLoginSubmit);
    }

    if(paystackPayBtn){
      paystackPayBtn = replaceWithClone(paystackPayBtn);
      paystackPayBtn.addEventListener('click', function(ev){ ev.preventDefault(); if(tempAccount) initPaystackForTempAccount(); });
    }

    if(document.getElementById('profile')){
      populateProfileFromSession();
    }

    if(document.getElementById('video-modal-overlay')){
      initVideoModalSystem();
    }

    if(document.getElementById('survey-modal-overlay')){
      initSurveyModalSystem();
    }
  });

  // Daily Reset Countdown Timer & Auto Refresh
  function startDailyResetCountdown() {
    function updateCountdown() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0); 
      
      let diff = tomorrow - now;
      
      if (diff <= 0) {
        localStorage.setItem('earnova_daily_watch_count', 0);
        localStorage.setItem('earnova_last_watch_date', new Date().toLocaleDateString());
        localStorage.removeItem('earnova_last_video_set');
        
        localStorage.setItem('earnova_daily_question_count', 0);
        localStorage.setItem('earnova_last_question_date', new Date().toLocaleDateString());
        localStorage.removeItem('earnova_last_question_set');
        
        localStorage.setItem('earnova_daily_website_count', 0);
        localStorage.setItem('earnova_last_website_date', new Date().toLocaleDateString());
        localStorage.removeItem('earnova_last_website_set');

        if (typeof refreshVideoTabForNewDay === 'function') refreshVideoTabForNewDay();
        if (typeof renderQuestionTabOnLoad === 'function') renderQuestionTabOnLoad();
        if (typeof renderWebsiteTabOnLoad === 'function') renderWebsiteTabOnLoad();
        
        diff = 24 * 60 * 60 * 1000;
      }
      
      const hours = Math.floor(diff / 1000 / 60 / 60);
      const mins = Math.floor((diff / 1000 / 60) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      
      const el = document.getElementById('reset-countdown');
      if (el) {
        el.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('reset-countdown')) startDailyResetCountdown();
    });
  } else {
    if (document.getElementById('reset-countdown')) startDailyResetCountdown();
  }

})();

// ===================================================================
// WITHDRAWAL SYSTEM (Level 5 Rule)
// ===================================================================
window.handleWithdrawal = function() {
    // 1. Get Values
    const amountInput = document.getElementById('withdraw-amount');
    const nameInput = document.getElementById('withdraw-name');
    const acctInput = document.getElementById('withdraw-acct');
    const bankInput = document.getElementById('withdraw-bank');
    const withdrawBtn = document.getElementById('withdraw-btn');

    if (!amountInput || !nameInput || !acctInput || !bankInput) return;

    const amount = parseFloat(amountInput.value);
    const name = nameInput.value.trim();
    const acct = acctInput.value.trim();
    const bank = bankInput.value.trim();

    // 2. Validation
    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid amount.');
    if (!name || !acct || !bank) return alert('Please fill in all account details.');

    // 3. Check Level Rule (MUST BE LEVEL 5+)
    // We check the "effective" level which takes payment into account
    let currentLevel = 1;
    if (typeof getEffectiveLevel === 'function') {
        currentLevel = getEffectiveLevel();
    } else {
        // Fallback
        const paidLevel = parseInt(localStorage.getItem('earnova_paid_level')) || 1;
        currentLevel = paidLevel;
    }

    if (currentLevel < 5) {
        alert(`You are not eligible for withdrawal yet.\n\nYou are currently Level ${currentLevel}. You must upgrade to Level 5 to unlock withdrawals.`);
        return;
    }

    // 4. Check Balance
    let currentBalance = parseFloat(localStorage.getItem('earnova_balance')) || 0;
    if (amount > currentBalance) {
        alert('Insufficient funds.');
        return;
    }

    // 5. Process Withdrawal
    withdrawBtn.disabled = true;
    withdrawBtn.innerText = "Processing...";

    setTimeout(() => {
        // Deduct balance
        currentBalance -= amount;
        localStorage.setItem('earnova_balance', currentBalance);
        
        // Log transaction (if transaction system exists in profile.html logic)
        const transactions = JSON.parse(localStorage.getItem('earnova_transactions') || '[]');
        transactions.unshift({
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            type: 'Withdrawal',
            desc: `Transfer to ${bank}`,
            amount: -amount,
            status: 'Processing'
        });
        localStorage.setItem('earnova_transactions', JSON.stringify(transactions));

        // Update UI
        if (typeof updateBalanceUI === 'function') updateBalanceUI();
        if (typeof renderTransactions === 'function') renderTransactions();

        // Alert User
        alert(`Withdrawal of ₦${amount} has been sent successfully!`);

        // Reset Form
        amountInput.value = '';
        withdrawBtn.disabled = false;
        withdrawBtn.innerText = "Withdraw Funds";

    }, 5000); // 5 Seconds delay
};

// ===================================================================
// LEVEL UP PAYMENT SYSTEM
// ===================================================================

// Helper: Calculate Potential XP Level
function calculateXPLevel(xp) {
    const LEVELS = [0, 500, 750, 1125, 1688, 2532, 3798, 5697, 8546, 12819, 19229, 28844, 43266, 64899, 97349];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xp >= LEVELS[i]) return i + 1;
    }
    return 1;
}

// Helper: Get True/Effective Level (Min of XP Level and Paid Level)
window.getEffectiveLevel = function() {
    const xp = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const paidLevel = parseInt(localStorage.getItem('earnova_paid_level')) || 1; // Defaults to 1
    const potential = calculateXPLevel(xp);
    
    // User cannot be higher than what they paid for
    return Math.min(potential, paidLevel);
};

// Helper: Get Next Level XP requirement
window.getNextLevelXPReq = function(level) {
    const LEVELS = [0, 500, 750, 1125, 1688, 2532, 3798, 5697, 8546, 12819, 19229, 28844, 43266, 64899, 97349];
    if (level < LEVELS.length) return LEVELS[level];
    return LEVELS[LEVELS.length - 1]; 
}

// Function triggered by "Upgrade Level" button
window.initiateLevelUpPayment = function() {
    const xp = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const paidLevel = parseInt(localStorage.getItem('earnova_paid_level')) || 1;
    const potentialLevel = calculateXPLevel(xp);

    // Logic: 
    // If Potential > Paid, they have enough XP but need to pay.
    // Payment is for the NEXT level (Paid Level + 1).
    // Amount is fixed at 1000.

    if (potentialLevel <= paidLevel) {
        alert("You do not have enough XP to upgrade yet. Keep performing tasks!");
        return;
    }

    const nextLevelToPay = paidLevel + 1;
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const email = currentUser.email || 'user@example.com';

    // Paystack Handler
    if (typeof PaystackPop === 'undefined') {
        alert("Payment gateway not loaded. Please refresh.");
        return;
    }

    const handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: 100000, // ₦1,000.00 in kobo
      currency: 'NGN',
      metadata: {
         custom_fields: [
            { display_name: "Payment For", variable_name: "payment_for", value: `Level ${nextLevelToPay} Upgrade` }
         ]
      },
      callback: function(response) {
          // Verify success
          const newPaidLevel = nextLevelToPay;
          localStorage.setItem('earnova_paid_level', newPaidLevel);
          
          alert(`Congratulations! You have successfully upgraded to Level ${newPaidLevel}.`);
          
          // Refresh Profile UI
          if (typeof updateXPUI === 'function') updateXPUI();
          // Reload page to reflect new limits/UI
          window.location.reload();
      },
      onClose: function() {
          // Do nothing
      }
    });
    handler.openIframe();
};

// ===================================================================
// VIDEO MODAL SYSTEM
// ===================================================================

function refreshVideoTabForNewDay() {
  const container = document.getElementById('video-task-list');
  if (!container) return;
  const completed = getCompletedVideos();
  const availableVideos = VIDEO_DATA.videos.filter(v => !completed.includes(v.videoId));
  const videosToShow = availableVideos.slice(0, 10);
  container.innerHTML = '';

  if (videosToShow.length === 0) {
    container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">No new videos available at the moment. Please check back later.</p>';
  } else {
    videosToShow.forEach((video, i) => {
      let rewardObj = getStoredRewardByVideo(video) || getVideoReward(i);
      let reward = rewardObj.amount;
      let xp = rewardObj.xp;
      
      let cardHtml = `
        <div class="task-card video-task-card" id="vid-${i}" data-video-index="${video.index}">
            <div class="task-header">
                <span class="task-type">Video Ad</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="task-reward">₦${reward}</span>
                    <span class="xp-badge">+${xp} XP</span>
                </div>
            </div>
            <div class="video-card-thumbnail" style="background-image: url('${video.thumbnail}');" onclick="openVideoModal(${video.index})" title="Click to watch video">
                <div class="video-card-play-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
            </div>
            <div class="task-body">
                <div class="task-title">${video.title}</div>
                <div class="task-meta">⏱ <span class="video-duration" data-video-index="${video.index}">Loading...</span> • HD</div>
                <div class="progress-container"><div class="progress-bar" id="prog-vid-${video.index}"></div></div>
                <button class="btn btn-primary" onclick="openVideoModal(${video.index})">Watch Now</button>
            </div>
        </div>`;
      
      const wrapper = document.createElement('div');
      wrapper.innerHTML = cardHtml;
      container.appendChild(wrapper.firstElementChild);
    });
  }
  setTimeout(fetchAndPopulateDurations, 100);
  setTimeout(updateVideoCardStates, 200);
}

function renderVideoTabOnLoad() {
  const container = document.getElementById('video-task-list');
  if (!container) return;

  const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
  // Use effective level logic for limit if needed, but usually limits based on XP regardless of payment status
  // However, request says "enter level 2... pay 1000". This implies benefits are locked.
  // We'll stick to XP for limits calculation to be generous, or stick to Paid Level.
  // Let's use getDailyVideoLimit(currentXP) as requested, but the User is *at* the paid level.
  const limit = getDailyVideoLimit(currentXP); 
  const watchedToday = checkDailyLimit();
  const isLimitReached = watchedToday >= limit;

  const completed = getCompletedVideos();

  let videosToShow = [];
  if (isLimitReached) {
    let lastSet = localStorage.getItem('earnova_last_video_set');
    if (lastSet) {
      try {
        const lastSetArr = JSON.parse(lastSet);
        videosToShow = lastSetArr.map(id => VIDEO_DATA.videos.find(v => v.videoId === id)).filter(Boolean);
      } catch (e) { videosToShow = []; }
    }
    if (!videosToShow.length) {
      const availableVideos = VIDEO_DATA.videos.filter(v => !completed.includes(v.videoId));
      videosToShow = availableVideos.slice(0, 10);
    }
  } else {
    const availableVideos = VIDEO_DATA.videos.filter(v => !completed.includes(v.videoId));
    videosToShow = availableVideos.slice(0, 10);
    localStorage.setItem('earnova_last_video_set', JSON.stringify(videosToShow.map(v => v.videoId)));
  }

  container.innerHTML = '';
  if (videosToShow.length === 0) {
    container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">No new videos available at the moment. Please check back later.</p>';
  } else {
    videosToShow.forEach((video, i) => {
      let rewardObj = getStoredRewardByVideo(video) || getVideoReward(i);
      let reward = rewardObj.amount;
      let xp = rewardObj.xp;
      let cardHtml = `
        <div class="task-card video-task-card" id="vid-${i}" data-video-index="${video.index}">
            <div class="task-header">
                <span class="task-type">Video Ad</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="task-reward">₦${reward}</span>
                    <span class="xp-badge">+${xp} XP</span>
                </div>
            </div>
            <div class="video-card-thumbnail" style="background-image: url('${video.thumbnail}');" onclick="openVideoModal(${video.index})" title="Click to watch video">
                <div class="video-card-play-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
            </div>
            <div class="task-body">
                <div class="task-title">${video.title}</div>
                <div class="task-meta">⏱ <span class="video-duration" data-video-index="${video.index}">Loading...</span> • HD</div>
                <div class="progress-container"><div class="progress-bar" id="prog-vid-${video.index}"></div></div>
                <button class="btn btn-primary" onclick="openVideoModal(${video.index})">Watch Now</button>
            </div>
        </div>`;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = cardHtml;
      container.appendChild(wrapper.firstElementChild);
    });
  }
  setTimeout(updateVideoCardStates, 100);
}

let VIDEO_DATA = { videos: [], currentIndex: null };

function getDailyVideoLimit(xp) {
    if (xp < 500) return 1; if (xp < 750) return 1; if (xp < 1125) return 1;
    if (xp < 1688) return 2; if (xp < 2532) return 2; if (xp < 3798) return 2;
    if (xp < 5697) return 2; if (xp < 8546) return 3; if (xp < 12819) return 3;
    if (xp < 19229) return 3; if (xp < 28844) return 4; if (xp < 43266) return 4;
    if (xp < 64899) return 5; if (xp < 97349) return 6; return 6;
}

function checkDailyLimit() {
    const today = new Date().toLocaleDateString();
    const storedDate = localStorage.getItem('earnova_last_watch_date');
    let watchedToday = parseInt(localStorage.getItem('earnova_daily_watch_count')) || 0;
    if (storedDate !== today) {
        watchedToday = 0;
        localStorage.setItem('earnova_last_watch_date', today);
        localStorage.setItem('earnova_daily_watch_count', 0);
    }
    return watchedToday;
}

function incrementDailyWatch() {
    let watchedToday = checkDailyLimit();
    watchedToday++;
    localStorage.setItem('earnova_daily_watch_count', watchedToday);
    localStorage.setItem('earnova_last_watch_date', new Date().toLocaleDateString());
}

async function fetchVideoData() {
  try {
    const response = await fetch('vids.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const videos = await response.json();
    VIDEO_DATA.videos = videos.map((embedCode, index) => {
      const videoId = extractYouTubeId(embedCode);
      if (!videoId) return null;
      return {
        index: index, embedCode: embedCode, videoId: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        title: `Video Task #${index + 1}`
      };
    }).filter(v => v !== null);
    return VIDEO_DATA.videos;
  } catch (error) {
    const msgEl = document.querySelector('.video-modal-loading span');
    if (msgEl) msgEl.textContent = 'Error loading videos. Please refresh the page.';
    return [];
  }
}

function extractYouTubeId(iframeCode) {
  const match = iframeCode.match(/src="https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]+)"/);
  return match ? match[1] : null;
}

function getCompletedVideos() {
  try { return JSON.parse(localStorage.getItem('completedVideos') || '[]'); } catch (e) { return []; }
}
function setCompletedVideos(arr) {
  try { localStorage.setItem('completedVideos', JSON.stringify(arr)); } catch (e) {}
}
function markVideoCompleted(videoId) {
  if (!videoId) return;
  const arr = getCompletedVideos();
  if (!arr.includes(videoId)) { arr.push(videoId); setCompletedVideos(arr); }
}
function isVideoCompleted(videoId) { return getCompletedVideos().includes(videoId); }

function openVideoModal(videoIndex) {
  const video = VIDEO_DATA.videos.find(v => v.index === videoIndex);
  if (!video) return;

  if (isVideoCompleted(video.videoId)) {
    alert('You have already watched this video.');
    return;
  }
  const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
  const limit = getDailyVideoLimit(currentXP);
  // Get Effective Level (Paid) for alert display
  const effectiveLevel = typeof getEffectiveLevel === 'function' ? getEffectiveLevel() : 1;
  const watchedToday = checkDailyLimit();
  
  if (watchedToday >= limit) {
    alert(`Daily Limit Reached! Level ${effectiveLevel} allows ${limit} video(s) per day. Wait for the timer to reset.`);
    return;
  }
  
  VIDEO_DATA.currentIndex = video.index;
  let reward = getStoredRewardByVideo(video);
  if (!reward) {
    reward = getVideoReward(video.index); // Fallback logic same as before
    try { storeRewardForVideo(video, reward); } catch (e) {}
  }

  const overlay = document.getElementById('video-modal-overlay');
  const playerWrapper = document.getElementById('video-player-wrapper');
  const titleEl = document.getElementById('video-modal-title');
  const infoEl = document.getElementById('video-modal-info');
  const rewardEl = document.getElementById('video-modal-reward');

  titleEl.textContent = video.title;
  infoEl.textContent = `Video ${video.index + 1} of ${VIDEO_DATA.videos.length}`;
  rewardEl.textContent = `₦${reward.amount} + ${reward.xp} XP`;

  playerWrapper.innerHTML = '';
  const ytDivId = `yt-player-${video.videoId}`;
  const ytDiv = document.createElement('div');
  ytDiv.id = ytDivId;
  playerWrapper.appendChild(ytDiv);

  function onYouTubeReadyForModal() {
    if (!window.YT || !window.YT.Player) return setTimeout(onYouTubeReadyForModal, 100);
    let lastTime = 0; let skipped = false; let rewardGiven = false;
    const player = new YT.Player(ytDivId, {
      height: '360', width: '640', videoId: video.videoId,
      playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1, enablejsapi: 1 },
      events: {
        onStateChange: function (event) {
          if (event.data === YT.PlayerState.PLAYING) {
            lastTime = player.getCurrentTime();
            skipped = false;
            player._interval = setInterval(function () {
              const current = player.getCurrentTime();
              if (current - lastTime > 2.5) skipped = true;
              lastTime = current;
            }, 1000);
          } else if (event.data === YT.PlayerState.ENDED) {
            clearInterval(player._interval);
            if (!skipped && !rewardGiven) {
              rewardGiven = true;
              try {
                window.addFunds && window.addFunds(reward.amount, 'Video', `Video Task #${video.index + 1}`, reward.xp);
                markVideoCompleted(video.videoId);
                incrementDailyWatch();
                updateVideoCardStates();
                alert('Reward added to your profile!');
              } catch (e) {}
            }
          } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
            clearInterval(player._interval);
          }
        }
      }
    });
  }
  onYouTubeReadyForModal();
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', handleModalKeydown);
}

function closeVideoModal() {
  const overlay = document.getElementById('video-modal-overlay');
  const playerWrapper = document.getElementById('video-player-wrapper');
  document.removeEventListener('keydown', handleModalKeydown);
  overlay.classList.remove('active');
  document.body.classList.remove('modal-open');
  setTimeout(() => {
    playerWrapper.innerHTML = `<div class="video-modal-loading"><div class="video-modal-spinner"></div><span>Loading video...</span></div>`;
    VIDEO_DATA.currentIndex = null;
  }, 300);
  const videoCard = document.querySelector(`[data-video-index="${VIDEO_DATA.currentIndex}"]`);
  if (videoCard) { const btn = videoCard.querySelector('.btn'); if(btn && !btn.disabled) btn.focus(); }
}

function handleModalKeydown(e) { if (e.key === 'Escape') { closeVideoModal(); closeSurveyModal(); } }

function initVideoModalSystem() {
  fetchVideoData().then(() => {
    renderVideoTabOnLoad();
    updateVideoCardThumbnails();
    fetchAndPopulateDurations();
    const overlay = document.getElementById('video-modal-overlay');
    const closeBtn = document.getElementById('video-modal-close');
    closeBtn.addEventListener('click', closeVideoModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVideoModal(); });
    const container = document.getElementById('video-modal-container');
    container.addEventListener('click', (e) => { e.stopPropagation(); });
    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
    }
    setTimeout(updateVideoCardStates, 300);
  });
}

function updateVideoCardStates() {
    const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const limit = getDailyVideoLimit(currentXP);
    const watchedToday = checkDailyLimit();
    const isLimitReached = watchedToday >= limit;

    document.querySelectorAll('.video-task-card').forEach((card) => {
        const index = parseInt(card.getAttribute('data-video-index'));
        const video = VIDEO_DATA.videos.find(v => v.index === index);
        if (!video) return;
        const btn = card.querySelector('.btn');
        const isDone = isVideoCompleted(video.videoId);
        if (isDone) {
            card.classList.add('completed'); card.style.opacity = '0.5'; card.style.cursor = 'not-allowed';
            if (btn) { btn.innerText = "Completed"; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; }
        } else if (isLimitReached) {
            card.classList.add('completed'); card.style.opacity = '0.5'; card.style.cursor = 'not-allowed';
            if (btn) { btn.innerText = "Daily Limit"; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; }
        } else {
            card.classList.remove('completed'); card.style.opacity = ''; card.style.cursor = '';
            if (btn) { btn.innerText = "Watch Now"; btn.style.opacity = ''; btn.style.cursor = ''; }
        }
    });
}

function updateVideoCardThumbnails() {
  document.querySelectorAll('.video-task-card').forEach((card) => {
      const index = parseInt(card.getAttribute('data-video-index'));
      const video = VIDEO_DATA.videos.find(v => v.index === index);
      if (video) {
        const thumbnail = card.querySelector('.video-card-thumbnail');
        if (thumbnail && video.thumbnail) {
          const img = new Image();
          img.onload = () => { thumbnail.style.backgroundImage = `url('${video.thumbnail}')`; };
          img.onerror = () => { thumbnail.style.backgroundImage = 'linear-gradient(135deg, #1E3A8A 0%, #F97316 100%)'; };
          img.src = video.thumbnail;
        }
      }
  });
}

function getVideoThumbnail(index) {
  if (index >= 0 && index < VIDEO_DATA.videos.length) return VIDEO_DATA.videos[index].thumbnail;
  return null;
}

function getVideoReward(videoIndex) {
  const vid = VIDEO_DATA.videos.find(v => v.index === videoIndex);
  if (!vid || typeof vid.duration !== 'number' || !isFinite(vid.duration) || vid.duration <= 0) {
    const rewards = [{ amount: 50, xp: 8 }, { amount: 75, xp: 10 }, { amount: 60, xp: 9 }, { amount: 80, xp: 11 }, { amount: 70, xp: 10 }, { amount: 90, xp: 12 }];
    return rewards[videoIndex % rewards.length] || { amount: 50, xp: 8 };
  }
  const categories = [
    { name: 'Small', minDur: 0.5, maxDur: 2, minPrice: 5,  maxPrice: 20,  minXP: 2,  maxXP: 5  },
    { name: 'Medium',minDur: 2,   maxDur: 10, minPrice: 15, maxPrice: 70,  minXP: 6,  maxXP: 15 },
    { name: 'Large', minDur: 10,  maxDur: 30, minPrice: 50, maxPrice: 200, minXP: 20, maxXP: 50 },
    { name: 'Very Large', minDur: 30, maxDur: 180, minPrice: 150, maxPrice: 400, minXP: 80, maxXP: 150 }
  ];
  const dur = vid.duration; 
  let cat = categories.find(c => dur >= c.minDur && dur < c.maxDur);
  if (!cat && dur >= 180) cat = categories[categories.length - 1];
  if (!cat) cat = categories[0];
  const denom = (cat.maxDur - cat.minDur) || 1;
  let duration_percent = (dur - cat.minDur) / denom;
  duration_percent = Math.max(0, Math.min(1, duration_percent));
  const basePrice = cat.minPrice + duration_percent * (cat.maxPrice - cat.minPrice);
  const baseXP = cat.minXP + duration_percent * (cat.maxXP - cat.minXP);
  const randPrice = (Math.random() * 2) - 1; 
  const randXP = (Math.random() - 0.5); 
  let price = basePrice + randPrice;
  let xp = baseXP + randXP;
  price = Math.max(cat.minPrice, Math.min(cat.maxPrice, price));
  xp = Math.max(cat.minXP, Math.min(cat.maxXP, xp));
  price = Math.round(price * 10) / 10;
  xp = Math.round(xp * 10) / 10;
  return { amount: price, xp: xp };
}

function getStoredRewardByVideo(video) {
  if (!video || !video.videoId) return null;
  try {
    const p = localStorage.getItem('videoPrice_' + video.videoId);
    const x = localStorage.getItem('videoXP_' + video.videoId);
    if (p === null || x === null) return null;
    const amount = parseFloat(p);
    const xp = parseFloat(x);
    if (isNaN(amount) || isNaN(xp)) return null;
    return { amount: amount, xp: xp };
  } catch (e) { return null; }
}

function storeRewardForVideo(video, reward) {
  if (!video || !video.videoId || !reward) return;
  try {
    localStorage.setItem('videoPrice_' + video.videoId, String(reward.amount));
    localStorage.setItem('videoXP_' + video.videoId, String(reward.xp));
  } catch (e) {}
}

function collectUsedRewardKeys() {
  const used = new Set();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf('videoPrice_') === 0) {
        const vid = k.substring('videoPrice_'.length);
        const p = localStorage.getItem(k);
        const x = localStorage.getItem('videoXP_' + vid);
        if (p !== null && x !== null) {
          const ap = parseFloat(p);
          const ax = parseFloat(x);
          if (!isNaN(ap) && !isNaN(ax)) used.add(`${ap.toFixed(1)}|${ax.toFixed(1)}`);
        }
      }
    }
  } catch (e) {}
  return used;
}

function updateVideoCardRewards() {
  if (!VIDEO_DATA.videos || !VIDEO_DATA.videos.length) return;
  const used = collectUsedRewardKeys();
  document.querySelectorAll('.video-task-card').forEach((card) => {
    const index = parseInt(card.getAttribute('data-video-index'));
    const video = VIDEO_DATA.videos.find(v => v.index === index);
    if (!video) return;
    let reward = getStoredRewardByVideo(video);
    if (!reward && typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0) {
      let attempts = 0;
      do {
        reward = getVideoReward(index);
        const key = `${reward.amount.toFixed(1)}|${reward.xp.toFixed(1)}`;
        if (!used.has(key)) { used.add(key); try { storeRewardForVideo(video, reward); } catch (e) {} break; }
        attempts++;
        reward.amount = Math.round((reward.amount + (Math.random() * 0.6 - 0.3)) * 10) / 10;
        reward.xp = Math.round((reward.xp + (Math.random() * 0.3 - 0.15)) * 10) / 10;
      } while (attempts < 50);
      if (attempts >= 50) { try { storeRewardForVideo(video, reward); } catch (e) {} }
    }
    if (!reward) {
      reward = getVideoReward(index);
      const tmpKey = `${reward.amount.toFixed(1)}|${reward.xp.toFixed(1)}`;
      if (used.has(tmpKey)) {
        reward.amount = Math.round((reward.amount + 0.1) * 10) / 10;
        reward.xp = Math.round((reward.xp + 0.1) * 10) / 10;
      }
    }
    const rewardEl = card.querySelector('.task-reward');
    const xpEl = card.querySelector('.xp-badge');
    if (rewardEl) rewardEl.textContent = `₦${reward.amount}`;
    if (xpEl) xpEl.textContent = `+${reward.xp} XP`;
  });
}

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    window.onYouTubeIframeAPIReady = function() { resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
}

function formatDuration(sec) {
  if (!isFinite(sec) || sec <= 0) return 'N/A';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

async function fetchAndPopulateDurations() {
  if (!VIDEO_DATA.videos || VIDEO_DATA.videos.length === 0) return;
  try {
    await loadYouTubeAPI();
    document.querySelectorAll('.video-task-card').forEach((card) => {
      const index = parseInt(card.getAttribute('data-video-index'));
      const video = VIDEO_DATA.videos.find(v => v.index === index);
      if (!video) return;
      const placeholder = card.querySelector('.video-duration');
      if (!placeholder) return;
      const divId = `yt-temp-player-${index}`;
      let div = document.getElementById(divId);
      if (!div) {
        div = document.createElement('div'); div.id = divId;
        div.style.width = '0px'; div.style.height = '0px'; div.style.overflow = 'hidden';
        div.style.position = 'absolute'; div.style.left = '-9999px';
        document.body.appendChild(div);
      }
      try {
        const player = new YT.Player(divId, {
          height: '0', width: '0', videoId: video.videoId,
          playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0 },
          events: {
            onReady: function(ev) {
              try {
                const dur = ev.target.getDuration();
                placeholder.textContent = formatDuration(dur);
                try { video.duration = (typeof dur === 'number' && isFinite(dur) && dur > 0) ? (dur / 60) : null; } catch (e) {}
                try { updateVideoCardRewards(); } catch (e) {}
              } catch (e) { placeholder.textContent = 'N/A'; try { video.duration = null; } catch (e) {} try { updateVideoCardRewards(); } catch (err) {} }
              try { ev.target.destroy(); } catch (e) {}
              if (div && div.parentNode) div.parentNode.removeChild(div);
            },
            onError: function() {
              placeholder.textContent = 'N/A'; try { video.duration = null; } catch (e) {} try { updateVideoCardRewards(); } catch (err) {}
              try { if (player && player.destroy) player.destroy(); } catch (e) {}
              if (div && div.parentNode) div.parentNode.removeChild(div);
            }
          }
        });
      } catch (err) { placeholder.textContent = 'N/A'; if (div && div.parentNode) div.parentNode.removeChild(div); }
    });
  } catch (err) { document.querySelectorAll('.video-duration').forEach(el => el.textContent = 'N/A'); }
}

// SURVEY MODAL SYSTEM
let SURVEY_DATA = [];
async function loadSurveyData() {
  try {
    const response = await fetch('questions.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    SURVEY_DATA = await response.json();
    if (typeof renderQuestionTabOnLoad === "function") renderQuestionTabOnLoad();
  } catch (error) { console.error("Error loading questions.json:", error); }
}
loadSurveyData();

function renderQuestionTabOnLoad() {
    const container = document.getElementById('question-task-list');
    if (!container) return;
    if (!SURVEY_DATA || SURVEY_DATA.length === 0) return;
    const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const limit = getDailyQuestionLimit(currentXP);
    const answeredToday = checkDailyQuestionLimit();
    const isLimitReached = answeredToday >= limit;
    const completed = getCompletedQuestionCards();
    let toShow = [];
    if (isLimitReached) {
      let lastSet = localStorage.getItem('earnova_last_question_set');
      if (lastSet) {
        try {
          const lastSetArr = JSON.parse(lastSet);
          toShow = lastSetArr.map(id => SURVEY_DATA.find(q => q.id === id)).filter(Boolean);
        } catch (e) { toShow = []; }
      }
      if (!toShow.length) {
        const available = SURVEY_DATA.filter(q => !completed.includes(q.id));
        toShow = available.slice(0, 25);
      }
    } else {
      const available = SURVEY_DATA.filter(q => !completed.includes(q.id));
      toShow = available.slice(0, 25);
      localStorage.setItem('earnova_last_question_set', JSON.stringify(toShow.map(q => q.id)));
    }
    container.innerHTML = '';
    if (toShow.length === 0) {
      container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">No more questions available right now. Please check back later.</p>';
      return;
    }
    toShow.forEach((survey, index) => {
      let reward = null;
      if (typeof getStoredRewardByQuestionCard === "function") reward = getStoredRewardByQuestionCard(survey);
      if (!reward && typeof getQuestionCardReward === "function") reward = getQuestionCardReward(survey, index);
      if (!reward) reward = { amount: 150, xp: 10 };
      let btnText = 'Perform Task';
      let btnAttrs = `onclick=\"handleQuestionClick(${index}, '${survey.id}')\"`;
      let btnStyle = 'margin-top:auto';
      const cardHtml = `<div class=\"task-card\" id=\"q-card-${index}\" data-survey-id=\"${survey.id}\">\n<div class=\"task-header\">\n<span class=\"task-type\">Survey</span>\n<div style=\"display: flex; gap: 8px; align-items: center;\">\n<span class=\"task-reward\">₦${reward.amount}</span>\n<span class=\"xp-badge\">+${reward.xp} XP</span>\n</div>\n</div>\n<div class=\"task-body\">\n<div class=\"task-title\">${survey.title}</div>\n<p style=\"font-size:12px; color:var(--text-secondary); margin-bottom:12px;\">Complete this survey to earn rewards.</p>\n<button class=\"btn btn-primary\" style=\"${btnStyle}\" ${btnAttrs}>${btnText}</button>\n</div>\n</div>`;
      container.insertAdjacentHTML('beforeend', cardHtml);
    });
    updateQuestionUI();
}

const QUESTION_REWARD_CATEGORIES = [
  { name: 'Very Small', minQ: 1, maxQ: 3, minPrice: 5, maxPrice: 20, minXP: 2, maxXP: 8 },
  { name: 'Small', minQ: 4, maxQ: 7, minPrice: 20, maxPrice: 60, minXP: 8, maxXP: 25 },
  { name: 'Medium', minQ: 8, maxQ: 15, minPrice: 60, maxPrice: 120, minXP: 25, maxXP: 50 },
  { name: 'Large', minQ: 16, maxQ: 22, minPrice: 120, maxPrice: 180, minXP: 50, maxXP: 80 },
  { name: 'Very Large', minQ: 23, maxQ: 30, minPrice: 180, maxPrice: 250, minXP: 80, maxXP: 120 }
];

function getQuestionCardReward(survey, index) {
  if (!survey || !Array.isArray(survey.questions)) return { amount: 5, xp: 2 };
  const qCount = survey.questions.length;
  let cat = QUESTION_REWARD_CATEGORIES.find(c => qCount >= c.minQ && qCount <= c.maxQ);
  if (!cat) cat = QUESTION_REWARD_CATEGORIES[0];
  const denom = (cat.maxQ - cat.minQ) || 1;
  let qPercent = (qCount - cat.minQ) / denom;
  qPercent = Math.max(0, Math.min(1, qPercent));
  let basePrice = cat.minPrice + qPercent * (cat.maxPrice - cat.minPrice);
  let baseXP = cat.minXP + qPercent * (cat.maxXP - cat.minXP);
  const dec = ((index + 1) * 0.01) + (qCount * 0.001);
  let price = basePrice + dec; let xp = baseXP + dec;
  price = Math.max(cat.minPrice, Math.min(cat.maxPrice, price));
  xp = Math.max(cat.minXP, Math.min(cat.maxXP, xp));
  price = Math.round(price * 100) / 100; xp = Math.round(xp * 100) / 100;
  return { amount: price, xp: xp };
}

function getStoredRewardByQuestionCard(survey) {
  if (!survey || !survey.id) return null;
  try {
    const p = localStorage.getItem('questionPrice_' + survey.id);
    const x = localStorage.getItem('questionXP_' + survey.id);
    if (p === null || x === null) return null;
    const amount = parseFloat(p);
    const xp = parseFloat(x);
    if (isNaN(amount) || isNaN(xp)) return null;
    return { amount: amount, xp: xp };
  } catch (e) { return null; }
}

function storeRewardForQuestionCard(survey, reward) {
  if (!survey || !survey.id || !reward) return;
  try {
    localStorage.setItem('questionPrice_' + survey.id, String(reward.amount));
    localStorage.setItem('questionXP_' + survey.id, String(reward.xp));
  } catch (e) {}
}

function updateQuestionCardRewards() {
  if (!Array.isArray(SURVEY_DATA) || !SURVEY_DATA.length) return;
  SURVEY_DATA.forEach((survey, index) => {
    let reward = getStoredRewardByQuestionCard(survey);
    if (!reward) {
      reward = getQuestionCardReward(survey, index);
      storeRewardForQuestionCard(survey, reward);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateQuestionCardRewards);
} else {
  updateQuestionCardRewards();
}

function getCompletedQuestionCards() {
  try { return JSON.parse(localStorage.getItem('completedQuestionCards')) || []; } catch (e) { return []; }
}
function setCompletedQuestionCards(arr) {
  localStorage.setItem('completedQuestionCards', JSON.stringify(arr));
}
function isQuestionCardCompleted(survey) {
  if (!survey || !survey.id) return false;
  const arr = getCompletedQuestionCards();
  return arr.includes(survey.id);
}
function markQuestionCardCompleted(survey) {
  if (!survey || !survey.id) return;
  const arr = getCompletedQuestionCards();
  if (!arr.includes(survey.id)) { arr.push(survey.id); setCompletedQuestionCards(arr); }
  var card = document.querySelector(`.task-card[data-survey-id="${survey.id}"]`);
  if (card) {
    card.classList.add('completed'); card.style.opacity = '0.5'; card.style.cursor = 'not-allowed';
    var btn = card.querySelector('button');
    if (btn) {
      btn.textContent = 'Completed'; btn.removeAttribute('disabled'); btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed';
      btn.onclick = function() { alert('You have already answered this question.'); };
    }
  }
}

window.openSurveyModal = function(index) {
  if (index < 0 || index >= SURVEY_DATA.length) return;
  const survey = SURVEY_DATA[index];
  const overlay = document.getElementById('survey-modal-overlay');
  const title = document.getElementById('survey-modal-title');
  const formContent = document.getElementById('survey-form-content');
  title.innerText = survey.title;
  formContent.innerHTML = '';
  survey.questions.forEach(q => { formContent.innerHTML += renderFormInput(q); });
  let footer = document.querySelector('.survey-modal-footer');
  if (footer) {
    footer.innerHTML = '';
    if (!isQuestionCardCompleted(survey)) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary'; btn.textContent = 'Get Rewards';
      btn.onclick = function() {
        let allFilled = true;
        for (let i = 0; i < survey.questions.length; i++) {
          const q = survey.questions[i];
          let inputName = `q_${q.id}`;
          if (q.type === 'checkbox') inputName += '[]';
          const els = document.querySelectorAll(`[name="${inputName}"]`);
          if (!els || els.length === 0) { allFilled = false; break; }
          const type = (els[0].type || '').toLowerCase();
          if (type === 'checkbox' || type === 'radio') {
            let checked = false; els.forEach(e => { if (e.checked) checked = true; });
            if (!checked) { allFilled = false; break; }
          } else if (type === 'select-one') {
            if (!els[0].value || els[0].value === '') { allFilled = false; break; }
          } else {
            let filled = false; els.forEach(e => { if (e.value && e.value.trim() !== '') filled = true; });
            if (!filled) { allFilled = false; break; }
          }
        }
        if (!allFilled) { alert('You have not completed the form. Please answer all questions before claiming your reward.'); return; }
        if (isQuestionCardCompleted(survey)) { alert('You have already claimed this reward.'); return; }
        let reward = null;
        if (typeof getStoredRewardByQuestionCard === 'function') reward = getStoredRewardByQuestionCard(survey);
        if (!reward && typeof getQuestionCardReward === 'function') reward = getQuestionCardReward(survey, index);
        if (!reward) reward = { amount: 150, xp: 10 };
        if (typeof addFunds === 'function') { addFunds(reward.amount, 'Survey', survey.title, reward.xp); } 
        else {
          let bal = parseFloat(localStorage.getItem('earnova_balance')) || 0;
          let xp = parseInt(localStorage.getItem('earnova_xp')) || 0;
          bal += reward.amount; xp += reward.xp;
          localStorage.setItem('earnova_balance', bal); localStorage.setItem('earnova_xp', xp);
        }
        markQuestionCardCompleted(survey);
        window.closeSurveyModal();
      };
      footer.appendChild(btn);
    } else {
      const doneMsg = document.createElement('div');
      doneMsg.textContent = 'You have already completed this survey and claimed your reward.';
      doneMsg.style.color = 'var(--success)'; doneMsg.style.fontWeight = 'bold';
      footer.appendChild(doneMsg);
    }
  }
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
};

window.closeSurveyModal = function() {
  const overlay = document.getElementById('survey-modal-overlay');
  overlay.classList.remove('active');
  document.body.classList.remove('modal-open');
};

function renderFormInput(q) {
  let inputHtml = '';
  switch(q.type) {
    case 'text': case 'number':
      inputHtml = `<input type="${q.type}" class="survey-input" placeholder="${q.placeholder || ''}" name="q_${q.id}">`; break;
    case 'textarea':
      inputHtml = `<textarea class="survey-textarea" placeholder="${q.placeholder || ''}" name="q_${q.id}"></textarea>`; break;
    case 'select':
      const options = q.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
      inputHtml = `<select class="survey-select" name="q_${q.id}"><option value="" disabled selected>Select an option</option>${options}</select>`; break;
    case 'radio':
      inputHtml = `<div class="survey-radio-group">`;
      q.options.forEach(opt => {
        const id = `q_${q.id}_${opt.replace(/\s+/g, '_')}`;
        inputHtml += `<label class="survey-option-label" for="${id}"><input type="radio" class="survey-option-input" name="q_${q.id}" id="${id}" value="${opt}">${opt}</label>`;
      });
      inputHtml += `</div>`; break;
    case 'checkbox':
      inputHtml = `<div class="survey-checkbox-group">`;
      q.options.forEach(opt => {
        const id = `q_${q.id}_${opt.replace(/\s+/g, '_')}`;
        inputHtml += `<label class="survey-option-label" for="${id}"><input type="checkbox" class="survey-option-input" name="q_${q.id}[]" id="${id}" value="${opt}">${opt}</label>`;
      });
      inputHtml += `</div>`; break;
  }
  return `<div class="survey-form-group"><label class="survey-question-label">${q.id}. ${q.question}</label>${inputHtml}</div>`;
}

function initSurveyModalSystem() {
  const overlay = document.getElementById('survey-modal-overlay');
  const container = document.getElementById('survey-modal-container');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSurveyModal(); });
  container.addEventListener('click', (e) => { e.stopPropagation(); });
}

// WEBSITE TASK SYSTEM
function getDailyWebsiteLimit(xp) {
  if (xp < 500) return 1; if (xp < 750) return 2; if (xp < 1125) return 3;
  if (xp < 1688) return 5; if (xp < 2532) return 5; if (xp < 3798) return 5;
  if (xp < 5697) return 7; if (xp < 8546) return 9; if (xp < 12819) return 10;
  if (xp < 19229) return 10; if (xp < 28844) return 12; if (xp < 43266) return 13;
  if (xp < 64899) return 15; if (xp < 97349) return 17; return 20;
}

function checkDailyWebsiteLimit() {
  const today = new Date().toLocaleDateString();
  const storedDate = localStorage.getItem('earnova_last_website_date');
  let visitedToday = parseInt(localStorage.getItem('earnova_daily_website_count')) || 0;
  if (storedDate !== today) {
    visitedToday = 0;
    localStorage.setItem('earnova_last_website_date', today);
    localStorage.setItem('earnova_daily_website_count', 0);
  }
  return visitedToday;
}

function incrementDailyWebsite() {
  let visitedToday = checkDailyWebsiteLimit();
  visitedToday++;
  localStorage.setItem('earnova_daily_website_count', visitedToday);
  localStorage.setItem('earnova_last_website_date', new Date().toLocaleDateString());
}

async function renderWebsiteTabOnLoad() {
    const container = document.getElementById('website-task-list');
    if (!container) return;
    let websites = [];
    try {
        const response = await fetch('websites.json');
        if (!response.ok) throw new Error('Failed to load website data');
        const data = await response.json();
        websites = data;
    } catch (error) { container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">Unable to load websites.</p>'; return; }
    
    container.innerHTML = '';
    const completedWebsites = JSON.parse(localStorage.getItem('completedWebsites') || '[]');
    const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const limit = getDailyWebsiteLimit(currentXP);
    const visitedToday = checkDailyWebsiteLimit();
    const isLimitReached = visitedToday >= limit;

    let toShow = [];
    if (isLimitReached) {
        let lastSet = localStorage.getItem('earnova_last_website_set');
        if (lastSet) {
            try {
                const lastSetUrls = JSON.parse(lastSet);
                toShow = websites.filter(site => lastSetUrls.includes(site.link));
            } catch(e) { toShow = []; }
        }
        if (!toShow.length) {
             const available = websites.filter(site => !completedWebsites.includes(site.link));
             toShow = available.slice(0, 20);
        }
    } else {
        const available = websites.filter(site => !completedWebsites.includes(site.link));
        toShow = available.slice(0, 20);
        localStorage.setItem('earnova_last_website_set', JSON.stringify(toShow.map(s => s.link)));
    }

    if (toShow.length === 0) {
        container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">No more websites available right now. Please check back later.</p>';
        return;
    }

    const activeTaskStr = localStorage.getItem('earnova_active_web_task');
    let activeTask = activeTaskStr ? JSON.parse(activeTaskStr) : null;
    const categories = [
      { name: 'Very Small', min: 5, max: 30, minPrice: 1, maxPrice: 3, minXP: 1, maxXP: 3 },
      { name: 'Small', min: 30, max: 120, minPrice: 3, maxPrice: 8, minXP: 3, maxXP: 8 },
      { name: 'Medium', min: 120, max: 600, minPrice: 8, maxPrice: 25, minXP: 8, maxXP: 20 },
      { name: 'Large', min: 600, max: 1800, minPrice: 25, maxPrice: 60, minXP: 20, maxXP: 40 },
      { name: 'Very Large', min: 1800, max: 3000, minPrice: 60, maxPrice: 100, minXP: 40, maxXP: 60 }
    ];

    function getStoredWebsiteReward(link) {
      try { const all = JSON.parse(localStorage.getItem('website_rewards') || '{}'); return all[link] || null; } catch (e) { return null; }
    }
    function storeWebsiteReward(link, price, xp) {
      try { const all = JSON.parse(localStorage.getItem('website_rewards') || '{}'); all[link] = { price, xp }; localStorage.setItem('website_rewards', JSON.stringify(all)); } catch (e) {}
    }

    toShow.forEach((site, index) => {
      let reward = getStoredWebsiteReward(site.link);
      let price, xp;
      if (reward) { price = reward.price; xp = reward.xp; } else {
        let cat = categories.find(c => site.seconds >= c.min && site.seconds <= c.max);
        if (!cat) cat = categories[0];
        const durationPercent = (site.seconds - cat.min) / (cat.max - cat.min);
        price = cat.minPrice + durationPercent * (cat.maxPrice - cat.minPrice);
        xp = cat.minXP + durationPercent * (cat.maxXP - cat.minXP);
        price = Math.max(cat.minPrice, Math.min(cat.maxPrice, price));
        xp = Math.max(cat.minXP, Math.min(cat.maxXP, xp));
        price = Math.round(price * 10) / 10; xp = Math.round(xp * 10) / 10;
        price = Math.min(100, Math.max(0.5, price)); xp = Math.min(60, Math.max(1, xp));
        storeWebsiteReward(site.link, price, xp);
      }

      const isCompleted = completedWebsites.includes(site.link);
      let btnAttrs = `onclick="initiateWebsiteTask('${site.link}', ${site.seconds}, ${price}, ${xp}, 'web-btn-${index}')"`;
      let btnText = "Visit Site";
      let cardStyle = "";
      let btnStyle = "margin-top:auto";

      if (isCompleted) {
        btnText = "Completed"; btnAttrs = `onclick="alert('You have already visited this website.')"`;
        cardStyle = "opacity:0.5; cursor:not-allowed;"; btnStyle += "; opacity:0.5; cursor:not-allowed;";
      } else if (isLimitReached) {
        btnText = "Daily Limit"; 
        // Use global level logic if available
        const lvl = typeof getLevel === 'function' ? getLevel(currentXP) : 1;
        btnAttrs = `onclick="alert('Daily Website Limit Reached! Level ${lvl} allows ${limit} websites per day.')"`;
        cardStyle = "opacity:0.5; cursor:not-allowed;"; btnStyle += "; opacity:0.5; cursor:not-allowed;";
      } else if (activeTask && activeTask.url === site.link) {
          btnText = "Visit in Progress..."; btnAttrs = `onclick="alert('This task is currently active. Please switch tabs to continue the timer.')"`;
      }
      const completedClass = isCompleted || isLimitReached ? 'completed' : '';
      const cardHtml = `<div class="task-card ${completedClass}" style="${cardStyle}" data-website-link="${site.link}">
        <div class="task-header"><span class="task-type">Website Visit</span><div style="display: flex; gap: 8px; align-items: center;"><span class="task-reward">₦${price}</span><span class="xp-badge">+${xp} XP</span></div></div>
        <div class="task-body"><div class="task-title">${site.title}</div><div class="task-meta">⏱ ${site.seconds} Seconds Required</div><button id="web-btn-${index}" class="btn btn-primary" style="${btnStyle}" ${btnAttrs}>${btnText}</button></div></div>`;
      container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

function initiateWebsiteTask(url, seconds, reward, xp, btnId) {
    const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const limit = getDailyWebsiteLimit(currentXP);
    const visitedToday = checkDailyWebsiteLimit();
    if (visitedToday >= limit) {
        const lvl = typeof getLevel === 'function' ? getLevel(currentXP) : 1;
        alert(`Daily Website Limit Reached! Level ${lvl} allows ${limit} websites per day.`);
        return;
    }
    if (localStorage.getItem('earnova_active_web_task')) {
        alert("You already have a website task running. Please complete or cancel it first."); return;
    }
    window.open(url, '_blank');
    const task = { url: url, seconds: seconds, reward: reward, xp: xp, startTime: Date.now(), targetTime: Date.now() + (seconds * 1000) };
    localStorage.setItem('earnova_active_web_task', JSON.stringify(task));
    const btn = document.getElementById(btnId);
    if (btn) { btn.innerText = "Visit in Progress..."; btn.onclick = function() { alert('Task is running. Switch tabs to continue timer.'); }; }
}

function checkWebsiteTaskStatus() {
    const taskStr = localStorage.getItem('earnova_active_web_task');
    if (!taskStr) return;
    const task = JSON.parse(taskStr);
    const now = Date.now();
    if (now >= task.targetTime) {
        if (typeof addFunds === 'function') { addFunds(task.reward, 'Website Visit', `Visit to ${task.url}`, task.xp); }
        const completedWebsites = JSON.parse(localStorage.getItem('completedWebsites') || '[]');
        if (!completedWebsites.includes(task.url)) { completedWebsites.push(task.url); localStorage.setItem('completedWebsites', JSON.stringify(completedWebsites)); }
        incrementDailyWebsite();
        localStorage.removeItem('earnova_active_web_task');
        alert("You have claimed your reward!");
        renderWebsiteTabOnLoad();
    } else {
        localStorage.removeItem('earnova_active_web_task');
        alert("You have come back too early! You have not completed your stay on the site. Therefore you will not claim your reward.");
        renderWebsiteTabOnLoad();
    }
}

window.addEventListener('load', () => { checkWebsiteTaskStatus(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkWebsiteTaskStatus(); } });
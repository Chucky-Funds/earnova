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
    alert(`Daily Question Limit Reached! Level ${getLevel(currentXP)} allows ${limit} questions per day.`);
    return;
  }
  
  // Success: open modal for the correct survey
  // Find the correct index in SURVEY_DATA
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
  
  // We check existing DOM elements. The IDs are q-card-{i} from render function.
  // Note: Since we render dynamic count, we just queryAll
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
    
    // Check Completed State (shouldn't happen often if we filter them out on load, but good for safety)
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
      card.classList.add('completed'); // use class for styling
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
  // Patch markQuestionCardCompleted if not already patched
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
// All logic kept in this JS file (no HTML/CSS changes)

(function(){
  'use strict';

  // Utilities for accounts in localStorage
  function getAccounts(){
    return JSON.parse(localStorage.getItem('accounts') || '[]');
  }

  function saveAccounts(accounts){
    localStorage.setItem('accounts', JSON.stringify(accounts));
  }

  function findAccountByEmail(email){
    const accounts = getAccounts();
    return accounts.find(a => a.email === email);
  }

  function addPaidAccount(account){
    const accounts = getAccounts();
    // prevent duplicate by email
    const exists = accounts.some(a => a.email === account.email);
    if(!exists){
      accounts.push(account);
      saveAccounts(accounts);
    }
  }

  // Debug helpers
  window.viewAllAccounts = function(){ console.log(getAccounts()); };
  window.clearAllAccounts = function(){ localStorage.removeItem('accounts'); console.log('accounts cleared'); };

  // Shared DOM refs (may or may not exist depending on page)
  let signupForm = document.getElementById('signup-form');
  let loginForm = document.getElementById('login-form');
  let paymentModal = document.getElementById('payment-modal');
  let paystackPayBtn = document.getElementById('paystack-pay-btn');

  // In-memory temp account for signup until payment completes
  let tempAccount = null;

  // Replace element with clone to remove previously attached listeners (inline handlers)
  function replaceWithClone(el){
    if(!el || !el.parentNode) return el;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }

  // Show payment modal and populate account details
  function showPaymentModalFor(account){
    tempAccount = Object.assign({}, account, { paymentCompleted: false });

    // Populate payment details area (Account Name, Number, Bank, Amount)
    const details = document.querySelector('.payment-details');
    if(details){
      details.innerHTML = `
        <div class="payment-row"><span class="payment-label">Amount:</span><span class="payment-value" style="color: var(--secondary-orange);">₦3,000.00</span></div>
      `;
    }

    // show overlay
    if(paymentModal) paymentModal.classList.add('active');
  }

  function closePaymentModal(){
    if(paymentModal) paymentModal.classList.remove('active');
    tempAccount = null;
  }

  // simple html escape
  function escapeHtml(s){ return String(s).replace(/[&<>"]+/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]; }); }

  // Initialize Paystack using spec (test key) when Pay Now clicked
  function initPaystackForTempAccount(){
    if(!tempAccount) return;
    if(typeof PaystackPop === 'undefined'){
      // If Paystack not loaded, silently close modal (do not save)
      closePaymentModal();
      return;
    }

    const handler = PaystackPop.setup({
      key: 'pk_test_335a79da994d7c1777f46c1ef44abf7f4535491a',
      email: tempAccount.email,
      amount: 300000, // ₦3,000 in kobo
      currency: 'NGN',
      callback: function(response){
        // Treat test payment as real: mark paid, persist, alert, set session
        tempAccount.paymentCompleted = true;
        addPaidAccount(tempAccount);
        try{ sessionStorage.setItem('currentUser', JSON.stringify(tempAccount)); }catch(e){}
        closePaymentModal();
        alert('Payment successful! Your account is now activated.');
        // After successful payment, show the login form (or redirect to login page)
        if(typeof toggleView === 'function'){
          toggleView('login');
        } else {
          window.location.href = 'login.html';
        }
      },
      onClose: function(){
        // Close silently, do not persist
        closePaymentModal();
      }
    });
    handler.openIframe();
  }

  // Override resetToLogin to ensure correct behavior (always works, no saving)
  window.resetToLogin = function(){
    closePaymentModal();
    // Show login view (use existing toggleView if available)
    if(typeof toggleView === 'function') toggleView('login');
    // clear temp account
    tempAccount = null;
  };

  // Signup validation & flow
  function handleSignupSubmit(e){
    e.preventDefault();
    // collect
    const name = (document.getElementById('reg-name') || {}).value || '';
    const email = (document.getElementById('reg-email') || {}).value || '';
    const password = (document.getElementById('reg-pass') || {}).value || '';
    const confirm = (document.getElementById('reg-confirm') || {}).value || '';

    // validation
    if(name.trim().length === 0) { showFieldError('reg-name','reg-name-error'); return; }
    if(!isValidEmail(email)) { showFieldError('reg-email','reg-email-error'); return; }
    if(password.length < 6) { showFieldError('reg-pass','reg-pass-error'); return; }
    if(password !== confirm) { showFieldError('reg-confirm','reg-confirm-error'); return; }

    // create temp account in memory only
    const account = { name: name.trim(), email: email.trim().toLowerCase(), password: password, paymentCompleted: false };

    // Show payment modal populated with account details
    showPaymentModalFor(account);
  }

  // Utility to show the small inline error UI already in HTML
  function showFieldError(inputId, msgId){
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if(input) input.classList.add('error');
    if(msg) msg.classList.add('visible');
  }

  // Use the existing email validator from page if present, otherwise recreate
  function isValidEmail(email){
    return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
  }

  // Login flow: check persistent paid accounts only
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

    // Success: set session and redirect silently
    try{ sessionStorage.setItem('currentUser', JSON.stringify(user)); }catch(e){}
    window.location.href = 'profile.html';
  }

  // On profile page, populate name and email dynamically from sessionStorage
  function populateProfileFromSession(){
    let current = null;
    try{ current = JSON.parse(sessionStorage.getItem('currentUser') || 'null'); }catch(e){ current = null; }
    if(!current) return;

    // Dashboard welcome
    const dashTitle = document.querySelector('#dashboard .page-title');
    if(dashTitle) dashTitle.innerText = `Welcome back, ${current.name}`;

    // Avatar initials
    const avatar = document.querySelector('.avatar');
    if(avatar){
      const initials = current.name.split(' ').map(s => s[0] || '').slice(0,2).join('').toUpperCase();
      avatar.innerText = initials;
    }

    // Profile form inputs (first input = full name, second = email)
    const profileSection = document.getElementById('profile');
    if(profileSection){
      const inputs = profileSection.querySelectorAll('input');
      if(inputs.length > 0) inputs[1].value = current.email;
      if(inputs.length > 0) inputs[0].value = current.name;
    }
  }

  // Wire up page actions when DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    // Re-grab elements (in case DOM changed)
    signupForm = document.getElementById('signup-form');
    loginForm = document.getElementById('login-form');
    paymentModal = document.getElementById('payment-modal');
    paystackPayBtn = document.getElementById('paystack-pay-btn');

    // If on auth page, rebind handlers (remove inline ones via clone)
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

    // Ensure resetToLogin exists and behaves (already assigned above)

    // If on profile page, populate using sessionStorage
    if(document.getElementById('profile')){
      populateProfileFromSession();
    }

    // Initialize video modal system if on profile page
    if(document.getElementById('video-modal-overlay')){
      initVideoModalSystem();
    }

    // Initialize Survey Modal System
    if(document.getElementById('survey-modal-overlay')){
      initSurveyModalSystem();
    }
  });

  // =============================
  // Daily Reset Countdown Timer & Auto Refresh
  // =============================
  function startDailyResetCountdown() {
    function updateCountdown() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0); // midnight next day
      
      let diff = tomorrow - now;
      
      if (diff <= 0) {
        // --- DAILY RESET TRIGGERED ---
        // 1. Reset Counters immediately
        localStorage.setItem('earnova_daily_watch_count', 0);
        localStorage.setItem('earnova_last_watch_date', new Date().toLocaleDateString());
        // Remove last video set so new set is generated
        localStorage.removeItem('earnova_last_video_set');
        // Reset Question Counter
        localStorage.setItem('earnova_daily_question_count', 0);
        localStorage.setItem('earnova_last_question_date', new Date().toLocaleDateString());
        // Remove last question set so new set is generated
        localStorage.removeItem('earnova_last_question_set');
        // 2. Refresh the tabs contents (Load new videos/questions, remove old ones)
        if (typeof refreshVideoTabForNewDay === 'function') refreshVideoTabForNewDay();
        if (typeof renderQuestionTabOnLoad === 'function') renderQuestionTabOnLoad();
        // Reset diff for visual timer to start counting 24h again immediately
        diff = 24 * 60 * 60 * 1000;
      }
      
      // Calculate hours, mins, secs
      const hours = Math.floor(diff / 1000 / 60 / 60);
      const mins = Math.floor((diff / 1000 / 60) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      
      const el = document.getElementById('reset-countdown');
      if (el) {
        el.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }
    
    // Initial call
    updateCountdown();
    // Update every second
    setInterval(updateCountdown, 1000);
  }

  // Start countdown after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('reset-countdown')) startDailyResetCountdown();
    });
  } else {
    if (document.getElementById('reset-countdown')) startDailyResetCountdown();
  }

})();

/* ===================================================================
   VIDEO MODAL SYSTEM - Responsive Video Pop-up Manager
   =================================================================== */

// Refresh video tab automatically for a new day
// Triggers when timer hits 00:00:00
function refreshVideoTabForNewDay() {
  const container = document.getElementById('video-task-list');
  if (!container) return;

  // 1. Get List of videos previously completed (history)
  const completed = getCompletedVideos();

  // 2. Filter master list to find videos NOT in history
  const availableVideos = VIDEO_DATA.videos.filter(v => !completed.includes(v.videoId));

  // 3. Take top 10 (or less if running out)
  const videosToShow = availableVideos.slice(0, 10);

  // 4. Clear current DOM list
  container.innerHTML = '';

  // 5. Populate with new cards
  if (videosToShow.length === 0) {
    container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">No new videos available at the moment. Please check back later.</p>';
  } else {
    videosToShow.forEach((video, i) => {
      // Create HTML for card
      let mins = video.duration || 0;
      let rewardObj = getStoredRewardByVideo(video) || getVideoReward(i);
      let reward = rewardObj.amount;
      let xp = rewardObj.xp;
      
      // Re-use HTML creation logic (inlined here to ensure scripts.js is self-contained for refresh)
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

  // 6. Fetch durations for the newly loaded videos
  setTimeout(fetchAndPopulateDurations, 100);

  // 7. Update states (Enables buttons because daily count was just reset to 0)
  setTimeout(updateVideoCardStates, 200);
}

// Initial load rendering logic
function renderVideoTabOnLoad() {
  const container = document.getElementById('video-task-list');
  if (!container) return;

  // Get current XP and daily limit
  const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
  const limit = getDailyVideoLimit(currentXP);
  const watchedToday = checkDailyLimit();
  const isLimitReached = watchedToday >= limit;

  // 1. Get List of videos previously completed (history)
  const completed = getCompletedVideos();

  let videosToShow = [];
  if (isLimitReached) {
    // Show the same set as when the limit was reached (store in localStorage)
    let lastSet = localStorage.getItem('earnova_last_video_set');
    if (lastSet) {
      try {
        const lastSetArr = JSON.parse(lastSet);
        // Map ids to video objects (filter out if video removed)
        videosToShow = lastSetArr.map(id => VIDEO_DATA.videos.find(v => v.videoId === id)).filter(Boolean);
      } catch (e) {
        videosToShow = [];
      }
    }
    // If no last set, fallback to current available
    if (!videosToShow.length) {
      const availableVideos = VIDEO_DATA.videos.filter(v => !completed.includes(v.videoId));
      videosToShow = availableVideos.slice(0, 10);
    }
  } else {
    // Not at limit, show fresh set and store it
    const availableVideos = VIDEO_DATA.videos.filter(v => !completed.includes(v.videoId));
    videosToShow = availableVideos.slice(0, 10);
    // Store this set for reference if limit is reached later
    localStorage.setItem('earnova_last_video_set', JSON.stringify(videosToShow.map(v => v.videoId)));
  }

  container.innerHTML = '';
  if (videosToShow.length === 0) {
    container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">No new videos available at the moment. Please check back later.</p>';
  } else {
    videosToShow.forEach((video, i) => {
      let mins = video.duration || 0;
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

let VIDEO_DATA = {
  videos: [],
  currentIndex: null
};

// --- DAILY LIMIT & LEVEL LOGIC ---

/**
 * Returns the maximum number of videos allowed per day based on XP.
 */
function getDailyVideoLimit(xp) {
    if (xp < 500) return 1;     // Level 1
    if (xp < 750) return 1;     // Level 2
    if (xp < 1125) return 1;    // Level 3
    if (xp < 1688) return 2;    // Level 4
    if (xp < 2532) return 2;    // Level 5
    if (xp < 3798) return 2;    // Level 6
    if (xp < 5697) return 2;    // Level 7
    if (xp < 8546) return 3;    // Level 8
    if (xp < 12819) return 3;   // Level 9
    if (xp < 19229) return 3;   // Level 10
    if (xp < 28844) return 4;   // Level 11
    if (xp < 43266) return 4;   // Level 12
    if (xp < 64899) return 5;   // Level 13
    if (xp < 97349) return 6;   // Level 14
    return 6;                   // Level 15 (Final)
}

/**
 * Gets current daily progress. Resets if date has changed.
 */
function checkDailyLimit() {
    const today = new Date().toLocaleDateString();
    const storedDate = localStorage.getItem('earnova_last_watch_date');
    let watchedToday = parseInt(localStorage.getItem('earnova_daily_watch_count')) || 0;

    // Reset if it's a new day (Standard check on load)
    if (storedDate !== today) {
        watchedToday = 0;
        localStorage.setItem('earnova_last_watch_date', today);
        localStorage.setItem('earnova_daily_watch_count', 0);
    }
    
    return watchedToday;
}

/**
 * Increments the daily watch count.
 */
function incrementDailyWatch() {
    let watchedToday = checkDailyLimit();
    watchedToday++;
    localStorage.setItem('earnova_daily_watch_count', watchedToday);
    localStorage.setItem('earnova_last_watch_date', new Date().toLocaleDateString());
}

// Fetch and parse video data from vids.json
async function fetchVideoData() {
  try {
    const response = await fetch('vids.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const videos = await response.json();
    
    VIDEO_DATA.videos = videos.map((embedCode, index) => {
      const videoId = extractYouTubeId(embedCode);
      
      // Validate video ID
      if (!videoId) {
        console.warn(`Could not extract video ID from embed at index ${index}`);
        return null;
      }
      
      return {
        index: index,
        embedCode: embedCode,
        videoId: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        title: `Video Task #${index + 1}`
      };
    }).filter(v => v !== null); // Remove invalid videos
    
    return VIDEO_DATA.videos;
  } catch (error) {
    console.error('Error fetching video data:', error);
    // Show user-friendly error
    const msgEl = document.querySelector('.video-modal-loading span');
    if (msgEl) {
      msgEl.textContent = 'Error loading videos. Please refresh the page.';
    }
    return [];
  }
}

// Extract YouTube video ID from iframe embed code
function extractYouTubeId(iframeCode) {
  const match = iframeCode.match(/src="https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]+)"/);
  return match ? match[1] : null;
}

// Generate thumbnail URL from YouTube video ID
function generateThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// --- Video Completion Tracking ---
function getCompletedVideos() {
  try {
    return JSON.parse(localStorage.getItem('completedVideos') || '[]');
  } catch (e) { return []; }
}

function setCompletedVideos(arr) {
  try {
    localStorage.setItem('completedVideos', JSON.stringify(arr));
  } catch (e) {}
}

function markVideoCompleted(videoId) {
  if (!videoId) return;
  const arr = getCompletedVideos();
  if (!arr.includes(videoId)) {
    arr.push(videoId);
    setCompletedVideos(arr);
  }
}

function isVideoCompleted(videoId) {
  return getCompletedVideos().includes(videoId);
}

// Open video modal
function openVideoModal(videoIndex) {
  // Find correct video object from global data based on index
  const video = VIDEO_DATA.videos.find(v => v.index === videoIndex);
  
  if (!video) return;

  // Centralized strict checks for disabled state
  if (isVideoCompleted(video.videoId)) {
    alert('You have already watched this video.');
    return;
  }
  const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
  const limit = getDailyVideoLimit(currentXP);
  const watchedToday = checkDailyLimit();
  if (watchedToday >= limit) {
    alert(`Daily Limit Reached! Level ${getLevel(currentXP)} allows ${limit} video(s) per day. Wait for the timer to reset.`);
    return;
  }
  
  VIDEO_DATA.currentIndex = video.index;
  
  // Prefer persisted reward for this video so modal matches the card and is permanent
  let reward = getStoredRewardByVideo(video);
  if (!reward) {
    // If we know duration, generate a unique reward and persist it
    if (typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0) {
      const used = collectUsedRewardKeys();
      let attempts = 0;
      do {
        reward = getVideoReward(video.index);
        const key = `${reward.amount.toFixed(1)}|${reward.xp.toFixed(1)}`;
        if (!used.has(key)) {
          used.add(key);
          try { storeRewardForVideo(video, reward); } catch (e) {}
          break;
        }
        attempts++;
      } while (attempts < 50);
      if (!reward) reward = getVideoReward(video.index);
      try { storeRewardForVideo(video, reward); } catch (e) {}
    } else {
      // Duration unknown — show temporary values (these will be persisted later when duration becomes known)
      reward = getVideoReward(video.index);
    }
  }

  const overlay = document.getElementById('video-modal-overlay');
  const container = document.getElementById('video-modal-container');
  const playerWrapper = document.getElementById('video-player-wrapper');
  const titleEl = document.getElementById('video-modal-title');
  const infoEl = document.getElementById('video-modal-info');
  const rewardEl = document.getElementById('video-modal-reward');

  // Update title, info, and reward
  titleEl.textContent = video.title;
  infoEl.textContent = `Video ${video.index + 1} of ${VIDEO_DATA.videos.length}`;
  rewardEl.textContent = `₦${reward.amount} + ${reward.xp} XP`;

  // Clear previous content
  playerWrapper.innerHTML = '';

  // Load YouTube Player API and embed player with JS API enabled
  playerWrapper.innerHTML = '';
  const ytDivId = `yt-player-${video.videoId}`;
  const ytDiv = document.createElement('div');
  ytDiv.id = ytDivId;
  playerWrapper.appendChild(ytDiv);

  // Ensure YouTube API is loaded
  function onYouTubeReadyForModal() {
    if (!window.YT || !window.YT.Player) return setTimeout(onYouTubeReadyForModal, 100);
    let lastTime = 0;
    let skipped = false;
    let rewardGiven = false;
    const player = new YT.Player(ytDivId, {
      height: '360',
      width: '640',
      videoId: video.videoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1
      },
      events: {
        onStateChange: function (event) {
          if (event.data === YT.PlayerState.PLAYING) {
            // Start monitoring for skipping
            lastTime = player.getCurrentTime();
            skipped = false;
            player._interval = setInterval(function () {
              const current = player.getCurrentTime();
              // If user jumps forward more than 2 seconds, mark as skipped
              if (current - lastTime > 2.5) skipped = true;
              lastTime = current;
            }, 1000);
          } else if (event.data === YT.PlayerState.ENDED) {
            clearInterval(player._interval);
            if (!skipped && !rewardGiven) {
              rewardGiven = true;
              // Add reward to balance and XP
              try {
                window.addFunds && window.addFunds(reward.amount, 'Video', `Video Task #${video.index + 1}`, reward.xp);
                
                // --- NEW LOGIC START ---
                // 1. Mark historically completed
                markVideoCompleted(video.videoId);
                
                // 2. Increment Daily Watch Count
                incrementDailyWatch();

                // 3. Update all cards to reflect new limit state
                updateVideoCardStates();

                // 4. Alert user
                alert('Reward added to your profile!');
                // --- NEW LOGIC END ---

              } catch (e) {}
            }
          } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
            clearInterval(player._interval);
          }
        },
        onError: function () {}
      }
    });
  }
  onYouTubeReadyForModal();

  // Show modal with animation
  overlay.classList.add('active');
  document.body.classList.add('modal-open');

  // Handle escape key
  document.addEventListener('keydown', handleModalKeydown);
}

// Close video modal
function closeVideoModal() {
  const overlay = document.getElementById('video-modal-overlay');
  const playerWrapper = document.getElementById('video-player-wrapper');

  // Remove event listener
  document.removeEventListener('keydown', handleModalKeydown);

  // Hide modal
  overlay.classList.remove('active');
  document.body.classList.remove('modal-open');

  // Clear video with delay to smooth animation
  setTimeout(() => {
    playerWrapper.innerHTML = `<div class="video-modal-loading">
      <div class="video-modal-spinner"></div>
      <span>Loading video...</span>
    </div>`;
    VIDEO_DATA.currentIndex = null;
  }, 300);

  // Restore focus to the clicked video card
  const videoCard = document.querySelector(`[data-video-index="${VIDEO_DATA.currentIndex}"]`);
  if (videoCard) {
    const btn = videoCard.querySelector('.btn');
    if(btn && !btn.disabled) btn.focus();
  }
}

// Handle keyboard events on modal
function handleModalKeydown(e) {
  if (e.key === 'Escape') {
    closeVideoModal();
    closeSurveyModal();
  }
}

// Initialize video modal system
function initVideoModalSystem() {
  // Fetch video data
  fetchVideoData().then(() => {
    // Render only 10 uncompleted videos on load
    renderVideoTabOnLoad();
    // Update video card thumbnails
    updateVideoCardThumbnails();
    // Populate real durations for each video
    fetchAndPopulateDurations();

    // Set up modal event listeners
    const overlay = document.getElementById('video-modal-overlay');
    const closeBtn = document.getElementById('video-modal-close');

    // Close on button click
    closeBtn.addEventListener('click', closeVideoModal);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeVideoModal();
      }
    });

    // Prevent modal close when clicking inside container
    const container = document.getElementById('video-modal-container');
    container.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Ensure YouTube API is loaded for player events
    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    // --- APPLY STATES ON LOAD ---
    setTimeout(updateVideoCardStates, 300);
  });
}

/**
 * Updates the visual state of all video cards based on:
 * 1. Historical Completion (Permanent disable)
 * 2. Daily Limit (Temporary disable for today)
 */
function updateVideoCardStates() {
    const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const limit = getDailyVideoLimit(currentXP);
    const watchedToday = checkDailyLimit();
    const isLimitReached = watchedToday >= limit;

    // Iterate over all displayed cards
    document.querySelectorAll('.video-task-card').forEach((card) => {
        const index = parseInt(card.getAttribute('data-video-index'));
        const video = VIDEO_DATA.videos.find(v => v.index === index);
        
        if (!video) return;
        
        const btn = card.querySelector('.btn');
        const isDone = isVideoCompleted(video.videoId);

        // Only update visual state, not event/click logic
        if (isDone) {
            card.classList.add('completed');
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
            if (btn) {
                btn.innerText = "Completed";
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        } else if (isLimitReached) {
            // Daily limit reached: Disable card temporarily
            card.classList.add('completed'); // Reuse completed style for dimming
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
            if (btn) {
                btn.innerText = "Daily Limit";
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        } else {
            // Available
            card.classList.remove('completed');
            card.style.opacity = '';
            card.style.cursor = '';
            if (btn) {
                btn.innerText = "Watch Now";
                btn.style.opacity = '';
                btn.style.cursor = '';
            }
        }
    });
}

// Update all video card thumbnails with real thumbnails from YouTube
function updateVideoCardThumbnails() {
  document.querySelectorAll('.video-task-card').forEach((card) => {
      const index = parseInt(card.getAttribute('data-video-index'));
      const video = VIDEO_DATA.videos.find(v => v.index === index);
      if (video) {
        const thumbnail = card.querySelector('.video-card-thumbnail');
        if (thumbnail && video.thumbnail) {
          // Preload the image for smooth transition
          const img = new Image();
          img.onload = () => {
            thumbnail.style.backgroundImage = `url('${video.thumbnail}')`;
          };
          img.onerror = () => {
            // Fallback gradient if image fails to load
            thumbnail.style.backgroundImage = 'linear-gradient(135deg, #1E3A8A 0%, #F97316 100%)';
          };
          img.src = video.thumbnail;
        }
      }
  });
}

// Get video thumbnail by index
function getVideoThumbnail(index) {
  if (index >= 0 && index < VIDEO_DATA.videos.length) {
    return VIDEO_DATA.videos[index].thumbnail;
  }
  return null;
}

// Get video reward info (can be customized per video)
// Compute reward (amount in ₦ and xp) based on video duration
function getVideoReward(videoIndex) {
  // If duration not yet known, fall back to a safe default
  const vid = VIDEO_DATA.videos.find(v => v.index === videoIndex);
  if (!vid || typeof vid.duration !== 'number' || !isFinite(vid.duration) || vid.duration <= 0) {
    // maintain previous static behaviour as a graceful fallback
    const rewards = [
      { amount: 50, xp: 8 },
      { amount: 75, xp: 10 },
      { amount: 60, xp: 9 },
      { amount: 80, xp: 11 },
      { amount: 70, xp: 10 },
      { amount: 90, xp: 12 }
    ];
    return rewards[videoIndex % rewards.length] || { amount: 50, xp: 8 };
  }

  // Category definitions (durations in minutes)
  const categories = [
    { name: 'Small', minDur: 0.5, maxDur: 2, minPrice: 5,  maxPrice: 20,  minXP: 2,  maxXP: 5  },
    { name: 'Medium',minDur: 2,   maxDur: 10, minPrice: 15, maxPrice: 70,  minXP: 6,  maxXP: 15 },
    { name: 'Large', minDur: 10,  maxDur: 30, minPrice: 50, maxPrice: 200, minXP: 20, maxXP: 50 },
    { name: 'Very Large', minDur: 30, maxDur: 180, minPrice: 150, maxPrice: 400, minXP: 80, maxXP: 150 }
  ];

  const dur = vid.duration; // minutes (float)

  // pick category
  let cat = categories.find(c => dur >= c.minDur && dur < c.maxDur);
  // include upper bound for Very Large
  if (!cat && dur >= 180) cat = categories[categories.length - 1];
  if (!cat) {
    // If something odd, fallback
    cat = categories[0];
  }

  // duration percent in category
  const denom = (cat.maxDur - cat.minDur) || 1;
  let duration_percent = (dur - cat.minDur) / denom;
  duration_percent = Math.max(0, Math.min(1, duration_percent));

  // linear interpolation for base values
  const basePrice = cat.minPrice + duration_percent * (cat.maxPrice - cat.minPrice);
  const baseXP = cat.minXP + duration_percent * (cat.maxXP - cat.minXP);

  // small random variation
  const randPrice = (Math.random() * 2) - 1; // -1 .. +1
  const randXP = (Math.random() - 0.5); // -0.5 .. +0.5

  let price = basePrice + randPrice;
  let xp = baseXP + randXP;

  // clamp to category ranges
  price = Math.max(cat.minPrice, Math.min(cat.maxPrice, price));
  xp = Math.max(cat.minXP, Math.min(cat.maxXP, xp));

  // round to 1 decimal to keep uniqueness while readable
  price = Math.round(price * 10) / 10;
  xp = Math.round(xp * 10) / 10;

  return { amount: price, xp: xp };
}

// Persistent storage helpers for per-video rewards
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
  } catch (e) {
    return null;
  }
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

// Update the DOM for all video cards with computed rewards and ensure uniqueness
function updateVideoCardRewards() {
  if (!VIDEO_DATA.videos || !VIDEO_DATA.videos.length) return;

  // Start with any persisted rewards reserved
  const used = collectUsedRewardKeys();

  document.querySelectorAll('.video-task-card').forEach((card) => {
    const index = parseInt(card.getAttribute('data-video-index'));
    const video = VIDEO_DATA.videos.find(v => v.index === index);
    
    if (!video) return;

    // Prefer persisted value if available
    let reward = getStoredRewardByVideo(video);

    // If no persisted reward and we have duration info, generate + persist it
    if (!reward && typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0) {
      // Attempt to generate a unique reward (up to many tries)
      let attempts = 0;
      do {
        reward = getVideoReward(index);
        const key = `${reward.amount.toFixed(1)}|${reward.xp.toFixed(1)}`;
        if (!used.has(key)) {
          used.add(key);
          try { storeRewardForVideo(video, reward); } catch (e) {}
          break;
        }
        attempts++;
        // tiny jitter before next attempt
        reward.amount = Math.round((reward.amount + (Math.random() * 0.6 - 0.3)) * 10) / 10;
        reward.xp = Math.round((reward.xp + (Math.random() * 0.3 - 0.15)) * 10) / 10;
      } while (attempts < 50);

      // If still colliding after attempts, accept current reward and persist
      if (attempts >= 50) {
        try { storeRewardForVideo(video, reward); } catch (e) {}
      }
    }

    // If still no reward (duration unknown), compute temporary display value but do not persist
    if (!reward) {
      reward = getVideoReward(index);
      // avoid displaying identical to a persisted one where possible
      const tmpKey = `${reward.amount.toFixed(1)}|${reward.xp.toFixed(1)}`;
      if (used.has(tmpKey)) {
        reward.amount = Math.round((reward.amount + 0.1) * 10) / 10;
        reward.xp = Math.round((reward.xp + 0.1) * 10) / 10;
      }
    }

    // Update DOM numeric fields only (preserve all other markup)
    const rewardEl = card.querySelector('.task-reward');
    const xpEl = card.querySelector('.xp-badge');
    if (rewardEl) rewardEl.textContent = `₦${reward.amount}`;
    if (xpEl) xpEl.textContent = `+${reward.xp} XP`;
  });
}

// -------------------------
// Populate real video durations
// -------------------------

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

      // create an offscreen container for a temporary player
      const divId = `yt-temp-player-${index}`;
      let div = document.getElementById(divId);
      if (!div) {
        div = document.createElement('div');
        div.id = divId;
        div.style.width = '0px';
        div.style.height = '0px';
        div.style.overflow = 'hidden';
        div.style.position = 'absolute';
        div.style.left = '-9999px';
        document.body.appendChild(div);
      }

      try {
        const player = new YT.Player(divId, {
          height: '0',
          width: '0',
          videoId: video.videoId,
          playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0 },
          events: {
            onReady: function(ev) {
              try {
                const dur = ev.target.getDuration();
                placeholder.textContent = formatDuration(dur);
                // store duration in minutes for reward calculation
                try {
                    video.duration = (typeof dur === 'number' && isFinite(dur) && dur > 0) ? (dur / 60) : null;
                } catch (e) {}
                // update rewards now that duration is known
                try { updateVideoCardRewards(); } catch (e) {}
              } catch (e) {
                placeholder.textContent = 'N/A';
                try { video.duration = null; } catch (e) {}
                try { updateVideoCardRewards(); } catch (err) {}
              }
              // cleanup
              try { ev.target.destroy(); } catch (e) {}
              if (div && div.parentNode) div.parentNode.removeChild(div);
            },
            onError: function() {
              placeholder.textContent = 'N/A';
              try { video.duration = null; } catch (e) {}
              try { updateVideoCardRewards(); } catch (err) {}
              try { if (player && player.destroy) player.destroy(); } catch (e) {}
              if (div && div.parentNode) div.parentNode.removeChild(div);
            }
          }
        });
      } catch (err) {
        placeholder.textContent = 'N/A';
        if (div && div.parentNode) div.parentNode.removeChild(div);
      }
    });

  } catch (err) {
    console.error('Error loading YouTube API for durations', err);
    // set fallback text for all placeholders
    document.querySelectorAll('.video-duration').forEach(el => el.textContent = 'N/A');
  }
}

/* ===================================================================
   SURVEY MODAL SYSTEM
   =================================================================== */

// Survey Data Constant (Normally fetched from JSON file)
// 1. Define the variable globally (changed from const to let)
let SURVEY_DATA = [];

// 2. Function to fetch the JSON data
async function loadSurveyData() {
  try {
    const response = await fetch('questions.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    SURVEY_DATA = await response.json();
    console.log("Survey data loaded successfully!");
    // Render question cards after data is loaded
    if (typeof renderQuestionTabOnLoad === "function") {
      renderQuestionTabOnLoad();
    }
  } catch (error) {
    console.error("Error loading questions.json:", error);
  }
}

// 3. Run the fetch function
loadSurveyData();

// RENDER QUESTION TAB DYNAMICALLY (Replenishment Logic)
function renderQuestionTabOnLoad() {
    const container = document.getElementById('question-task-list');
    if (!container) return;

    // Ensure data exists
    if (!SURVEY_DATA || SURVEY_DATA.length === 0) return;

    // Get current XP and daily limit
    const currentXP = parseInt(localStorage.getItem('earnova_xp')) || 0;
    const limit = getDailyQuestionLimit(currentXP);
    const answeredToday = checkDailyQuestionLimit();
    const isLimitReached = answeredToday >= limit;

    // 1. Get History (Completed questions)
    const completed = getCompletedQuestionCards();

    // 2. Determine if we should show the same set (if limit reached) or fresh (if new day)
    let toShow = [];
    if (isLimitReached) {
      // Show the same set as when the limit was reached (store in localStorage)
      let lastSet = localStorage.getItem('earnova_last_question_set');
      if (lastSet) {
        try {
          const lastSetArr = JSON.parse(lastSet);
          // Map ids to survey objects (filter out if survey removed)
          toShow = lastSetArr.map(id => SURVEY_DATA.find(q => q.id === id)).filter(Boolean);
        } catch (e) {
          toShow = [];
        }
      }
      // If no last set, fallback to current available
      if (!toShow.length) {
        const available = SURVEY_DATA.filter(q => !completed.includes(q.id));
        toShow = available.slice(0, 25);
      }
    } else {
      // Not at limit, show fresh set and store it
      const available = SURVEY_DATA.filter(q => !completed.includes(q.id));
      toShow = available.slice(0, 25);
      // Store this set for reference if limit is reached later
      localStorage.setItem('earnova_last_question_set', JSON.stringify(toShow.map(q => q.id)));
    }

    // 4. Render
    container.innerHTML = '';
    if (toShow.length === 0) {
      container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">No more questions available right now. Please check back later.</p>';
      return;
    }

    toShow.forEach((survey, index) => {
      let reward = null;
      if (typeof getStoredRewardByQuestionCard === "function") {
        reward = getStoredRewardByQuestionCard(survey);
      }
      if (!reward && typeof getQuestionCardReward === "function") {
        reward = getQuestionCardReward(survey, index);
      }
      if (!reward) reward = { amount: 150, xp: 10 };

      let btnText = 'Perform Task';
      let btnAttrs = `onclick=\"handleQuestionClick(${index}, '${survey.id}')\"`;
      let btnStyle = 'margin-top:auto';
      const cardHtml = `
      <div class=\"task-card\" id=\"q-card-${index}\" data-survey-id=\"${survey.id}\">\n            <div class=\"task-header\">\n                <span class=\"task-type\">Survey</span>\n                <div style=\"display: flex; gap: 8px; align-items: center;\">\n                    <span class=\"task-reward\">₦${reward.amount}</span>\n                    <span class=\"xp-badge\">+${reward.xp} XP</span>\n                </div>\n            </div>\n            <div class=\"task-body\">\n                <div class=\"task-title\">${survey.title}</div>\n                <p style=\"font-size:12px; color:var(--text-secondary); margin-bottom:12px;\">Complete this survey to earn rewards.</p>\n                <button class=\"btn btn-primary\" style=\"${btnStyle}\" ${btnAttrs}>${btnText}</button>\n            </div>\n        </div>`;
      container.insertAdjacentHTML('beforeend', cardHtml);
    });

    // 5. Update UI States (Check Daily Limits)
    updateQuestionUI();
}

// =============================
// QUESTION CARD REWARD SYSTEM
// =============================

// Reward categories for question cards
const QUESTION_REWARD_CATEGORIES = [
  { name: 'Very Small', minQ: 1, maxQ: 3, minPrice: 5, maxPrice: 20, minXP: 2, maxXP: 8 },
  { name: 'Small', minQ: 4, maxQ: 7, minPrice: 20, maxPrice: 60, minXP: 8, maxXP: 25 },
  { name: 'Medium', minQ: 8, maxQ: 15, minPrice: 60, maxPrice: 120, minXP: 25, maxXP: 50 },
  { name: 'Large', minQ: 16, maxQ: 22, minPrice: 120, maxPrice: 180, minXP: 50, maxXP: 80 },
  { name: 'Very Large', minQ: 23, maxQ: 30, minPrice: 180, maxPrice: 250, minXP: 80, maxXP: 120 }
];

// Get reward for a question card (by survey object)
function getQuestionCardReward(survey, index) {
  if (!survey || !Array.isArray(survey.questions)) return { amount: 5, xp: 2 };
  const qCount = survey.questions.length;
  // Find category
  let cat = QUESTION_REWARD_CATEGORIES.find(c => qCount >= c.minQ && qCount <= c.maxQ);
  if (!cat) cat = QUESTION_REWARD_CATEGORIES[0];
  // Linear scaling within category
  const denom = (cat.maxQ - cat.minQ) || 1;
  let qPercent = (qCount - cat.minQ) / denom;
  qPercent = Math.max(0, Math.min(1, qPercent));
  // Interpolate
  let basePrice = cat.minPrice + qPercent * (cat.maxPrice - cat.minPrice);
  let baseXP = cat.minXP + qPercent * (cat.maxXP - cat.minXP);
  // Add decimal uniqueness: use index and qCount
  const dec = ((index + 1) * 0.01) + (qCount * 0.001);
  let price = basePrice + dec;
  let xp = baseXP + dec;
  // Clamp
  price = Math.max(cat.minPrice, Math.min(cat.maxPrice, price));
  xp = Math.max(cat.minXP, Math.min(cat.maxXP, xp));
  // Round to 2 decimals for uniqueness
  price = Math.round(price * 100) / 100;
  xp = Math.round(xp * 100) / 100;
  return { amount: price, xp: xp };
}

// Persistent storage helpers for per-question-card rewards
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

// Ensure all question cards have unique, persistent rewards
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

// On load, ensure rewards are assigned and persistent
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateQuestionCardRewards);
} else {
  updateQuestionCardRewards();
}

// Open Survey Modal with Specific Form Dataies
// --- Question Card Completion & Reward Logic ---
// Persistent completion helpers for question cards
function getCompletedQuestionCards() {
  try {
    return JSON.parse(localStorage.getItem('completedQuestionCards')) || [];
  } catch (e) {
    return [];
  }
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
  if (!arr.includes(survey.id)) {
    arr.push(survey.id);
    setCompletedQuestionCards(arr);
  }
  // Immediately update the UI for the completed card
  var card = document.getElementById('q-card-' + survey.id); // Note: render uses q-card-{index}, fix selection logic below
  
  // Refined selection to handle generated IDs or data attributes
  card = document.querySelector(`.task-card[data-survey-id="${survey.id}"]`);
  
  if (card) {
    card.classList.add('completed');
    card.style.opacity = '0.5';
    card.style.cursor = 'not-allowed';
    var btn = card.querySelector('button');
    if (btn) {
      btn.textContent = 'Completed';
      btn.removeAttribute('disabled');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
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

  // Set Title
  title.innerText = survey.title;

  // Clear and Populate Form
  formContent.innerHTML = '';
  survey.questions.forEach(q => {
    formContent.innerHTML += renderFormInput(q);
  });

  // Add Get Rewards button if not already present
  let footer = document.querySelector('.survey-modal-footer');
  if (footer) {
    footer.innerHTML = '';
    // Only show button if not already completed
    if (!isQuestionCardCompleted(survey)) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = 'Get Rewards';
      btn.onclick = function() {
        // Validate all questions as required (ignore q.required)
        let allFilled = true;
        for (let i = 0; i < survey.questions.length; i++) {
          const q = survey.questions[i];
          let inputName = `q_${q.id}`;
          if (q.type === 'checkbox') inputName += '[]';
          const els = document.querySelectorAll(`[name="${inputName}"]`);
          if (!els || els.length === 0) { allFilled = false; break; }
          const type = (els[0].type || '').toLowerCase();
          if (type === 'checkbox' || type === 'radio') {
            let checked = false;
            els.forEach(e => { if (e.checked) checked = true; });
            if (!checked) { allFilled = false; break; }
          } else if (type === 'select-one') {
            if (!els[0].value || els[0].value === '') { allFilled = false; break; }
          } else {
            let filled = false;
            els.forEach(e => {
              if (e.value && e.value.trim() !== '') filled = true;
            });
            if (!filled) { allFilled = false; break; }
          }
        }
        if (!allFilled) {
          alert('You have not completed the form. Please answer all questions before claiming your reward.');
          return;
        }
        // Prevent duplicate reward
        if (isQuestionCardCompleted(survey)) {
          alert('You have already claimed this reward.');
          return;
        }
        // Get reward (persistent)
        let reward = null;
        if (typeof getStoredRewardByQuestionCard === 'function') reward = getStoredRewardByQuestionCard(survey);
        if (!reward && typeof getQuestionCardReward === 'function') reward = getQuestionCardReward(survey, index);
        if (!reward) reward = { amount: 150, xp: 10 };
        // Add funds and XP (same as video logic)
        if (typeof addFunds === 'function') {
          addFunds(reward.amount, 'Survey', survey.title, reward.xp);
        } else {
          // Fallback: update localStorage directly
          let bal = parseFloat(localStorage.getItem('earnova_balance')) || 0;
          let xp = parseInt(localStorage.getItem('earnova_xp')) || 0;
          bal += reward.amount;
          xp += reward.xp;
          localStorage.setItem('earnova_balance', bal);
          localStorage.setItem('earnova_xp', xp);
        }
        // Mark as completed and update UI immediately
        markQuestionCardCompleted(survey);
        // Close modal
        window.closeSurveyModal();
      };
      footer.appendChild(btn);
    } else {
      // Already completed
      const doneMsg = document.createElement('div');
      doneMsg.textContent = 'You have already completed this survey and claimed your reward.';
      doneMsg.style.color = 'var(--success)';
      doneMsg.style.fontWeight = 'bold';
      footer.appendChild(doneMsg);
    }
  }

  // Open Modal
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
    case 'text':
    case 'number':
      inputHtml = `<input type="${q.type}" class="survey-input" placeholder="${q.placeholder || ''}" name="q_${q.id}">`;
      break;
    
    case 'textarea':
      inputHtml = `<textarea class="survey-textarea" placeholder="${q.placeholder || ''}" name="q_${q.id}"></textarea>`;
      break;
      
    case 'select':
      const options = q.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
      inputHtml = `<select class="survey-select" name="q_${q.id}"><option value="" disabled selected>Select an option</option>${options}</select>`;
      break;
      
    case 'radio':
      inputHtml = `<div class="survey-radio-group">`;
      q.options.forEach(opt => {
        const id = `q_${q.id}_${opt.replace(/\s+/g, '_')}`;
        inputHtml += `
          <label class="survey-option-label" for="${id}">
            <input type="radio" class="survey-option-input" name="q_${q.id}" id="${id}" value="${opt}">
            ${opt}
          </label>
        `;
      });
      inputHtml += `</div>`;
      break;
      
    case 'checkbox':
      inputHtml = `<div class="survey-checkbox-group">`;
      q.options.forEach(opt => {
        const id = `q_${q.id}_${opt.replace(/\s+/g, '_')}`;
        inputHtml += `
          <label class="survey-option-label" for="${id}">
            <input type="checkbox" class="survey-option-input" name="q_${q.id}[]" id="${id}" value="${opt}">
            ${opt}
          </label>
        `;
      });
      inputHtml += `</div>`;
      break;
  }
  
  return `
    <div class="survey-form-group">
      <label class="survey-question-label">${q.id}. ${q.question}</label>
      ${inputHtml}
    </div>
  `;
}

// Initialize Survey Modal Functionality
function initSurveyModalSystem() {
  const overlay = document.getElementById('survey-modal-overlay');
  const container = document.getElementById('survey-modal-container');
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSurveyModal();
    }
  });
  
  // Prevent closing when clicking inside modal
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// ===================================================================
// WEBSITE TASK SYSTEM (HIDDEN TAB LOGIC)
// ===================================================================

async function renderWebsiteTabOnLoad() {
    const container = document.getElementById('website-task-list');
    if (!container) return;
    
    let websites = [];
    try {
        const response = await fetch('websites.json');
        if (!response.ok) throw new Error('Failed to load website data');
        const data = await response.json();
        websites = data.slice(0, 20);
    } catch (error) {
        console.error("Error loading websites.json:", error);
        container.innerHTML = '<p style="padding:20px; color:var(--text-secondary);">Unable to load websites.</p>';
        return;
    }
    
    container.innerHTML = '';
    const completedWebsites = JSON.parse(localStorage.getItem('completedWebsites') || '[]');
    
    // Check if there is a pending task to restore UI state
    const activeTaskStr = localStorage.getItem('earnova_active_web_task');
    let activeTask = activeTaskStr ? JSON.parse(activeTaskStr) : null;

    // --- Reward Calculation ---
    const categories = [
      { name: 'Very Small', min: 5, max: 30, minPrice: 1, maxPrice: 3, minXP: 1, maxXP: 3 },
      { name: 'Small', min: 30, max: 120, minPrice: 3, maxPrice: 8, minXP: 3, maxXP: 8 },
      { name: 'Medium', min: 120, max: 600, minPrice: 8, maxPrice: 25, minXP: 8, maxXP: 20 },
      { name: 'Large', min: 600, max: 1800, minPrice: 25, maxPrice: 60, minXP: 20, maxXP: 40 },
      { name: 'Very Large', min: 1800, max: 3000, minPrice: 60, maxPrice: 100, minXP: 40, maxXP: 60 }
    ];

    const usedRewards = {};

    websites.forEach((site, index) => {
      let cat = categories.find(c => site.seconds >= c.min && site.seconds <= c.max);
      if (!cat) cat = categories[0];
      
      const durationPercent = (site.seconds - cat.min) / (cat.max - cat.min);
      let price = cat.minPrice + durationPercent * (cat.maxPrice - cat.minPrice);
      let xp = cat.minXP + durationPercent * (cat.maxXP - cat.minXP);
      
      function randomInRange(min, max) { return Math.random() * (max - min) + min; }
      price += randomInRange(-1, 1);
      xp += randomInRange(-0.5, 0.5);
      price = Math.max(cat.minPrice, Math.min(cat.maxPrice, price));
      xp = Math.max(cat.minXP, Math.min(cat.maxXP, xp));
      price = Math.round(price * 10) / 10;
      xp = Math.round(xp * 10) / 10;
      
      let key = `${price}_${xp}`;
      let tries = 0;
      while (usedRewards[key] && tries < 10) {
        price += randomInRange(-0.2, 0.2);
        xp += randomInRange(-0.1, 0.1);
        price = Math.round(price * 10) / 10;
        xp = Math.round(xp * 10) / 10;
        key = `${price}_${xp}`;
        tries++;
      }
      usedRewards[key] = true;
      price = Math.min(100, Math.max(1, price));
      xp = Math.min(60, Math.max(1, xp));

      const isCompleted = completedWebsites.includes(site.link);
      let btnAttrs = `onclick="initiateWebsiteTask('${site.link}', ${site.seconds}, ${price}, ${xp}, 'web-btn-${index}')"`;
      let btnText = "Visit Site";
      let cardStyle = "";
      let btnStyle = "margin-top:auto";
      
      if (isCompleted) {
        btnText = "Completed";
        btnAttrs = `onclick="alert('You have already visited this website.')"`;
        cardStyle = "opacity:0.5; cursor:not-allowed;";
        btnStyle += "; opacity:0.5; cursor:not-allowed;";
      } else if (activeTask && activeTask.url === site.link) {
          btnText = "Visit in Progress...";
          btnAttrs = `onclick="alert('This task is currently active. Please switch tabs to continue the timer.')"`;
      }

      const cardHtml = `
      <div class="task-card ${isCompleted ? 'completed' : ''}" style="${cardStyle}" data-website-link="${site.link}">
        <div class="task-header">
          <span class="task-type">Website Visit</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="task-reward">₦${price}</span>
            <span class="xp-badge">+${xp} XP</span>
          </div>
        </div>
        <div class="task-body">
          <div class="task-title">${site.title}</div>
          <div class="task-meta">⏱ ${site.seconds} Seconds Required</div>
          <button id="web-btn-${index}" class="btn btn-primary" style="${btnStyle}" ${btnAttrs}>${btnText}</button>
        </div>
      </div>`;
      container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// 1. User clicks button -> Opens Window -> Starts "Active Task" in storage
function initiateWebsiteTask(url, seconds, reward, xp, btnId) {
    // Check if another task is already running
    if (localStorage.getItem('earnova_active_web_task')) {
        alert("You already have a website task running. Please complete or cancel it first.");
        return;
    }

    // Open the URL
    window.open(url, '_blank');

    // Create task object. Start Time is set to NOW.
    // The logic: time counts as long as activeTask exists.
    // When user returns, we check (Now - StartTime).
    const task = {
        url: url,
        seconds: seconds,
        reward: reward,
        xp: xp,
        startTime: Date.now(),
        targetTime: Date.now() + (seconds * 1000)
    };

    localStorage.setItem('earnova_active_web_task', JSON.stringify(task));

    // Update UI immediately
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.innerText = "Visit in Progress...";
        btn.onclick = function() { alert('Task is running. Switch tabs to continue timer.'); };
    }

    // Inform user
    // We don't alert here because window.open might be blocked if we alert first.
    // The visual change on the button acts as feedback.
}

// 2. Logic to check task status when the user is LOOKING at the page (Visible or Load)
function checkWebsiteTaskStatus() {
    const taskStr = localStorage.getItem('earnova_active_web_task');
    if (!taskStr) return; // No active task

    const task = JSON.parse(taskStr);
    const now = Date.now();

    if (now >= task.targetTime) {
        // --- SUCCESS CASE ---
        // Time has elapsed (whether browser was closed, tab hidden, or refreshed)
        
        // 1. Add Funds
        if (typeof addFunds === 'function') {
            addFunds(task.reward, 'Website Visit', `Visit to ${task.url}`, task.xp);
        }

        // 2. Mark as completed in history
        const completedWebsites = JSON.parse(localStorage.getItem('completedWebsites') || '[]');
        if (!completedWebsites.includes(task.url)) {
            completedWebsites.push(task.url);
            localStorage.setItem('completedWebsites', JSON.stringify(completedWebsites));
        }

        // 3. Clear active task
        localStorage.removeItem('earnova_active_web_task');

        // 4. Alert User
        alert("You have claimed your reward!");

        // 5. Refresh UI
        renderWebsiteTabOnLoad();

    } else {
        // --- FAILURE CASE (Too Early) ---
        // User came back to the tab before targetTime
        
        // 1. Clear active task (Reset)
        localStorage.removeItem('earnova_active_web_task');

        // 2. Alert User
        alert("You have come back too early! You have not completed your stay on the site. Therefore you will not claim your reward.");

        // 3. Refresh UI (Reset button text)
        renderWebsiteTabOnLoad();
    }
}

// 3. Event Listeners for Hidden/Visible logic

// Check on Page Load (in case they refreshed while task was running)
window.addEventListener('load', () => {
    // If the page loads and there is an active task, it effectively means
    // the user is "viewing" the page. So we run the check.
    checkWebsiteTaskStatus();
});

// Check on Visibility Change (Tab switch)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Tab is hidden. 
        // We don't need to do anything here because the task was saved to localStorage 
        // with a specific start time. Time is strictly linear.
        // As long as they are away, (Date.now()) is increasing towards targetTime.
    } else {
        // Tab is visible (User came back)
        checkWebsiteTaskStatus();
    }
});
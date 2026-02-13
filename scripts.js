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
      if(inputs.length > 0) inputs[0].value = current.name;
      if(inputs.length > 1) inputs[1].value = current.email;
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
  });

})();

/* ===================================================================
   VIDEO MODAL SYSTEM - Responsive Video Pop-up Manager
   =================================================================== */

let VIDEO_DATA = {
  videos: [],
  currentIndex: null
};

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

// Open video modal
function openVideoModal(videoIndex) {
  if (!VIDEO_DATA.videos.length) return;
  if (videoIndex < 0 || videoIndex >= VIDEO_DATA.videos.length) return;

  VIDEO_DATA.currentIndex = videoIndex;
  const video = VIDEO_DATA.videos[videoIndex];
  // Prefer persisted reward for this video so modal matches the card and is permanent
  let reward = getStoredRewardByVideo(video);
  if (!reward) {
    // If we know duration, generate a unique reward and persist it
    if (typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0) {
      const used = collectUsedRewardKeys();
      let attempts = 0;
      do {
        reward = getVideoReward(videoIndex);
        const key = `${reward.amount.toFixed(1)}|${reward.xp.toFixed(1)}`;
        if (!used.has(key)) {
          used.add(key);
          try { storeRewardForVideo(video, reward); } catch (e) {}
          break;
        }
        attempts++;
      } while (attempts < 50);
      if (!reward) reward = getVideoReward(videoIndex);
      try { storeRewardForVideo(video, reward); } catch (e) {}
    } else {
      // Duration unknown — show temporary values (these will be persisted later when duration becomes known)
      reward = getVideoReward(videoIndex);
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
  infoEl.textContent = `Video ${videoIndex + 1} of ${VIDEO_DATA.videos.length}`;
  rewardEl.textContent = `₦${reward.amount} + ${reward.xp} XP`;

  // Clear previous content
  playerWrapper.innerHTML = '';

  // Load video
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${video.videoId}?autoplay=1&controls=1&rel=0&modestbranding=1`;
  iframe.allowFullscreen = true;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.title = video.title;
  playerWrapper.appendChild(iframe);

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
    videoCard.querySelector('.btn').focus();
  }
}

// Handle keyboard events on modal
function handleModalKeydown(e) {
  if (e.key === 'Escape') {
    closeVideoModal();
  }
}

// Initialize video modal system
function initVideoModalSystem() {
  // Fetch video data
  fetchVideoData().then(() => {
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
  });
}

// Update all video card thumbnails with real thumbnails from YouTube
function updateVideoCardThumbnails() {
  VIDEO_DATA.videos.forEach((video, index) => {
    const card = document.querySelector(`.video-task-card[data-video-index="${index}"]`);
    if (card) {
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
  const vid = VIDEO_DATA.videos[videoIndex];
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

  VIDEO_DATA.videos.forEach((video, index) => {
    const card = document.querySelector(`.video-task-card[data-video-index="${index}"]`);
    if (!card) return;

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

    VIDEO_DATA.videos.forEach((video, index) => {
      const placeholder = document.querySelector(`.video-duration[data-video-index="${index}"]`);
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
                  VIDEO_DATA.videos[index].duration = (typeof dur === 'number' && isFinite(dur) && dur > 0) ? (dur / 60) : null;
                } catch (e) {}
                // update rewards now that duration is known
                try { updateVideoCardRewards(); } catch (e) {}
              } catch (e) {
                placeholder.textContent = 'N/A';
                try { VIDEO_DATA.videos[index].duration = null; } catch (ee) {}
                try { updateVideoCardRewards(); } catch (err) {}
              }
              // cleanup
              try { ev.target.destroy(); } catch (e) {}
              if (div && div.parentNode) div.parentNode.removeChild(div);
            },
            onError: function() {
              placeholder.textContent = 'N/A';
              try { VIDEO_DATA.videos[index].duration = null; } catch (e) {}
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


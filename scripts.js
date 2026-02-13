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
  const reward = getVideoReward(videoIndex);

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
function getVideoReward(videoIndex) {
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


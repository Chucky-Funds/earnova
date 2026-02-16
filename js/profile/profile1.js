/* ------------------------------------------------------------
   CORE STATE & CONFIGURATION
------------------------------------------------------------ */
const PAYSTACK_PUBLIC_KEY = 'pk_live_8ee6bf2733a29f68c0bc8bb70a7e115362594676';

const LEVELS = [
    0,    // Level 1: 0 XP
    500,  // Level 2: 500 XP
    750,  // Level 3: 750 XP
    1125, // Level 4: 1125 XP
    1688, // Level 5: 1688 XP
    2532, // Level 6: 2532 XP
    3798, // Level 7: 3798 XP
    5697, // Level 8: 5697 XP
    8546, // Level 9: 8546 XP
    12819, // Level 10: 12819 XP
    19229, // Level 11: 19229 XP
    28844, // Level 12: 28844 XP
    43266, // Level 13: 43266 XP
    64899, // Level 14: 64899 XP
    97349  // Level 15: 97349 XP
];

// Core function to determine Potential Level based purely on XP
function getLevel(xp) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xp >= LEVELS[i]) return i + 1;
    }
    return 1;
}

function getLevelXP(level) {
    if (level <= 1) return 0;
    if (level - 1 < LEVELS.length) return LEVELS[level - 1];
    return LEVELS[LEVELS.length - 1];
}

function getNextLevelXP(level) {
    if (level < LEVELS.length) return LEVELS[level];
    return LEVELS[LEVELS.length - 1];
}

const STATE = {
    balance: parseFloat(localStorage.getItem('earnova_balance')) || 0,
    completedTasks: JSON.parse(localStorage.getItem('earnova_completed')) || 0,
    transactions: JSON.parse(localStorage.getItem('earnova_transactions')) || [],
    theme: localStorage.getItem('earnova_theme') || 'light',
    xp: parseInt(localStorage.getItem('earnova_xp')) || 0,
    paidLevel: parseInt(localStorage.getItem('earnova_paid_level')) || 1
};

const UI = {
    balance: document.getElementById('header-balance'),
    dashEarnings: document.getElementById('dash-earnings'),
    dashTasks: document.getElementById('dash-tasks'),
    sections: document.querySelectorAll('.content-section'),
    navItems: document.querySelectorAll('.nav-item'),
    themeToggle: document.getElementById('theme-toggle'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('sidebar-overlay'),
    xpDisplay: document.getElementById('header-xp'),
    // Profile/level card elements
    levelNumber: document.querySelector('.level-number'),
    levelTier: document.querySelector('.level-tier-name'),
    xpBar: document.querySelector('.xp-progress-bar-fill'),
    xpCurrent: document.querySelector('.xp-current'),
    xpRemaining: document.querySelector('.xp-remaining'),
    // Profile Specific
    profilePaidLevel: document.getElementById('profile-paid-level'),
    profileXpStatus: document.getElementById('profile-xp-status'),
    btnLevelUpgrade: document.getElementById('btn-level-upgrade')
};

/* ------------------------------------------------------------
   INITIALIZATION
------------------------------------------------------------ */
function init() {
    applyTheme(STATE.theme);
    updateBalanceUI(false);
    renderTransactions();
    renderAllTasks();
    initCharts();
    updateXPUI();
    // Navigation Logic
    UI.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            if(!targetId) return;
            switchTab(targetId);
            // Auto close sidebar on mobile after click
            if(window.innerWidth <= 1024) {
                toggleSidebar(false);
            }
        });
    });
    // Theme Logic
    UI.themeToggle.addEventListener('click', () => {
        STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('earnova_theme', STATE.theme);
        applyTheme(STATE.theme);
    });
}

/* ------------------------------------------------------------
   LOGIC HANDLERS
------------------------------------------------------------ */
function toggleSidebar(forceState) {
    const isOpen = UI.sidebar.classList.contains('open');
    const nextState = forceState !== undefined ? forceState : !isOpen;
    
    if (nextState) {
        UI.sidebar.classList.add('open');
        UI.overlay.classList.add('active');
    } else {
        UI.sidebar.classList.remove('open');
        UI.overlay.classList.remove('active');
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function switchTab(tabId) {
    UI.sections.forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    
    UI.navItems.forEach(nav => nav.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-target="${tabId}"]`);
    if(activeNav) activeNav.classList.add('active');
}

function updateBalanceUI(animate = true) {
    const formatted = '₦' + STATE.balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    UI.balance.innerText = formatted;
    UI.dashEarnings.innerText = formatted;
    UI.dashTasks.innerText = STATE.completedTasks;
    
    if(animate) {
        UI.balance.classList.add('flash');
        setTimeout(() => UI.balance.classList.remove('flash'), 500);
    }
}

function addFunds(amount, type, desc, xpAmount) {
    if (amount < 0.1 || amount > 100) return alert('Error: Invalid reward amount detected.');
    STATE.balance += amount;
    STATE.completedTasks++;
    // XP logic
    if (typeof xpAmount === 'number' && xpAmount > 0) {
        STATE.xp += xpAmount;
        localStorage.setItem('earnova_xp', STATE.xp);
    }
    // Log Transaction
    const tx = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        type: type,
        desc: desc,
        amount: amount,
        status: 'Completed'
    };
    STATE.transactions.unshift(tx);
    // Persist
    localStorage.setItem('earnova_balance', STATE.balance);
    localStorage.setItem('earnova_completed', STATE.completedTasks);
    localStorage.setItem('earnova_transactions', JSON.stringify(STATE.transactions));
    updateBalanceUI(true);
    renderTransactions();
    updateXPUI();
    // Re-init charts to reflect new data immediately
    initCharts(); 
    window.addFunds = addFunds;
}

/* ------------------------------------------------------------
   RENDERING
------------------------------------------------------------ */
function renderTransactions() {
    const tbody = document.getElementById('transaction-table-body');
    if (STATE.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px;">No transactions yet.</td></tr>';
        return;
    }
    tbody.innerHTML = STATE.transactions.slice(0, 10).map(tx => `
        <tr>
            <td>${tx.date}</td>
            <td>${tx.desc}</td>
            <td>${tx.type}</td>
            <td style="${tx.amount > 0 ? 'color: var(--success);' : 'color: var(--text-primary);'} font-weight:700;">
                ${tx.amount > 0 ? '+' : ''}₦${Math.abs(tx.amount)}
            </td>
            <td><span class="status-badge ${tx.amount > 0 ? 'status-completed' : ''}">${tx.status}</span></td>
        </tr>
    `).join('');
}

function renderAllTasks() {
    if (typeof renderVideoTabOnLoad === 'function') renderVideoTabOnLoad();
    if (typeof renderQuestionTabOnLoad === 'function') renderQuestionTabOnLoad();
    if (typeof renderWebsiteTabOnLoad === 'function') renderWebsiteTabOnLoad();
}

// XP/Level UI update
function updateXPUI() {
    // Refresh local state
    STATE.xp = parseInt(localStorage.getItem('earnova_xp')) || 0;
    STATE.paidLevel = parseInt(localStorage.getItem('earnova_paid_level')) || 1;
    
    const potentialLevel = getLevel(STATE.xp);
    // Effective level is the lower of what they have XP for and what they paid for
    const effectiveLevel = Math.min(potentialLevel, STATE.paidLevel);

    // Header XP
    if (UI.xpDisplay) UI.xpDisplay.innerText = STATE.xp + ' XP';
    
    // Dashboard Total XP
    var dashXP = document.getElementById('dash-xp');
    if (dashXP) dashXP.innerText = STATE.xp + ' XP';
    
    // Level Card (Main visual uses Effective Level)
    if (UI.levelNumber) UI.levelNumber.innerText = effectiveLevel;
    if (UI.levelTier) UI.levelTier.innerText = 'Level ' + effectiveLevel;
    
    // XP Bar Logic (Based on XP progress to next POTENTIAL level)
    if (UI.xpBar && UI.xpCurrent && UI.xpRemaining) {
        const prevXP = getLevelXP(potentialLevel);
        const nextXP = getNextLevelXP(potentialLevel);
        const progress = nextXP > prevXP ? ((STATE.xp - prevXP) / (nextXP - prevXP)) * 100 : 100;
        
        UI.xpBar.style.width = Math.max(0, Math.min(100, progress)) + '%';
        UI.xpCurrent.innerText = (STATE.xp - prevXP) + ' / ' + (nextXP - prevXP) + ' XP';
        
        const rem = nextXP - STATE.xp;
        UI.xpRemaining.innerText = rem > 0 ? (rem + ' XP to next level') : 'Max Level';
    }

    // Profile Specific UI Updates
    if (UI.profilePaidLevel) {
        UI.profilePaidLevel.innerText = `Level ${STATE.paidLevel}`;
    }
    if (UI.profileXpStatus) {
        UI.profileXpStatus.innerText = `${STATE.xp} XP (Eligible for Level ${potentialLevel})`;
    }

    // Upgrade Button State
    if (UI.btnLevelUpgrade) {
        if (potentialLevel > STATE.paidLevel) {
            // Eligible for upgrade: Has enough XP but hasn't paid yet
            UI.btnLevelUpgrade.disabled = false;
            UI.btnLevelUpgrade.innerText = `Pay ₦1,000 to Upgrade to Level ${STATE.paidLevel + 1}`;
            UI.btnLevelUpgrade.classList.remove('btn-outline');
            UI.btnLevelUpgrade.classList.add('btn-primary');
        } else {
            // Not enough XP to move to next level
            const nextLvlXP = getNextLevelXP(potentialLevel);
            const needed = nextLvlXP - STATE.xp;
            UI.btnLevelUpgrade.disabled = true;
            if(needed > 0) {
                 UI.btnLevelUpgrade.innerText = `Need ${needed} more XP for Level ${potentialLevel + 1}`;
            } else {
                 UI.btnLevelUpgrade.innerText = `Max Level Reached`;
            }
            UI.btnLevelUpgrade.classList.remove('btn-primary');
            UI.btnLevelUpgrade.classList.add('btn-outline');
        }
    }
}

/* ------------------------------------------------------------
   CHARTS (REAL DATA IMPLEMENTATION)
------------------------------------------------------------ */
// Helper to manage Chart instances so we can update them
const chartInstances = {};

function initCharts() {
    const commonConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#9CA3AF' } },
            y: { border: { display: false }, ticks: { color: '#9CA3AF' } }
        }
    };

    /* --- DATA PREPARATION --- */

    // 1. Weekly Earnings Data
    // Generate last 7 days labels
    const daysLabels = [];
    const earningsData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        // Use LocaleDateString to match stored transaction format
        const dateKey = d.toLocaleDateString(); 
        
        // Format label for display (e.g., "Mon" or "Jan 15")
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        daysLabels.push(label);

        // Sum earnings for this specific date
        const daySum = STATE.transactions.reduce((acc, tx) => {
            return tx.date === dateKey && tx.amount > 0 ? acc + tx.amount : acc;
        }, 0);
        earningsData.push(daySum);
    }

    // 2. Task Distribution Data
    // Categorize transactions based on type string
    let counts = { Video: 0, Survey: 0, Web: 0, Social: 0 };
    let earningsByType = { Video: 0, Survey: 0, Web: 0 }; // For stats
    
    STATE.transactions.forEach(tx => {
        if (tx.amount <= 0) return; // Skip withdrawals/negatives

        const typeLower = (tx.type || '').toLowerCase();
        
        if (typeLower.includes('video')) {
            counts.Video++;
            earningsByType.Video += tx.amount;
        } else if (typeLower.includes('question') || typeLower.includes('survey')) {
            counts.Survey++;
            earningsByType.Survey += tx.amount;
        } else if (typeLower.includes('website') || typeLower.includes('web')) {
            counts.Web++;
            earningsByType.Web += tx.amount;
        } else {
            counts.Social++;
        }
    });

    // 3. Analytics Calculation
    // Avg Earnings per task type
    const avgEarningsData = [
        counts.Video ? (earningsByType.Video / counts.Video) : 0,
        counts.Survey ? (earningsByType.Survey / counts.Survey) : 0,
        counts.Web ? (earningsByType.Web / counts.Web) : 0
    ];

    // Raw volume for "Type Chart"
    const volumeData = [counts.Video, counts.Survey, counts.Web];


    /* --- CHART RENDERING --- */

    // Helper to destroy old chart before creating new one
    function createOrUpdateChart(canvasId, config) {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        const ctx = document.getElementById(canvasId);
        if(ctx) {
            chartInstances[canvasId] = new Chart(ctx, config);
        }
    }

    // Chart 1: Earnings Chart
    createOrUpdateChart('earningsChart', {
        type: 'line',
        data: {
            labels: daysLabels,
            datasets: [{
                label: 'Earnings',
                data: earningsData,
                borderColor: '#1E3A8A',
                backgroundColor: 'rgba(30, 58, 138, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { ...commonConfig, plugins: { title: { display: true, text: 'Last 7 Days Earnings (₦)' } } }
    });

    // Chart 2: Task Distribution
    createOrUpdateChart('tasksChart', {
        type: 'doughnut',
        data: {
            labels: ['Video', 'Survey', 'Web', 'Social'],
            datasets: [{
                data: [counts.Video, counts.Survey, counts.Web, counts.Social],
                backgroundColor: ['#1E3A8A', '#F97316', '#10B981', '#6366F1'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { position: 'right' }, title: { display: true, text: 'All Time Activity' } }
        }
    });

    // Chart 3: Avg Earnings (Replaces Duration)
    createOrUpdateChart('durationChart', {
        type: 'bar',
        data: {
            labels: ['Video', 'Survey', 'Web'],
            datasets: [{ label: 'Avg ₦/Task', data: avgEarningsData, backgroundColor: '#F97316', borderRadius: 4 }]
        },
        options: { 
            ...commonConfig, 
            plugins: { title: { display: true, text: 'Avg. Earnings per Task (₦)' } }
        }
    });
    
    // Chart 4: Volume (Replaces Type/Completion)
    createOrUpdateChart('typeChart', {
         type: 'bar',
         data: {
             labels: ['Video', 'Survey', 'Web'],
             datasets: [{ label: 'Completed', data: volumeData, backgroundColor: '#10B981', borderRadius: 4 }]
         },
         options: { 
            ...commonConfig, 
            plugins: { title: { display: true, text: 'Total Completed Tasks' } }
         }
     });
}

window.addEventListener('DOMContentLoaded', init);
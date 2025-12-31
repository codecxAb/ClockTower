// --- State Management ---
const STORAGE_KEY = 'coc_builder_data_v1';
const SYNC_KEY = 'coc_builder_sync_v1';

let state = {
    accounts: [],
    selectedAccountId: 'dashboard' // Default to dashboard
};

let syncConfig = {
    binId: '',
    apiKey: ''
};

// --- Core Logic ---

async function init() {
    loadSyncSettings();
    loadData();
    
    // If sync is configured, try to fetch fresh data
    if (syncConfig.binId && syncConfig.apiKey) {
        await loadFromCloud();
    }
    
    // If we have no accounts, prompt or just show empty dashboard
    // If we have a saved selection, try to use it
    const lastSelected = localStorage.getItem('coc_last_selected');
    if (lastSelected) {
        // Check if it exists or is 'dashboard'
        if (lastSelected === 'dashboard' || state.accounts.find(a => a.id === lastSelected)) {
            state.selectedAccountId = lastSelected;
        } else {
            state.selectedAccountId = 'dashboard';
        }
    } else {
        state.selectedAccountId = 'dashboard';
    }

    renderAccounts();
    renderMainView();
    
    // Start the global update loop
    setInterval(updateTimers, 1000);
    updateTimers(); // Initial call
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            state.accounts = JSON.parse(raw);
        } catch (e) {
            console.error("Failed to parse data", e);
            state.accounts = [];
        }
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.accounts));
    if (state.selectedAccountId) {
        localStorage.setItem('coc_last_selected', state.selectedAccountId);
    }
    // Auto-save to cloud if configured
    if (syncConfig.binId && syncConfig.apiKey) {
        saveToCloud();
    }
}

function createAccount(name) {
    const newAccount = {
        id: crypto.randomUUID(),
        name: name,
        // Default 2 builders
        builders: Array.from({ length: 2 }, (_, i) => ({
            id: i + 1,
            label: '',
            targetTime: null,
            totalDuration: 0
        }))
    };
    state.accounts.push(newAccount);
    saveData();
    selectAccount(newAccount.id);
}

function addBuilder() {
    const account = state.accounts.find(a => a.id === state.selectedAccountId);
    if (!account) return;
    
    if (account.builders.length >= 6) {
        alert("Maximum 6 builders allowed.");
        return;
    }

    const newId = account.builders.length + 1;
    account.builders.push({
        id: newId,
        label: '',
        targetTime: null,
        totalDuration: 0
    });
    saveData();
    renderMainView();
}

function deleteCurrentAccount() {
    if (!state.selectedAccountId || state.selectedAccountId === 'dashboard') return;
    if (!confirm('Are you sure you want to delete this account and all its timers?')) return;

    state.accounts = state.accounts.filter(a => a.id !== state.selectedAccountId);
    state.selectedAccountId = 'dashboard';
    saveData();
    renderAccounts();
    renderMainView();
}

function selectAccount(id) {
    state.selectedAccountId = id;
    saveData();
    renderAccounts(); // Update sidebar highlight
    renderMainView(); // Update main content
    
    // Close sidebar on mobile if open
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar.classList.contains('-translate-x-full')) {
            toggleSidebar();
        }
    }
}

function startTimer() {
    const builderId = parseInt(document.getElementById('active-builder-id').value);
    const label = document.getElementById('upgrade-label').value || 'Upgrade';
    const d = parseInt(document.getElementById('time-d').value) || 0;
    const h = parseInt(document.getElementById('time-h').value) || 0;
    const m = parseInt(document.getElementById('time-m').value) || 0;

    const durationMs = ((d * 24 * 60 * 60) + (h * 60 * 60) + (m * 60)) * 1000;

    if (durationMs <= 0) {
        alert("Please enter a valid duration.");
        return;
    }

    // We need to find which account this builder belongs to.
    // Since we only start timers from the Account View (not dashboard), 
    // we can use selectedAccountId.
    const account = state.accounts.find(a => a.id === state.selectedAccountId);
    if (account) {
        const builder = account.builders.find(b => b.id === builderId);
        if (builder) {
            builder.label = label;
            builder.targetTime = Date.now() + durationMs;
            builder.totalDuration = durationMs;
            saveData();
            renderMainView();
            closeModal('upgrade-modal');
            
            // Reset form
            document.getElementById('upgrade-label').value = '';
            document.getElementById('time-d').value = '0';
            document.getElementById('time-h').value = '0';
            document.getElementById('time-m').value = '0';
        }
    }
}

function cancelTimer(accountId, builderId) {
    if (!confirm("Cancel this upgrade?")) return;
    const account = state.accounts.find(a => a.id === accountId);
    if (account) {
        const builder = account.builders.find(b => b.id === builderId);
        if (builder) {
            builder.label = '';
            builder.targetTime = null;
            builder.totalDuration = 0;
            saveData();
            renderMainView();
        }
    }
}

// --- Sync Logic ---

function loadSyncSettings() {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw) {
        try {
            syncConfig = JSON.parse(raw);
            document.getElementById('sync-bin-id').value = syncConfig.binId || '';
            document.getElementById('sync-api-key').value = syncConfig.apiKey || '';
        } catch (e) {
            console.error("Failed to parse sync config", e);
        }
    }
}

async function saveSyncSettings() {
    const binId = document.getElementById('sync-bin-id').value.trim();
    const apiKey = document.getElementById('sync-api-key').value.trim();
    
    if (!binId || !apiKey) {
        showSyncStatus('Please enter both Bin ID and API Key.', 'text-red-500');
        return;
    }

    syncConfig = { binId, apiKey };
    localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
    
    showSyncStatus('Connecting...', 'text-yellow-500');
    
    // Initial Sync Attempt
    const success = await loadFromCloud();
    if (success) {
        showSyncStatus('Connected & Synced!', 'text-green-500');
        setTimeout(() => closeModal('sync-modal'), 1000);
        renderAccounts();
        renderMainView();
    } else {
        showSyncStatus('Connection failed. Check credentials.', 'text-red-500');
    }
}

function showSyncStatus(msg, colorClass) {
    const el = document.getElementById('sync-status');
    el.textContent = msg;
    el.className = `text-xs text-center mb-4 ${colorClass}`;
    el.classList.remove('hidden');
}

async function loadFromCloud() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${syncConfig.binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': syncConfig.apiKey
            }
        });

        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        // JSONBin wraps data in 'record'
        state.accounts = data.record;
        
        // Save to local immediately to keep in sync
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.accounts));
        return true;
    } catch (error) {
        console.error('Sync Load Error:', error);
        return false;
    }
}

async function saveToCloud() {
    // Simple debounce or just fire and forget for now
    try {
        await fetch(`https://api.jsonbin.io/v3/b/${syncConfig.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': syncConfig.apiKey
            },
            body: JSON.stringify(state.accounts)
        });
    } catch (error) {
        console.error('Sync Save Error:', error);
    }
}

// --- UI Rendering ---

function renderAccounts() {
    const list = document.getElementById('account-list');
    list.innerHTML = '';
    
    // 1. Render Dashboard Link
    const isDashboard = state.selectedAccountId === 'dashboard';
    const dashBtn = document.createElement('button');
    dashBtn.className = `w-full text-left px-6 py-3 hover:bg-brand-secondary/10 transition duration-150 flex items-center gap-3 ${isDashboard ? 'bg-brand-secondary/10 border-r-4 border-brand-highlight text-brand-text' : 'text-brand-secondary/40'}`;
    dashBtn.onclick = () => selectAccount('dashboard');
    dashBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${isDashboard ? 'text-brand-highlight' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span class="font-medium uppercase tracking-wide text-sm">Dashboard</span>
    `;
    list.appendChild(dashBtn);

    // 2. Render Separator
    const sep = document.createElement('div');
    sep.className = "px-6 py-4 text-xs font-bold text-brand-secondary/20 uppercase tracking-widest";
    sep.innerText = "Villages";
    list.appendChild(sep);
    
    // 3. Render Accounts
    state.accounts.forEach(acc => {
        const isActive = acc.id === state.selectedAccountId;
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-6 py-3 hover:bg-brand-secondary/10 transition duration-150 flex items-center justify-between group ${isActive ? 'bg-brand-secondary/10 border-r-4 border-brand-highlight' : ''}`;
        btn.onclick = () => selectAccount(acc.id);
        
        // Count active builders
        const activeBuilders = acc.builders.filter(b => b.targetTime && b.targetTime > Date.now()).length;

        btn.innerHTML = `
            <span class="font-medium truncate ${isActive ? 'text-brand-text' : 'text-brand-secondary/40 group-hover:text-brand-text'}">${acc.name}</span>
            <span class="text-xs ${isActive ? 'bg-brand-highlight/20 text-brand-highlight' : 'bg-brand-secondary/5 text-brand-secondary/20'} px-2 py-0.5 rounded font-mono">${activeBuilders}/${acc.builders.length}</span>
        `;
        list.appendChild(btn);
    });
}

function renderMainView() {
    if (state.selectedAccountId === 'dashboard') {
        renderDashboard();
    } else {
        renderAccountView(state.selectedAccountId);
    }
}

function renderDashboard() {
    const grid = document.getElementById('builder-grid');
    const headerName = document.getElementById('current-account-name');
    const actions = document.getElementById('account-actions');

    headerName.textContent = "ACTIVE UPGRADES";
    actions.classList.add('hidden');
    grid.innerHTML = '';

    let hasActive = false;

    state.accounts.forEach(acc => {
        const activeBuilders = acc.builders.filter(b => b.targetTime && b.targetTime > Date.now());
        
        if (activeBuilders.length > 0) {
            hasActive = true;
            
            // Section Header
            const sectionTitle = document.createElement('div');
            sectionTitle.className = "col-span-full mt-6 mb-2 flex items-center gap-3 border-b border-brand-secondary/20 pb-2";
            sectionTitle.innerHTML = `
                <h3 class="text-lg font-bold text-brand-secondary/60 uppercase tracking-wider">${acc.name}</h3>
                <span class="bg-brand-highlight/10 text-brand-highlight text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-tighter">Tracking</span>
            `;
            grid.appendChild(sectionTitle);

            // Active Cards
            activeBuilders.forEach(builder => {
                const card = createBuilderCard(acc, builder, true); // true = dashboard mode (read only mostly)
                grid.appendChild(card);
            });
        }
    });

    if (!hasActive) {
        grid.innerHTML = `
            <div class="col-span-full text-center text-brand-secondary/20 mt-32">
                <p class="text-2xl font-light mb-4 tracking-widest uppercase">clockTower Silent</p>
                <p class="text-xs uppercase tracking-widest opacity-50">No active constructions detected.</p>
                <button onclick="openModal('account-modal')" class="mt-8 text-brand-highlight hover:opacity-80 border-b border-brand-highlight pb-1 uppercase tracking-widest text-[10px] font-bold">New Village</button>
            </div>
        `;
    }
}

function renderAccountView(accountId) {
    const grid = document.getElementById('builder-grid');
    const headerName = document.getElementById('current-account-name');
    const actions = document.getElementById('account-actions');

    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return;

    headerName.textContent = account.name.toUpperCase();
    actions.classList.remove('hidden');
    grid.innerHTML = '';

    // Render Builders
    account.builders.forEach(builder => {
        const card = createBuilderCard(account, builder, false);
        grid.appendChild(card);
    });

    // Render "Add Builder" button if < 6
    if (account.builders.length < 6) {
        const addBtn = document.createElement('button');
        addBtn.onclick = addBuilder;
        addBtn.className = "bg-black border border-dashed border-brand-secondary/20 rounded-xl p-6 flex flex-col items-center justify-center text-brand-secondary/20 hover:text-brand-highlight hover:border-brand-highlight/50 hover:bg-brand-secondary/5 transition duration-300 h-full min-h-[200px] group";
        addBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span class="font-bold uppercase tracking-widest text-[10px]">New Builder Slot</span>
        `;
        grid.appendChild(addBtn);
    }
}

function createBuilderCard(account, builder, isDashboard) {
    const isBusy = builder.targetTime && builder.targetTime > Date.now();
    const card = document.createElement('div');
    card.id = `builder-card-${account.id}-${builder.id}`;

    // Base classes for better visibility
    // Using Zinc-900 (brand-card) against Black background
    const baseClass = "rounded-lg p-5 relative overflow-hidden transition-all duration-200 bg-brand-card shadow-lg";

    let finishTimeStr = "";
    if (isBusy) {
        finishTimeStr = new Date(builder.targetTime).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', 
            hour: 'numeric', minute: 'numeric', hour12: true 
        });
        
        // BUSY CARD STYLE
        // Solid left border for status
        card.className = `${baseClass} border-l-4 border-brand-highlight`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4 z-10 relative">
                <span class="text-xs font-bold uppercase tracking-widest text-brand-highlight bg-brand-highlight/10 px-2 py-1 rounded">Slot ${builder.id}</span>
                ${!isDashboard ? `
                <button onclick="cancelTimer('${account.id}', ${builder.id})" class="text-gray-500 hover:text-red-500 transition p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
                ` : ''}
            </div>
            
            <div class="z-10 relative">
                <h4 class="text-xl font-bold text-white truncate mb-2">${builder.label}</h4>
                
                <div class="text-3xl font-mono text-brand-highlight font-bold mb-4 timer-display tracking-tight" 
                     data-target="${builder.targetTime}" 
                     data-total="${builder.totalDuration}"
                     data-acc="${account.id}"
                     data-bid="${builder.id}">
                     Calculating...
                </div>
                
                <div class="w-full bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                    <div class="bg-brand-highlight h-2 rounded-full progress-bar transition-all duration-1000" style="width: 0%"></div>
                </div>
                
                <div class="flex justify-between items-end">
                    <span class="text-xs text-gray-400 font-mono">FINISHES</span>
                    <span class="text-sm text-white font-mono font-bold">${finishTimeStr}</span>
                </div>
            </div>
        `;
    } else {
        // IDLE CARD STYLE
        // Dashed border to indicate "empty/ready"
        card.className = `${baseClass} border-2 border-dashed border-gray-700 hover:border-brand-secondary group`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-8">
                <span class="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-brand-secondary transition-colors">Slot ${builder.id}</span>
            </div>
            
            <div class="flex flex-col items-center justify-center text-center">
                <div class="bg-gray-800 rounded-full p-4 mb-4 group-hover:bg-brand-secondary/20 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500 group-hover:text-brand-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>
                
                <button onclick="openUpgradeModal(${builder.id})" class="w-full bg-brand-secondary text-black font-bold py-2 px-4 rounded hover:bg-yellow-400 transition-colors uppercase tracking-wide text-sm shadow-md">
                    Start Upgrade
                </button>
            </div>
        `;
    }
    return card;
}


function updateTimers() {
    const now = Date.now();
    const timerElements = document.querySelectorAll('.timer-display');
    
    timerElements.forEach(el => {
        const target = parseInt(el.getAttribute('data-target'));
        const total = parseInt(el.getAttribute('data-total'));
        
        // Find parent card to update progress
        const card = el.closest('div'); 
        
        const diff = target - now;

        if (diff <= 0) {
            el.textContent = "COMPLETED";
            el.className = "text-3xl font-mono text-brand-highlight font-bold mb-4 timer-display tracking-widest shadow-brand-highlight/20"; 
            if (card) {
                const prog = card.querySelector('.progress-bar');
                if (prog) {
                    prog.style.width = '100%';
                    prog.classList.add('bg-brand-highlight');
                }
            }
            return;
        }

        // Format Time: Day:Hour:Min (No Seconds)
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeString = "";
        if (days > 0) timeString += `${days}d `;
        timeString += `${hours}h ${minutes}m`;
        
        el.textContent = timeString;

        // Update Progress Bar
        if (card && total > 0) {
            const elapsed = total - diff;
            const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
            const prog = card.querySelector('.progress-bar');
            if (prog) prog.style.width = `${percent}%`;
        }
    });
}


// --- UI Interactions ---

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('flex');
    if (id === 'account-modal') {
        document.getElementById('new-account-name').focus();
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).classList.remove('flex');
}

function addAccount() {
    const input = document.getElementById('new-account-name');
    const name = input.value.trim();
    if (name) {
        createAccount(name);
        input.value = '';
        closeModal('account-modal');
    }
}

function openUpgradeModal(builderId) {
    document.getElementById('active-builder-id').value = builderId;
    openModal('upgrade-modal');
    document.getElementById('upgrade-label').focus();
}

// --- Boot ---
window.addEventListener('DOMContentLoaded', init);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal('account-modal');
        closeModal('upgrade-modal');
    }
});

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).classList.remove('flex');
}

function addAccount() {
    const input = document.getElementById('new-account-name');
    const name = input.value.trim();
    if (name) {
        createAccount(name);
        input.value = '';
        closeModal('account-modal');
    }
}

function openUpgradeModal(builderId) {
    document.getElementById('active-builder-id').value = builderId;
    openModal('upgrade-modal');
    document.getElementById('upgrade-label').focus();
}

// --- Boot ---
window.addEventListener('DOMContentLoaded', init);

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal('account-modal');
        closeModal('upgrade-modal');
        closeModal('sync-modal');
    }
});
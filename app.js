// --- State Management ---
const STORAGE_KEY = 'coc_builder_data_v1';
let state = {
    accounts: [],
    selectedAccountId: 'dashboard' // Default to dashboard
};

// --- Core Logic ---

function init() {
    loadData();
    
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

// --- UI Rendering ---

function renderAccounts() {
    const list = document.getElementById('account-list');
    list.innerHTML = '';
    
    // 1. Render Dashboard Link
    const isDashboard = state.selectedAccountId === 'dashboard';
    const dashBtn = document.createElement('button');
    dashBtn.className = `w-full text-left px-6 py-3 hover:bg-gray-700 transition duration-150 flex items-center gap-3 ${isDashboard ? 'bg-gray-700 border-r-4 border-yellow-500 text-white' : 'text-gray-300'}`;
    dashBtn.onclick = () => selectAccount('dashboard');
    dashBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span class="font-medium">Dashboard</span>
    `;
    list.appendChild(dashBtn);

    // 2. Render Separator
    const sep = document.createElement('div');
    sep.className = "px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider";
    sep.innerText = "Accounts";
    list.appendChild(sep);
    
    // 3. Render Accounts
    state.accounts.forEach(acc => {
        const isActive = acc.id === state.selectedAccountId;
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-6 py-3 hover:bg-gray-700 transition duration-150 flex items-center justify-between group ${isActive ? 'bg-gray-700 border-r-4 border-yellow-500' : ''}`;
        btn.onclick = () => selectAccount(acc.id);
        
        // Count active builders
        const activeBuilders = acc.builders.filter(b => b.targetTime && b.targetTime > Date.now()).length;

        btn.innerHTML = `
            <span class="font-medium truncate ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}">${acc.name}</span>
            <span class="text-xs ${isActive ? 'bg-yellow-500 text-gray-900' : 'bg-gray-600 text-gray-300'} px-2 py-0.5 rounded-full">${activeBuilders}/${acc.builders.length}</span>
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

    headerName.textContent = "All Active Upgrades";
    actions.classList.add('hidden');
    grid.innerHTML = '';

    let hasActive = false;

    state.accounts.forEach(acc => {
        const activeBuilders = acc.builders.filter(b => b.targetTime && b.targetTime > Date.now());
        
        if (activeBuilders.length > 0) {
            hasActive = true;
            
            // Section Header
            const sectionTitle = document.createElement('div');
            sectionTitle.className = "col-span-full mt-4 mb-2 flex items-center gap-2";
            sectionTitle.innerHTML = `
                <h3 class="text-lg font-bold text-gray-300">${acc.name}</h3>
                <span class="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">${activeBuilders.length} Active</span>
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
            <div class="col-span-full text-center text-gray-400 mt-20">
                <p class="text-xl">No active upgrades across any accounts.</p>
                <button onclick="openModal('account-modal')" class="mt-4 text-blue-400 hover:underline">Add an Account</button>
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

    headerName.textContent = account.name;
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
        addBtn.className = "bg-gray-800 border-2 border-dashed border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:text-gray-300 hover:border-gray-500 hover:bg-gray-700 transition duration-200 h-full min-h-[200px]";
        addBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span class="font-bold">Add Builder</span>
        `;
        grid.appendChild(addBtn);
    }
}

function createBuilderCard(account, builder, isDashboard) {
    const isBusy = builder.targetTime && builder.targetTime > Date.now();
    const card = document.createElement('div');
    card.className = `bg-gray-800 rounded-xl shadow-md p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${isBusy ? 'border border-blue-900' : 'border border-gray-700'}`;
    card.id = `builder-card-${account.id}-${builder.id}`; // Unique ID for update loop

    const badgeColor = isBusy ? 'bg-blue-900 text-blue-200' : 'bg-green-900 text-green-200';
    
    // Formatting finish time immediately for static render
    let finishTimeStr = "";
    if (isBusy) {
        finishTimeStr = new Date(builder.targetTime).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', 
            hour: 'numeric', minute: 'numeric', hour12: true 
        });
    }

    if (isBusy) {
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4 z-10">
                <span class="text-xs font-bold uppercase tracking-wider ${badgeColor} px-2 py-1 rounded">Builder ${builder.id}</span>
                ${!isDashboard ? `
                <button onclick="cancelTimer('${account.id}', ${builder.id})" class="text-gray-500 hover:text-red-400 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
                ` : ''}
            </div>
            <div class="z-10">
                <h4 class="text-lg font-bold text-gray-100 truncate mb-1">${builder.label}</h4>
                <div class="text-xl md:text-2xl font-mono text-white font-bold mb-2 timer-display" 
                     data-target="${builder.targetTime}" 
                     data-total="${builder.totalDuration}"
                     data-acc="${account.id}"
                     data-bid="${builder.id}">
                     Calculating...
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2.5 mb-1">
                    <div class="bg-blue-600 h-2.5 rounded-full progress-bar" style="width: 0%"></div>
                </div>
                <div class="text-xs text-gray-400 text-right finish-time">Finishes: ${finishTimeStr}</div>
            </div>
            <!-- Background decoration -->
            <div class="absolute -bottom-4 -right-4 text-gray-700 opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
        `;
    } else {
        // Only show idle builders in Account View, not Dashboard (unless we want to, but request implied "active builders time will be showing")
        // But dashboard usually shows status. If dashboard logic above filters only active, this block won't run for dashboard.
        card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                <span class="text-xs font-bold uppercase tracking-wider ${badgeColor} px-2 py-1 rounded">Builder ${builder.id}</span>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center py-4">
                    <div class="bg-green-900 bg-opacity-30 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    </div>
                    <p class="text-gray-400 text-sm mb-4">Ready to work</p>
                    <button onclick="openUpgradeModal(${builder.id})" class="w-full bg-gray-800 border-2 border-green-500 text-green-400 hover:bg-green-900 font-bold py-2 px-4 rounded transition">Start Upgrade</button>
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
        // ID format: builder-card-{accId}-{builderId}
        // But we can just use closest div
        const card = el.closest('div'); 
        
        const diff = target - now;

        if (diff <= 0) {
            el.textContent = "Finished!";
            el.classList.add('text-green-400');
            if (card) {
                const prog = card.querySelector('.progress-bar');
                if (prog) prog.style.width = '100%';
            }
            return;
        }

        // Format Time: Day:Hour:Min (No Seconds)
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        // If < 1 minute, show "< 1m" or similar? Or just 0m.
        // Request said: "countdown to day:hour:min"
        
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
    }
});
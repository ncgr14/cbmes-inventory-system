const SUPABASE_URL = 'https://faddbjtlvmfteevktkyf.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_UW105oLT1XuhIHmjzIgOxg_zNiEFHvw'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const viewAuth = document.getElementById('view-auth');
    const viewHome = document.getElementById('view-home');
    const viewDetail = document.getElementById('view-division-detail');
    
    const divisionTitle = document.getElementById('division-title');
    const divisionDesc = document.getElementById('division-desc');
    const backBtn = document.getElementById('back-home-btn');
    
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');
    const btnLogout = document.getElementById('btn-logout');
    const welcomeText = document.getElementById('welcome-text');
    const roleBadge = document.getElementById('role-badge');
    const adminPanelCard = document.getElementById('admin-panel-card');
    const notificationBell = document.getElementById('notification-bell');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationModal = document.getElementById('notification-modal');
    const notificationContent = document.getElementById('notification-content');
    const closeNotificationModal = document.getElementById('close-notification-modal');
    const dismissNotificationBtn = document.getElementById('dismiss-notification-btn');

    let currentUserRole = 'Student';
    let justLoggedIn = false;
    let editState = { chemicals: null, materials: null, equipment: null, apparatus: null, suppliers: null, budgets: null };

    // Tables that carry a stock/threshold pair and should show a LOW STOCK badge
    const STOCK_TABLES = new Set(['chemicals', 'materials', 'apparatus']);
    // How many days ahead counts as "due soon" for calibration/maintenance
    const DUE_SOON_DAYS = 30;

    supabaseClient.auth.getSession().then(({ data: { session } }) => { handleSession(session, 'INITIAL_SESSION'); });
    supabaseClient.auth.onAuthStateChange((event, session) => { handleSession(session, event); });

    function handleSession(session, event) {
        if (session) {
            const userName = session.user.user_metadata?.full_name || 'User';
            currentUserRole = session.user.user_metadata?.role || 'Student'; 
            
            viewAuth.classList.add('hidden');
            viewHome.classList.remove('hidden');
            btnLogout.classList.remove('hidden');
            
            welcomeText.innerText = `Welcome to the Mapúa CBMES Inventory Management Portal, ${userName}.`;
            roleBadge.innerText = currentUserRole;
            roleBadge.classList.remove('hidden');

            const adminForms = document.querySelectorAll('.admin-only');
            const tableContainers = document.querySelectorAll('.table-container');
            
            if (currentUserRole === 'Student') {
                adminPanelCard.classList.add('hidden');
                adminForms.forEach(form => form.classList.add('hidden'));
                tableContainers.forEach(container => container.classList.replace('md:col-span-2', 'md:col-span-3'));
            } else {
                adminPanelCard.classList.remove('hidden');
                adminForms.forEach(form => form.classList.remove('hidden'));
                tableContainers.forEach(container => container.classList.replace('md:col-span-3', 'md:col-span-2'));
            }
            
            fetchAndRenderTable('chemicals');
            fetchAndRenderTable('materials');
            fetchAndRenderTable('equipment');
            fetchAndRenderTable('apparatus');
            fetchAndRenderTable('suppliers');
            fetchAndRenderTable('budgets');
            refreshAlerts(justLoggedIn);
            justLoggedIn = false;
        } else {
            viewAuth.classList.remove('hidden');
            viewHome.classList.add('hidden');
            viewDetail.classList.add('hidden');
            btnLogout.classList.add('hidden');
            roleBadge.classList.add('hidden');
            notificationBell.classList.add('hidden');
            hideAlertsModal();
        }
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        justLoggedIn = true;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            justLoggedIn = false;
            authError.innerText = error.message;
            authError.classList.remove('hidden');
        } else { authForm.reset(); }
    });

    btnLogout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        resetFormsAndState();
    });

    // ADMIN INVITE LOGIC
    document.getElementById('invite-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('invite-message');
        const name = document.getElementById('invite-name').value;
        const email = document.getElementById('invite-email').value;
        const role = document.getElementById('invite-role').value;

        msg.classList.remove('hidden', 'text-green-600', 'text-red-600');
        msg.classList.add('text-zinc-400');
        msg.innerText = "Sending invite...";

        const { data, error } = await supabaseClient.functions.invoke('invite-user', {
            body: { email, name, role }
        });

        if (error) {
            msg.classList.replace('text-zinc-400', 'text-red-500');
            msg.innerText = "Failed to send invite. Check Edge Function setup.";
            console.error(error);
        } else {
            msg.classList.replace('text-zinc-400', 'text-emerald-500');
            msg.innerText = `Invite sent successfully to ${email}!`;
            e.target.reset();
        }
    });

    const workspaces = {
        chemicals: document.getElementById('chemicals-workspace'),
        materials: document.getElementById('materials-workspace'),
        equipment: document.getElementById('equipment-workspace'),
        apparatus: document.getElementById('apparatus-workspace'),
        suppliers: document.getElementById('suppliers-workspace'),
        budget: document.getElementById('budget-workspace'),
        'admin-settings': document.getElementById('admin-settings-workspace')
    };

    const divisionData = {
        chemicals: { title: "Chemicals Database Division", description: "Displaying real-time liquid inventory volume states, classifications, active CAS numbers, low-stock alerts, and localized warehouse tracking data tables." },
        materials: { title: "Materials & Engineering Stocks Workspace", description: "Tracking consumable media allocations, physical sample properties, structural specimens, and substrate counts, with low-stock alerts." },
        equipment: { title: "Lab Equipment & Instrument Registry Sheets", description: "Monitoring classifications, calibration/maintenance schedules, active borrowing logs, and digital micro-hardware units." },
        apparatus: { title: "Lab Apparatus Division", description: "Glassware, ovens/furnaces/vacuum equipment, filter paper and other consumables — with low-stock alerts." },
        suppliers: { title: "Suppliers Directory", description: "Contact details for vendors of chemicals, equipment, apparatus, and materials." },
        budget: { title: "Annual Budget Tracker", description: "Allocated vs. spent budget per category, per fiscal year." },
        'admin-settings': { title: "Portal Administration", description: "Manage user access and send secure email invitations to new students or faculty members." }
    };

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    function isLowStock(item) {
        const stock = parseFloat(item.stock);
        const threshold = parseFloat(item.low_stock_threshold);
        if (isNaN(stock) || isNaN(threshold)) return false;
        return stock <= threshold;
    }

    function lowStockBadge(item) {
        return isLowStock(item) ? ' <span class="inline-block bg-red-500/15 text-red-400 border border-red-900 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">LOW STOCK</span>' : '';
    }

    function dueBadge(dateStr) {
        if (!dateStr) return '<span class="text-zinc-600 text-xs">—</span>';
        const due = new Date(dateStr);
        const today = new Date();
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        let cls = 'bg-emerald-500/15 text-emerald-400 border border-emerald-900';
        let label = dateStr;
        if (diffDays < 0) { cls = 'bg-red-500/15 text-red-400 border border-red-900'; label += ' (OVERDUE)'; }
        else if (diffDays <= DUE_SOON_DAYS) { cls = 'bg-amber-500/15 text-amber-400 border border-amber-900'; label += ' (DUE SOON)'; }
        return `<span class="inline-block ${cls} text-[11px] font-semibold px-2 py-0.5 rounded-full">${label}</span>`;
    }

    // ------------------------------------------------------------------
    // Login / real-time notification system: low stock + calibration/maintenance due
    // ------------------------------------------------------------------
    const DIVISION_LABEL = { chemicals: 'Chemicals', materials: 'Materials', apparatus: 'Lab Apparatus', equipment: 'Lab Equipment' };
    const DIVISION_CATEGORY_FIELD = { chemicals: 'classification', materials: 'category', apparatus: 'category' };

    function getDueStatus(dateStr) {
        if (!dateStr) return null;
        const due = new Date(dateStr);
        const today = new Date();
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'OVERDUE', diffDays };
        if (diffDays <= DUE_SOON_DAYS) return { label: 'DUE SOON', diffDays };
        return null;
    }

    async function gatherAlerts() {
        const alerts = { lowStock: [], calibration: [] };

        for (const table of ['chemicals', 'materials', 'apparatus']) {
            const { data, error } = await supabaseClient.from(table).select('*');
            if (error || !data) continue;
            data.forEach(item => {
                if (isLowStock(item)) {
                    alerts.lowStock.push({
                        name: item.name,
                        division: DIVISION_LABEL[table],
                        category: item[DIVISION_CATEGORY_FIELD[table]] || 'Uncategorized',
                        stock: item.stock,
                        unit: item.unit || '',
                        threshold: item.low_stock_threshold
                    });
                }
            });
        }

        const { data: eqData, error: eqError } = await supabaseClient.from('equipment').select('*');
        if (!eqError && eqData) {
            eqData.forEach(item => {
                const calStatus = getDueStatus(item.next_calibration_date);
                const maintStatus = getDueStatus(item.next_maintenance_date);
                if (calStatus) alerts.calibration.push({
                    name: item.name, division: DIVISION_LABEL.equipment, category: item.classification || 'Uncategorized',
                    type: 'Calibration', status: calStatus.label, date: item.next_calibration_date, diffDays: calStatus.diffDays
                });
                if (maintStatus) alerts.calibration.push({
                    name: item.name, division: DIVISION_LABEL.equipment, category: item.classification || 'Uncategorized',
                    type: 'Maintenance', status: maintStatus.label, date: item.next_maintenance_date, diffDays: maintStatus.diffDays
                });
            });
        }

        // Most urgent first (overdue before due-soon, most overdue first)
        alerts.calibration.sort((a, b) => a.diffDays - b.diffDays);
        return alerts;
    }

    function renderAlerts(alerts) {
        const totalCount = alerts.lowStock.length + alerts.calibration.length;

        if (totalCount === 0) {
            notificationContent.innerHTML = `<p class="text-sm text-zinc-400">You're all caught up — nothing is low on stock and no equipment calibration/maintenance is due.</p>`;
        } else {
            let html = '';
            if (alerts.lowStock.length) {
                html += `<h4 class="font-bold text-zinc-100 text-sm mb-2">Low Stock — ${alerts.lowStock.length} item${alerts.lowStock.length !== 1 ? 's' : ''}</h4><ul class="space-y-2 mb-5">`;
                alerts.lowStock.forEach(a => {
                    html += `<li class="text-sm border-l-4 border-red-600 bg-red-500/10 rounded-r-lg px-3 py-2">
                        <div class="font-semibold text-zinc-100">${a.name}</div>
                        <div class="text-xs text-zinc-500 mb-1">${a.division} &middot; ${a.category}</div>
                        <div class="text-red-400 text-xs font-medium">${a.stock} ${a.unit} remaining (alert level: ${a.threshold})</div>
                    </li>`;
                });
                html += `</ul>`;
            }
            if (alerts.calibration.length) {
                html += `<h4 class="font-bold text-zinc-100 text-sm mb-2">Calibration / Maintenance Due — ${alerts.calibration.length} item${alerts.calibration.length !== 1 ? 's' : ''}</h4><ul class="space-y-2">`;
                alerts.calibration.forEach(a => {
                    const overdue = a.status === 'OVERDUE';
                    const borderCls = overdue ? 'border-red-600 bg-red-500/10' : 'border-amber-600 bg-amber-500/10';
                    const textCls = overdue ? 'text-red-400' : 'text-amber-400';
                    html += `<li class="text-sm border-l-4 ${borderCls} rounded-r-lg px-3 py-2">
                        <div class="font-semibold text-zinc-100">${a.name}</div>
                        <div class="text-xs text-zinc-500 mb-1">${a.division} &middot; ${a.category}</div>
                        <div class="${textCls} text-xs font-medium">${a.type} ${a.status} — due ${a.date}</div>
                    </li>`;
                });
                html += `</ul>`;
            }
            notificationContent.innerHTML = html;
        }

        if (totalCount > 0) {
            notificationBadge.innerText = totalCount > 99 ? '99+' : totalCount;
            notificationBadge.classList.remove('hidden');
        } else {
            notificationBadge.classList.add('hidden');
        }
        notificationBell.classList.remove('hidden');
        return totalCount;
    }

    async function refreshAlerts(autoOpen) {
        const alerts = await gatherAlerts();
        window.__cbmesAlerts = alerts;
        const totalCount = renderAlerts(alerts);
        if (autoOpen && totalCount > 0) openAlertsModal();
    }

    function openAlertsModal() { notificationModal.classList.remove('hidden'); }
    function hideAlertsModal() { notificationModal.classList.add('hidden'); }

    notificationBell.addEventListener('click', async () => { await refreshAlerts(false); openAlertsModal(); });
    closeNotificationModal.addEventListener('click', hideAlertsModal);
    dismissNotificationBtn.addEventListener('click', hideAlertsModal);
    notificationModal.addEventListener('click', (e) => { if (e.target === notificationModal) hideAlertsModal(); });

    // Every list in the portal is sorted alphabetically by its primary name/label field
    const SORT_FIELD = {
        chemicals: 'name', materials: 'name', equipment: 'name', apparatus: 'name',
        suppliers: 'name', budgets: 'category'
    };

    function sortAlphabetically(table, data) {
        const field = SORT_FIELD[table] || 'name';
        return [...data].sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || ''), undefined, { sensitivity: 'base' }));
    }

    async function fetchAndRenderTable(table) {
        const { data, error } = await supabaseClient.from(table).select('*');
        if (error) { console.error(`Error fetching ${table}:`, error); return; }

        const tbody = document.getElementById(`${table}-table-body`);
        if (!tbody) return;

        const sorted = sortAlphabetically(table, data);

        tbody.innerHTML = sorted.map(i => {
            let actionButtons = '';
            if (currentUserRole === 'Admin') {
                actionButtons = `<button onclick="editItem('${table}', ${i.id})" class="text-blue-600 hover:underline">Edit</button>
                                 <button onclick="deleteItem('${table}', ${i.id})" class="text-red-600 hover:underline">Delete</button>`;
            } else if (STOCK_TABLES.has(table) || table === 'equipment') {
                const currentVal = table === 'equipment' ? i.status : i.stock;
                actionButtons = `<button onclick="adjustStock('${table}', ${i.id}, '${currentVal}')" class="text-amber-600 hover:underline">Adjust</button>`;
            }

            if (table === 'chemicals') {
                return `<tr><td class="py-3">${i.name}${lowStockBadge(i)}</td><td>${i.classification || '—'}</td><td>${i.cas}</td><td>${i.stock} ${i.unit || ''}</td><td>${i.grade}</td><td>${i.location}</td><td>${i.supplier || '—'}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            }
            if (table === 'materials') {
                return `<tr><td class="py-3">${i.name}${lowStockBadge(i)}</td><td>${i.category}</td><td>${i.stock} ${i.unit || ''}</td><td>${i.supplier || '—'}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            }
            if (table === 'equipment') {
                return `<tr><td class="py-3">${i.name}</td><td>${i.serial}</td><td>${i.classification || '—'}</td><td>${i.status}</td><td>${dueBadge(i.next_calibration_date)}</td><td>${dueBadge(i.next_maintenance_date)}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            }
            if (table === 'apparatus') {
                return `<tr><td class="py-3">${i.name}${lowStockBadge(i)}</td><td>${i.category}</td><td>${i.stock} ${i.unit || ''}</td><td>${i.location || '—'}</td><td>${i.supplier || '—'}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            }
            if (table === 'suppliers') {
                return `<tr><td class="py-3">${i.name}</td><td>${i.category || '—'}</td><td>${i.contact_person || '—'}</td><td>${i.phone || '—'}</td><td>${i.email || '—'}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            }
            if (table === 'budgets') {
                const remaining = (parseFloat(i.allocated_amount) || 0) - (parseFloat(i.spent_amount) || 0);
                const remainingCls = remaining < 0 ? 'text-red-500 font-bold' : 'text-emerald-500';
                return `<tr><td class="py-3">${i.fiscal_year}</td><td>${i.category}</td><td>₱${Number(i.allocated_amount).toLocaleString()}</td><td>₱${Number(i.spent_amount || 0).toLocaleString()}</td><td class="${remainingCls}">₱${remaining.toLocaleString()}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            }
        }).join('');
    }

    window.deleteItem = async (table, id) => {
        if (currentUserRole !== 'Admin') return alert("Unauthorized.");
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) alert(`Failed to delete: ${error.message}`);
        else {
            fetchAndRenderTable(table);
            if (table === 'chemicals' || table === 'materials' || table === 'apparatus' || table === 'equipment') refreshAlerts(false);
        }
    };

    window.editItem = async (table, id) => {
        if (currentUserRole !== 'Admin') return alert("Unauthorized.");
        const { data, error } = await supabaseClient.from(table).select('*').eq('id', id).single();
        if (error || !data) { alert(`Failed to load item: ${error.message}`); return; }

        editState[table] = id; 
        if (table === 'chemicals') {
            document.getElementById('chem-name').value = data.name;
            document.getElementById('chem-cas').value = data.cas;
            document.getElementById('chem-classification').value = data.classification || 'Acid';
            document.getElementById('chem-stock').value = data.stock;
            document.getElementById('chem-unit').value = data.unit || '';
            document.getElementById('chem-threshold').value = data.low_stock_threshold || 0;
            document.getElementById('chem-grade').value = data.grade;
            document.getElementById('chem-location').value = data.location;
            document.getElementById('chem-supplier').value = data.supplier || '';
            document.getElementById('chem-cost').value = data.unit_cost || '';
            document.querySelector('#chemical-form button[type="submit"]').innerText = "Update";
        } else if (table === 'materials') {
            document.getElementById('mat-name').value = data.name;
            document.getElementById('mat-category').value = data.category;
            document.getElementById('mat-stock').value = data.stock;
            document.getElementById('mat-unit').value = data.unit || '';
            document.getElementById('mat-threshold').value = data.low_stock_threshold || 0;
            document.getElementById('mat-supplier').value = data.supplier || '';
            document.querySelector('#material-form button[type="submit"]').innerText = "Update";
        } else if (table === 'equipment') {
            document.getElementById('eq-name').value = data.name;
            document.getElementById('eq-serial').value = data.serial;
            document.getElementById('eq-classification').value = data.classification || 'General';
            document.getElementById('eq-status').value = data.status;
            document.getElementById('eq-cal-date').value = data.calibration_date || '';
            document.getElementById('eq-next-cal-date').value = data.next_calibration_date || '';
            document.getElementById('eq-maint-date').value = data.maintenance_date || '';
            document.getElementById('eq-next-maint-date').value = data.next_maintenance_date || '';
            document.getElementById('eq-supplier').value = data.supplier || '';
            document.querySelector('#equipment-form button[type="submit"]').innerText = "Update";
        } else if (table === 'apparatus') {
            document.getElementById('app-name').value = data.name;
            document.getElementById('app-category').value = data.category;
            document.getElementById('app-stock').value = data.stock;
            document.getElementById('app-unit').value = data.unit || '';
            document.getElementById('app-threshold').value = data.low_stock_threshold || 0;
            document.getElementById('app-location').value = data.location || '';
            document.getElementById('app-supplier').value = data.supplier || '';
            document.querySelector('#apparatus-form button[type="submit"]').innerText = "Update";
        } else if (table === 'suppliers') {
            document.getElementById('sup-name').value = data.name;
            document.getElementById('sup-category').value = data.category || 'General';
            document.getElementById('sup-contact').value = data.contact_person || '';
            document.getElementById('sup-phone').value = data.phone || '';
            document.getElementById('sup-email').value = data.email || '';
            document.getElementById('sup-items').value = data.items_supplied || '';
            document.querySelector('#supplier-form button[type="submit"]').innerText = "Update";
        } else if (table === 'budgets') {
            document.getElementById('bud-year').value = data.fiscal_year;
            document.getElementById('bud-category').value = data.category;
            document.getElementById('bud-allocated').value = data.allocated_amount;
            document.getElementById('bud-spent').value = data.spent_amount || 0;
            document.getElementById('bud-notes').value = data.notes || '';
            document.querySelector('#budget-form button[type="submit"]').innerText = "Update";
        }
    };

    window.adjustStock = async (table, id, currentVal) => {
        const message = table === 'equipment' ? `Current Status is: ${currentVal}\nEnter new status (Available / In Use / Maintenance):` : `Current Stock is: ${currentVal}\nEnter new amount after taking/adding:`;
        const newVal = prompt(message, currentVal);
        
        if (newVal !== null && newVal !== currentVal) {
            const updateField = table === 'equipment' ? { status: newVal } : { stock: newVal };
            const { error } = await supabaseClient.from(table).update(updateField).eq('id', id);
            if (error) alert(`Failed to update: ${error.message}`);
            else { fetchAndRenderTable(table); refreshAlerts(false); }
        }
    };

    async function handleFormSubmit(e, table, payload) {
        e.preventDefault();
        if (currentUserRole !== 'Admin') return alert("Unauthorized.");
        
        let error;
        if (editState[table]) {
            const response = await supabaseClient.from(table).update(payload).eq('id', editState[table]);
            error = response.error;
            if(!error) editState[table] = null;
        } else {
            const response = await supabaseClient.from(table).insert([payload]);
            error = response.error;
        }

        if (error) alert(`Database Error: ${error.message}`); 
        else {
            fetchAndRenderTable(table); e.target.reset(); e.target.querySelector('button[type="submit"]').innerText = "Save";
            if (table === 'chemicals' || table === 'materials' || table === 'apparatus' || table === 'equipment') refreshAlerts(false);
        }
    }

    document.getElementById('chemical-form').addEventListener('submit', (e) => handleFormSubmit(e, 'chemicals', {
        name: document.getElementById('chem-name').value,
        cas: document.getElementById('chem-cas').value,
        classification: document.getElementById('chem-classification').value,
        stock: document.getElementById('chem-stock').value,
        unit: document.getElementById('chem-unit').value,
        low_stock_threshold: document.getElementById('chem-threshold').value,
        grade: document.getElementById('chem-grade').value,
        location: document.getElementById('chem-location').value,
        supplier: document.getElementById('chem-supplier').value,
        unit_cost: document.getElementById('chem-cost').value || null
    }));

    document.getElementById('material-form').addEventListener('submit', (e) => handleFormSubmit(e, 'materials', {
        name: document.getElementById('mat-name').value,
        category: document.getElementById('mat-category').value,
        stock: document.getElementById('mat-stock').value,
        unit: document.getElementById('mat-unit').value,
        low_stock_threshold: document.getElementById('mat-threshold').value,
        supplier: document.getElementById('mat-supplier').value
    }));

    document.getElementById('equipment-form').addEventListener('submit', (e) => handleFormSubmit(e, 'equipment', {
        name: document.getElementById('eq-name').value,
        serial: document.getElementById('eq-serial').value,
        classification: document.getElementById('eq-classification').value,
        status: document.getElementById('eq-status').value,
        calibration_date: document.getElementById('eq-cal-date').value || null,
        next_calibration_date: document.getElementById('eq-next-cal-date').value || null,
        maintenance_date: document.getElementById('eq-maint-date').value || null,
        next_maintenance_date: document.getElementById('eq-next-maint-date').value || null,
        supplier: document.getElementById('eq-supplier').value
    }));

    document.getElementById('apparatus-form').addEventListener('submit', (e) => handleFormSubmit(e, 'apparatus', {
        name: document.getElementById('app-name').value,
        category: document.getElementById('app-category').value,
        stock: document.getElementById('app-stock').value,
        unit: document.getElementById('app-unit').value,
        low_stock_threshold: document.getElementById('app-threshold').value,
        location: document.getElementById('app-location').value,
        supplier: document.getElementById('app-supplier').value
    }));

    document.getElementById('supplier-form').addEventListener('submit', (e) => handleFormSubmit(e, 'suppliers', {
        name: document.getElementById('sup-name').value,
        category: document.getElementById('sup-category').value,
        contact_person: document.getElementById('sup-contact').value,
        phone: document.getElementById('sup-phone').value,
        email: document.getElementById('sup-email').value,
        items_supplied: document.getElementById('sup-items').value
    }));

    document.getElementById('budget-form').addEventListener('submit', (e) => handleFormSubmit(e, 'budgets', {
        fiscal_year: document.getElementById('bud-year').value,
        category: document.getElementById('bud-category').value,
        allocated_amount: document.getElementById('bud-allocated').value,
        spent_amount: document.getElementById('bud-spent').value || 0,
        notes: document.getElementById('bud-notes').value
    }));

    function resetFormsAndState() {
        editState = { chemicals: null, materials: null, equipment: null, apparatus: null, suppliers: null, budgets: null };
        document.querySelectorAll('form').forEach(f => { f.reset(); const btn = f.querySelector('button[type="submit"]'); if(btn) btn.innerText = "Save"; });
    }

    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetDivision = button.getAttribute('data-target');
            if (divisionData[targetDivision]) {
                if(divisionTitle) divisionTitle.innerText = divisionData[targetDivision].title;
                if(divisionDesc) divisionDesc.innerText = divisionData[targetDivision].description;
                viewHome.classList.add('hidden');
                viewDetail.classList.remove('hidden');
                Object.keys(workspaces).forEach(key => { if (workspaces[key]) workspaces[key].classList.toggle('hidden', key !== targetDivision); });
                resetFormsAndState();
            }
        });
    });

    backBtn.addEventListener('click', () => { viewDetail.classList.add('hidden'); viewHome.classList.remove('hidden'); resetFormsAndState(); });

    // ------------------------------------------------------------------
    // Report export: CSV and PDF, per division, using the same alphabetical
    // sort order shown on screen.
    // ------------------------------------------------------------------
    const EXPORT_CONFIG = {
        chemicals: {
            title: "Chemicals Inventory Report",
            columns: [
                { key: 'name', label: 'Name' }, { key: 'classification', label: 'Classification' },
                { key: 'cas', label: 'CAS Number' }, { key: 'stock', label: 'Stock' }, { key: 'unit', label: 'Unit' },
                { key: 'grade', label: 'Grade' }, { key: 'location', label: 'Location' },
                { key: 'supplier', label: 'Supplier' }, { key: 'unit_cost', label: 'Unit Cost (PHP)' },
            ]
        },
        materials: {
            title: "Materials Inventory Report",
            columns: [
                { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
                { key: 'stock', label: 'Stock' }, { key: 'unit', label: 'Unit' }, { key: 'supplier', label: 'Supplier' },
            ]
        },
        equipment: {
            title: "Lab Equipment Registry Report",
            columns: [
                { key: 'name', label: 'Name' }, { key: 'serial', label: 'Serial #' }, { key: 'classification', label: 'Class' },
                { key: 'status', label: 'Status' }, { key: 'next_calibration_date', label: 'Next Calibration' },
                { key: 'next_maintenance_date', label: 'Next Maintenance' }, { key: 'supplier', label: 'Supplier' },
            ]
        },
        apparatus: {
            title: "Lab Apparatus Inventory Report",
            columns: [
                { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }, { key: 'stock', label: 'Stock' },
                { key: 'unit', label: 'Unit' }, { key: 'location', label: 'Location' }, { key: 'supplier', label: 'Supplier' },
            ]
        },
        suppliers: {
            title: "Suppliers Directory Report",
            columns: [
                { key: 'name', label: 'Company' }, { key: 'category', label: 'Category' }, { key: 'contact_person', label: 'Contact' },
                { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'items_supplied', label: 'Items Supplied' },
            ]
        },
        budgets: {
            title: "Annual Budget Report",
            columns: [
                { key: 'fiscal_year', label: 'Year' }, { key: 'category', label: 'Category' },
                { key: 'allocated_amount', label: 'Allocated (PHP)' }, { key: 'spent_amount', label: 'Spent (PHP)' },
                { key: 'notes', label: 'Notes' },
            ]
        }
    };

    async function getExportRows(table) {
        const { data, error } = await supabaseClient.from(table).select('*');
        if (error || !data) { alert(`Could not load ${table} for export: ${error ? error.message : 'no data'}`); return null; }
        return sortAlphabetically(table, data);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function csvEscape(val) {
        if (val === null || val === undefined) return '';
        const s = String(val);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    async function exportCSV(table) {
        const config = EXPORT_CONFIG[table];
        const rows = await getExportRows(table);
        if (!rows) return;
        const header = config.columns.map(c => csvEscape(c.label)).join(',');
        const lines = rows.map(row => config.columns.map(c => csvEscape(row[c.key])).join(','));
        const csv = [header, ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const dateStr = new Date().toISOString().split('T')[0];
        downloadBlob(blob, `CBMES_${table}_${dateStr}.csv`);
    }

    async function exportPDF(table) {
        const config = EXPORT_CONFIG[table];
        const rows = await getExportRows(table);
        if (!rows) return;
        if (typeof window.jspdf === 'undefined') { alert('PDF export library did not load. Check your internet connection and try again.'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const dateStr = new Date().toLocaleDateString();

        doc.setFontSize(14); doc.setTextColor(128, 0, 0);
        doc.text('Mapúa CBMES Inventory Management Portal', 40, 40);
        doc.setFontSize(11); doc.setTextColor(60, 60, 60);
        doc.text(config.title, 40, 58);
        doc.setFontSize(8); doc.setTextColor(120, 120, 120);
        doc.text(`Generated ${dateStr} — ${rows.length} record${rows.length !== 1 ? 's' : ''}`, 40, 72);

        doc.autoTable({
            startY: 85,
            head: [config.columns.map(c => c.label)],
            body: rows.map(row => config.columns.map(c => (row[c.key] === null || row[c.key] === undefined) ? '' : String(row[c.key]))),
            styles: { fontSize: 7, cellPadding: 4 },
            headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 40, right: 40 },
        });

        const dateFile = new Date().toISOString().split('T')[0];
        doc.save(`CBMES_${table}_${dateFile}.pdf`);
    }

    document.querySelectorAll('[data-export-csv]').forEach(btn => {
        btn.addEventListener('click', () => exportCSV(btn.getAttribute('data-export-csv')));
    });
    document.querySelectorAll('[data-export-pdf]').forEach(btn => {
        btn.addEventListener('click', () => exportPDF(btn.getAttribute('data-export-pdf')));
    });

});

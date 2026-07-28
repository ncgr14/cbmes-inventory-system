const SUPABASE_URL = 'https://faddbjtlvmfteevktkyf.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_UW105oLT1XuhIHmjzIgOxg_zNiEFHvw'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const viewAuth = document.getElementById('view-auth');
    const viewHome = document.getElementById('view-home');
    const viewDetail = document.getElementById('view-division-detail');
    const viewSetPassword = document.getElementById('view-set-password');
    
    const divisionTitle = document.getElementById('division-title');
    const divisionDesc = document.getElementById('division-desc');
    const backBtn = document.getElementById('back-home-btn');
    
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');
    const authSuccess = document.getElementById('auth-success');
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
    const setPasswordForm = document.getElementById('set-password-form');
    const setPasswordError = document.getElementById('set-password-error');

    let currentUserRole = 'Student';
    let currentUserName = 'User';
    let currentUserId = null;
    let currentStudentNumber = '—';
    let justLoggedIn = false;
    let initialHashHandled = false;
    let isPasswordSetupFlow = false;
    let editState = { chemicals: null, materials: null, equipment: null, apparatus: null, suppliers: null, budgets: null };
    let tableDataCache = {};

    // How many days ahead counts as "due soon" for calibration/maintenance
    const DUE_SOON_DAYS = 30;

    // ------------------------------------------------------------------
    // Invite / password-recovery detection.
    //
    // Supabase auto-authenticates an invite or recovery link the instant
    // it's opened — before the person has ever set a password. We have to
    // catch that exact moment and gate them into a "set your password"
    // screen instead of dropping them straight into the dashboard (or, if
    // the redirect/session detection has any hiccup, a dead-end login
    // screen with no way forward).
    //
    // Detection uses two signals:
    //  1. The raw URL hash, checked synchronously on load — Supabase's own
    //     client processes this hash asynchronously, so reading it
    //     ourselves first (before any await/promise resolves) reliably sees
    //     `type=invite` or `type=recovery` before it gets consumed/cleaned up.
    //  2. The PASSWORD_RECOVERY event from onAuthStateChange, as a second,
    //     Supabase-documented signal that catches cases the hash check
    //     might miss.
    //
    // Known limitation: this only reliably fires on the initial click-through
    // from the email link. If someone abandons the set-password screen
    // (closes the tab without submitting) and returns later, the
    // authenticated session persists but the hash is gone, so they'd land
    // back in the app without the gate. Acceptable tradeoff for this tool's
    // scale; flagging it rather than hiding it.
    (function detectInviteOrRecoveryFlow() {
        const hash = window.location.hash || '';
        if (hash.includes('type=invite') || hash.includes('type=recovery')) {
            isPasswordSetupFlow = true;
        }
    })();

    function showOnlySetPasswordScreen() {
        viewAuth.classList.add('hidden');
        viewHome.classList.add('hidden');
        viewDetail.classList.add('hidden');
        viewSetPassword.classList.remove('hidden');
        btnLogout.classList.add('hidden');
        roleBadge.classList.add('hidden');
        notificationBell.classList.add('hidden');
    }

    supabaseClient.auth.getSession().then(({ data: { session } }) => { handleSession(session, 'INITIAL_SESSION'); });
    supabaseClient.auth.onAuthStateChange((event, session) => { handleSession(session, event); });

    function handleSession(session, event) {
        if (event === 'PASSWORD_RECOVERY') {
            isPasswordSetupFlow = true;
        }

        if (session) {
            if (isPasswordSetupFlow) {
                showOnlySetPasswordScreen();
                return;
            }

            const userName = session.user.user_metadata?.full_name || 'User';
            currentUserName = userName;
            currentUserId = session.user.id;
            currentUserRole = session.user.user_metadata?.role || 'Student';
            currentStudentNumber = session.user.user_metadata?.student_number || '—';

            // Only transition away from the login screen once. Subsequent calls to
            // handleSession happen in the background (token refresh, tab refocus)
            // and must not clobber whichever view (home vs. a division) the user
            // is currently looking at.
            const isFirstLoad = !viewAuth.classList.contains('hidden');
            if (isFirstLoad) {
                viewAuth.classList.add('hidden');
                viewSetPassword.classList.add('hidden');
                viewHome.classList.remove('hidden');
            }
            btnLogout.classList.remove('hidden');
            
            welcomeText.innerText = `Welcome to the Mapúa CBMES Inventory Management Portal, ${userName}.`;
            roleBadge.innerText = currentUserRole;
            roleBadge.classList.remove('hidden');

            if (!initialHashHandled) {
                initialHashHandled = true;
                const hash = window.location.hash.replace('#', '');
                if (hash && divisionData[hash] && (hash !== 'admin-settings' || currentUserRole === 'Admin')) {
                    openDivision(hash, false);
                }
            }

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
            viewSetPassword.classList.add('hidden');
            btnLogout.classList.add('hidden');
            roleBadge.classList.add('hidden');
            notificationBell.classList.add('hidden');
            hideAlertsModal();
            initialHashHandled = false;
            currentUserName = 'User';
            currentUserId = null;
            currentStudentNumber = '—';
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

    setPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setPasswordError.classList.add('hidden');

        const newPassword = document.getElementById('set-password-new').value;
        const confirmPassword = document.getElementById('set-password-confirm').value;

        if (newPassword !== confirmPassword) {
            setPasswordError.innerText = "Passwords don't match.";
            setPasswordError.classList.remove('hidden');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError.innerText = "Password must be at least 6 characters.";
            setPasswordError.classList.remove('hidden');
            return;
        }

        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) {
            setPasswordError.innerText = error.message;
            setPasswordError.classList.remove('hidden');
            return;
        }

        // Account is created. Sign out and land back on the normal login
        // screen so they log in fresh with their new password, rather than
        // silently continuing an existing session.
        isPasswordSetupFlow = false;
        history.replaceState(null, '', window.location.pathname + window.location.search);
        await supabaseClient.auth.signOut();

        setPasswordForm.reset();
        authSuccess.innerText = "Your account is ready — please log in with your new password.";
        authSuccess.classList.remove('hidden');
    });

    // ADMIN INVITE LOGIC
    document.getElementById('invite-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('invite-message');
        const firstName = document.getElementById('invite-first-name').value;
        const lastName = document.getElementById('invite-last-name').value;
        const studentNum = document.getElementById('invite-student-num').value;
        const email = document.getElementById('invite-email').value;
        const role = document.getElementById('invite-role').value;

        msg.classList.remove('hidden', 'text-green-600', 'text-red-600');
        msg.classList.add('text-zinc-400');
        msg.innerText = "Sending invite...";

        const { data, error } = await supabaseClient.functions.invoke('invite-user', {
            body: { email, first_name: firstName, last_name: lastName, student_num: studentNum, role }
        });

        if (error) {
            msg.classList.replace('text-zinc-400', 'text-red-500');
            msg.innerText = "Failed to send invite. Check Edge Function setup.";
            console.error(error);
        } else {
            msg.classList.replace('text-zinc-400', 'text-emerald-500');
            msg.innerText = `Invite sent successfully to ${email}!`;
            e.target.reset();
            fetchAndRenderPendingInvites();
        }
    });

    // ------------------------------------------------------------------
    // Pending Invites: list everyone who's been sent an invite (accepted or
    // not) with a live countdown to link expiry, and a way to cancel one.
    // ------------------------------------------------------------------
    function formatTimeRemaining(seconds) {
        if (seconds <= 0) return { label: 'Expired', cls: 'bg-zinc-700/40 text-zinc-500 border border-zinc-700' };
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const label = hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
        const cls = seconds <= 600
            ? 'bg-red-500/15 text-red-400 border border-red-900'
            : seconds <= 1800
                ? 'bg-amber-500/15 text-amber-400 border border-amber-900'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-900';
        return { label, cls };
    }

    async function fetchAndRenderPendingInvites() {
        const tbody = document.getElementById('pending-invites-table-body');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-zinc-500 text-sm">Loading…</td></tr>`;

        const { data, error } = await supabaseClient.functions.invoke('manage-invites', { body: { action: 'list' } });

        if (error || !data || !data.invites) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-red-500 text-sm">Failed to load invites. Check Edge Function setup.</td></tr>`;
            console.error(error);
            return;
        }

        if (data.invites.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-zinc-500 text-sm">No invitations sent yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.invites.map(inv => {
            const invitedDate = new Date(inv.invited_at).toLocaleString();
            let statusCell, expiresCell;
            if (inv.accepted) {
                statusCell = `<span class="inline-block bg-emerald-500/15 text-emerald-400 border border-emerald-900 text-[11px] font-semibold px-2 py-0.5 rounded-full">Accepted</span>`;
                expiresCell = `<span class="text-zinc-600 text-xs">—</span>`;
            } else {
                const rem = formatTimeRemaining(inv.seconds_remaining);
                statusCell = `<span class="inline-block bg-amber-500/15 text-amber-400 border border-amber-900 text-[11px] font-semibold px-2 py-0.5 rounded-full">Pending</span>`;
                expiresCell = `<span class="inline-block ${rem.cls} text-[11px] font-semibold px-2 py-0.5 rounded-full">${rem.label}</span>`;
            }
            return `<tr>
                <td class="py-3">${inv.name}</td>
                <td>${inv.student_number || '—'}</td>
                <td>${inv.email}</td>
                <td>${inv.role}</td>
                <td>${statusCell}</td>
                <td title="Invited ${invitedDate}">${expiresCell}</td>
                <td class="text-right"><button onclick="cancelInvite('${inv.id}', '${inv.email.replace(/'/g, "\\'")}')" class="text-red-600 hover:underline">Delete</button></td>
            </tr>`;
        }).join('');
    }

    window.cancelInvite = async (userId, email) => {
        if (currentUserRole !== 'Admin') return alert("Unauthorized.");
        if (!confirm(`Delete the invitation for ${email}? This removes the account entirely — they'll need a brand new invite if you change your mind.`)) return;

        const { data, error } = await supabaseClient.functions.invoke('manage-invites', {
            body: { action: 'cancel', user_id: userId }
        });

        if (error) {
            alert(`Failed to delete invitation: ${error.message || 'Check Edge Function setup.'}`);
            console.error(error);
        } else {
            fetchAndRenderPendingInvites();
        }
    };

    const refreshInvitesBtn = document.getElementById('refresh-invites-btn');
    if (refreshInvitesBtn) {
        refreshInvitesBtn.addEventListener('click', fetchAndRenderPendingInvites);
    }

    const workspaces = {
        chemicals: document.getElementById('chemicals-workspace'),
        materials: document.getElementById('materials-workspace'),
        equipment: document.getElementById('equipment-workspace'),
        apparatus: document.getElementById('apparatus-workspace'),
        suppliers: document.getElementById('suppliers-workspace'),
        budget: document.getElementById('budget-workspace'),
        'admin-settings': document.getElementById('admin-settings-workspace'),
        timelog: document.getElementById('timelog-workspace'),
        requests: document.getElementById('requests-workspace')
    };

    const divisionData = {
        chemicals: { title: "Chemicals Database Division", description: "Displaying real-time liquid inventory volume states, classifications, active CAS numbers, low-stock alerts, and localized warehouse tracking data tables." },
        materials: { title: "Materials & Engineering Stocks Workspace", description: "Tracking consumable media allocations, physical sample properties, structural specimens, and substrate counts, with low-stock alerts." },
        equipment: { title: "Lab Equipment & Instrument Registry Sheets", description: "Monitoring classifications, calibration/maintenance schedules, active borrowing logs, and digital micro-hardware units." },
        apparatus: { title: "Lab Apparatus Division", description: "Glassware, ovens/furnaces/vacuum equipment, filter paper and other consumables — with low-stock alerts." },
        suppliers: { title: "Suppliers Directory", description: "Contact details for vendors of chemicals, equipment, apparatus, and materials." },
        budget: { title: "Annual Budget Tracker", description: "Allocated vs. spent budget per category, per fiscal year." },
        'admin-settings': { title: "Portal Administration", description: "Manage user access and send secure email invitations to new students or faculty members." },
        timelog: { title: "Lab Time Log", description: "Time in and out of the lab, and record what equipment and chemicals were used during each session." },
        requests: { title: "Item Requests", description: "Request new chemicals or lab equipment that the department should stock." }
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
        return isLowStock(item) ? '<div class="mt-1"><span class="inline-block bg-red-500/15 text-red-400 border border-red-900 text-[10px] font-bold px-2 py-0.5 rounded-full">LOW STOCK</span></div>' : '';
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

    function actionButtonsFor(table, i) {
        if (currentUserRole === 'Admin') {
            return `<button onclick="editItem('${table}', ${i.id})" class="text-blue-600 hover:underline">Edit</button>
                    <button onclick="deleteItem('${table}', ${i.id})" class="text-red-600 hover:underline">Delete</button>`;
        }
        return '';
    }

    // Every table has its own row markup, but is rendered through the same
    // cache + search + filter pipeline (renderFilterableTable) so they all
    // behave identically.
    const ROW_HTML = {
        chemicals: (i) => {
            const cost = (i.unit_cost !== null && i.unit_cost !== undefined) ? `₱${Number(i.unit_cost).toLocaleString()}` : '—';
            return `<tr><td class="py-3">${i.name}${lowStockBadge(i)}</td><td>${i.classification || '—'}</td><td>${i.cas}</td><td>${i.stock} ${i.unit || ''}</td><td>${i.grade}</td><td>${i.location}</td><td>${i.supplier || '—'}</td><td>${cost}</td><td class="text-right space-x-3">${actionButtonsFor('chemicals', i)}</td></tr>`;
        },
        materials: (i) => `<tr><td class="py-3">${i.name}${lowStockBadge(i)}</td><td>${i.category}</td><td>${i.stock} ${i.unit || ''}</td><td>${i.supplier || '—'}</td><td class="text-right space-x-3">${actionButtonsFor('materials', i)}</td></tr>`,
        equipment: (i) => {
            const calCell = `<div class="flex items-center gap-2 flex-wrap text-xs whitespace-nowrap"><span class="text-zinc-500">Last: <span class="text-zinc-300">${i.calibration_date || '—'}</span></span><span class="text-zinc-500">Next: ${dueBadge(i.next_calibration_date)}</span></div>`;
            const maintCell = `<div class="flex items-center gap-2 flex-wrap text-xs whitespace-nowrap"><span class="text-zinc-500">Last: <span class="text-zinc-300">${i.maintenance_date || '—'}</span></span><span class="text-zinc-500">Next: ${dueBadge(i.next_maintenance_date)}</span></div>`;
            return `<tr><td class="py-3">${i.name}</td><td>${i.serial}</td><td>${i.classification || '—'}</td><td>${i.status}</td><td>${calCell}</td><td>${maintCell}</td><td>${i.supplier || '—'}</td><td class="text-right space-x-3">${actionButtonsFor('equipment', i)}</td></tr>`;
        },
        apparatus: (i) => `<tr><td class="py-3">${i.name}${lowStockBadge(i)}</td><td>${i.category}</td><td>${i.stock} ${i.unit || ''}</td><td>${i.location || '—'}</td><td>${i.supplier || '—'}</td><td class="text-right space-x-3">${actionButtonsFor('apparatus', i)}</td></tr>`,
        suppliers: (i) => `<tr><td class="py-3">${i.name}</td><td>${i.category || '—'}</td><td>${i.contact_person || '—'}</td><td>${i.phone || '—'}</td><td>${i.email || '—'}</td><td>${i.address || '—'}</td><td>${i.items_supplied || '—'}</td><td class="text-right space-x-3">${actionButtonsFor('suppliers', i)}</td></tr>`,
        budgets: (i) => {
            const remaining = (parseFloat(i.allocated_amount) || 0) - (parseFloat(i.spent_amount) || 0);
            const remainingCls = remaining < 0 ? 'text-red-500 font-bold' : 'text-emerald-500';
            return `<tr><td class="py-3">${i.fiscal_year}</td><td>${i.category}</td><td>₱${Number(i.allocated_amount).toLocaleString()}</td><td>₱${Number(i.spent_amount || 0).toLocaleString()}</td><td class="${remainingCls}">₱${remaining.toLocaleString()}</td><td>${i.notes || '—'}</td><td class="text-right space-x-3">${actionButtonsFor('budgets', i)}</td></tr>`;
        }
    };

    // Field(s) the search box matches against, and the field the filter
    // dropdown matches exactly, per table.
    const SEARCH_FIELDS = {
        chemicals: ['name'], materials: ['name'], equipment: ['name', 'serial'],
        apparatus: ['name'], suppliers: ['name'], budgets: ['category', 'notes']
    };
    const FILTER_FIELD = {
        chemicals: 'classification', materials: 'category', equipment: 'classification',
        apparatus: 'category', suppliers: 'category', budgets: 'category'
    };
    const TABLE_COLSPAN = { chemicals: 9, materials: 5, equipment: 8, apparatus: 6, suppliers: 8, budgets: 7 };

    // Applies whatever search text + category filter is currently set in a
    // division's toolbar to its cached data. Shared by on-screen rendering
    // and CSV/PDF export, so exporting only includes the selected category.
    function getFilteredItems(table) {
        const search = (document.getElementById(`${table}-search`)?.value || '').trim().toLowerCase();
        const filterVal = document.getElementById(`${table}-filter`)?.value || '';
        const filterField = FILTER_FIELD[table];
        const searchFields = SEARCH_FIELDS[table] || ['name'];

        let items = tableDataCache[table] || [];
        if (search) items = items.filter(i => searchFields.some(f => String(i[f] || '').toLowerCase().includes(search)));
        if (filterVal && filterField) items = items.filter(i => i[filterField] === filterVal);

        return sortAlphabetically(table, items);
    }

    function renderFilterableTable(table) {
        const tbody = document.getElementById(`${table}-table-body`);
        if (!tbody) return;

        const sorted = getFilteredItems(table);
        tbody.innerHTML = sorted.length
            ? sorted.map(ROW_HTML[table]).join('')
            : `<tr><td colspan="${TABLE_COLSPAN[table]}" class="py-4 text-zinc-500 text-sm">No matching records found.</td></tr>`;
    }

    async function fetchAndRenderTable(table) {
        const { data, error } = await supabaseClient.from(table).select('*');
        if (error) { console.error(`Error fetching ${table}:`, error); return; }
        tableDataCache[table] = data;
        renderFilterableTable(table);
    }

    ['chemicals', 'materials', 'equipment', 'apparatus', 'suppliers', 'budgets'].forEach(table => {
        const searchEl = document.getElementById(`${table}-search`);
        const filterEl = document.getElementById(`${table}-filter`);
        if (searchEl) searchEl.addEventListener('input', () => renderFilterableTable(table));
        if (filterEl) filterEl.addEventListener('change', () => renderFilterableTable(table));
    });

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
            document.getElementById('sup-address').value = data.address || '';
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

    document.getElementById('apparatus-form').addEventListener('submit', (e) => {
        const name = document.getElementById('app-name').value.trim();
        if (!editState.apparatus) {
            const dup = (tableDataCache.apparatus || []).find(i => (i.name || '').trim().toLowerCase() === name.toLowerCase());
            if (dup && !confirm(`An apparatus item named "${dup.name}" already exists in the list. Add it anyway?`)) {
                e.preventDefault();
                return;
            }
        }
        handleFormSubmit(e, 'apparatus', {
            name: document.getElementById('app-name').value,
            category: document.getElementById('app-category').value,
            stock: document.getElementById('app-stock').value,
            unit: document.getElementById('app-unit').value,
            low_stock_threshold: document.getElementById('app-threshold').value,
            location: document.getElementById('app-location').value,
            supplier: document.getElementById('app-supplier').value
        });
    });

    document.getElementById('supplier-form').addEventListener('submit', (e) => handleFormSubmit(e, 'suppliers', {
        name: document.getElementById('sup-name').value,
        category: document.getElementById('sup-category').value,
        contact_person: document.getElementById('sup-contact').value,
        phone: document.getElementById('sup-phone').value,
        email: document.getElementById('sup-email').value,
        address: document.getElementById('sup-address').value,
        items_supplied: document.getElementById('sup-items').value
    }));

    // ------------------------------------------------------------------
    // Record Stock Delivery: links a supplier delivery to (a) the actual
    // stock count of the item in its own division table, and (b) a running
    // log appended to that supplier's Items Supplied field.
    // ------------------------------------------------------------------
    const deliverySupplierSelect = document.getElementById('delivery-supplier');
    const deliveryDivisionSelect = document.getElementById('delivery-division');
    const deliveryItemSelect = document.getElementById('delivery-item');
    const deliveryForm = document.getElementById('delivery-form');
    const deliveryMessage = document.getElementById('delivery-message');
    let deliveryItemCache = {}; // id -> {name, stock, unit}

    async function populateDeliverySuppliers() {
        const { data, error } = await supabaseClient.from('suppliers').select('id, name');
        if (error || !data) return;
        const sorted = [...data].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
        deliverySupplierSelect.innerHTML = '<option value="">Select supplier…</option>' +
            sorted.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    async function populateDeliveryItems() {
        const table = deliveryDivisionSelect.value;
        const { data, error } = await supabaseClient.from(table).select('id, name, stock, unit');
        deliveryItemCache = {};
        if (error || !data) { deliveryItemSelect.innerHTML = '<option value="">Select item…</option>'; return; }
        const sorted = [...data].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
        sorted.forEach(item => { deliveryItemCache[item.id] = item; });
        deliveryItemSelect.innerHTML = '<option value="">Select item…</option>' +
            sorted.map(item => `<option value="${item.id}">${item.name} (currently ${item.stock} ${item.unit || ''})</option>`).join('');
    }

    if (deliveryDivisionSelect) {
        deliveryDivisionSelect.addEventListener('change', populateDeliveryItems);
    }

    if (deliveryForm) {
        deliveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (currentUserRole !== 'Admin') return alert("Unauthorized.");

            const supplierId = deliverySupplierSelect.value;
            const table = deliveryDivisionSelect.value;
            const itemId = deliveryItemSelect.value;
            const qty = parseFloat(document.getElementById('delivery-qty').value);

            if (!supplierId || !itemId || isNaN(qty) || qty <= 0) {
                alert('Please select a supplier, an item, and enter a valid quantity.');
                return;
            }

            const item = deliveryItemCache[itemId];
            const currentStock = parseFloat(item.stock) || 0;
            const newStock = currentStock + qty;

            const { error: stockError } = await supabaseClient.from(table).update({ stock: newStock }).eq('id', itemId);
            if (stockError) { alert(`Failed to update stock: ${stockError.message}`); return; }

            const { data: supplierRow, error: supplierFetchError } = await supabaseClient.from('suppliers').select('items_supplied').eq('id', supplierId).single();
            if (!supplierFetchError && supplierRow) {
                const today = new Date().toISOString().split('T')[0];
                const logLine = `${qty} ${item.unit || ''} ${item.name} (${today})`.replace(/\s+/g, ' ').trim();
                const updatedItemsSupplied = supplierRow.items_supplied ? `${supplierRow.items_supplied}; ${logLine}` : logLine;
                await supabaseClient.from('suppliers').update({ items_supplied: updatedItemsSupplied }).eq('id', supplierId);
            }

            fetchAndRenderTable(table);
            fetchAndRenderTable('suppliers');
            refreshAlerts(false);

            deliveryMessage.classList.remove('hidden', 'text-red-500');
            deliveryMessage.classList.add('text-emerald-500');
            deliveryMessage.innerText = `Added ${qty} ${item.unit || ''} to ${item.name} — new stock: ${newStock} ${item.unit || ''}. Logged under supplier's Items Supplied.`;
            deliveryForm.reset();
            deliveryItemSelect.innerHTML = '<option value="">Select item…</option>';
        });
    }

    // ------------------------------------------------------------------
    // Time Log: students time in/out of the lab and record what equipment
    // and chemicals they used (chemical amounts are deducted from stock
    // immediately). Admins/professors see every student's session history.
    // ------------------------------------------------------------------
    let activeSession = null;
    let usageItemCache = {};
    let sessionTimerInterval = null;
    let timeLogCache = [];

    function stopSessionTimer() {
        if (sessionTimerInterval) { clearInterval(sessionTimerInterval); sessionTimerInterval = null; }
    }

    function formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
    }

    function startSessionTimer() {
        stopSessionTimer();
        const tick = () => {
            if (!activeSession) return;
            const el = document.getElementById('session-duration');
            if (el) el.innerText = formatDuration(Date.now() - new Date(activeSession.time_in).getTime());
        };
        tick();
        sessionTimerInterval = setInterval(tick, 1000);
    }

    async function populateUsageItemOptions() {
        const kind = document.getElementById('usage-kind').value;
        const table = kind === 'chemical' ? 'chemicals' : 'equipment';
        const { data, error } = await supabaseClient.from(table).select('id, name, stock, unit');
        const select = document.getElementById('usage-item');
        usageItemCache = {};
        if (error || !data) { select.innerHTML = '<option value="">Select item…</option>'; return; }
        const sorted = [...data].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
        sorted.forEach(item => { usageItemCache[item.id] = item; });
        select.innerHTML = '<option value="">Select item…</option>' + sorted.map(item => kind === 'chemical'
            ? `<option value="${item.id}">${item.name} (currently ${item.stock} ${item.unit || ''})</option>`
            : `<option value="${item.id}">${item.name}</option>`
        ).join('');
        document.getElementById('usage-qty-wrap').classList.toggle('hidden', kind !== 'chemical');
    }

    async function renderSessionItems() {
        const tbody = document.getElementById('usage-pending-body');
        if (!activeSession || !tbody) return;
        const { data, error } = await supabaseClient.from('usage_session_items').select('*').eq('session_id', activeSession.id).order('created_at', { ascending: true });
        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-zinc-500 text-sm">Nothing added yet.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(row => `<tr>
            <td class="py-3">${row.kind === 'chemical' ? 'Chemical' : 'Equipment'}</td>
            <td>${row.item_name}</td>
            <td>${row.quantity_used !== null ? `${row.quantity_used} ${row.unit || ''}` : '—'}</td>
            <td><button onclick="removeUsageItem(${row.id})" class="text-red-600 hover:underline">Remove</button></td>
        </tr>`).join('');
    }

    window.removeUsageItem = async (id) => {
        if (!confirm('Remove this item from the session? Any deducted chemical stock will be restored.')) return;
        const { data: row } = await supabaseClient.from('usage_session_items').select('*').eq('id', id).single();
        if (row && row.kind === 'chemical' && row.quantity_used) {
            const { data: chem } = await supabaseClient.from('chemicals').select('stock').eq('id', row.item_id).single();
            if (chem) {
                const restored = (parseFloat(chem.stock) || 0) + parseFloat(row.quantity_used);
                await supabaseClient.from('chemicals').update({ stock: restored }).eq('id', row.item_id);
                fetchAndRenderTable('chemicals');
            }
        }
        await supabaseClient.from('usage_session_items').delete().eq('id', id);
        renderSessionItems();
    };

    const usageKindSelect = document.getElementById('usage-kind');
    if (usageKindSelect) usageKindSelect.addEventListener('change', populateUsageItemOptions);

    const addUsageItemBtn = document.getElementById('add-usage-item-btn');
    if (addUsageItemBtn) addUsageItemBtn.addEventListener('click', async () => {
        if (!activeSession) return;
        const kind = document.getElementById('usage-kind').value;
        const itemId = document.getElementById('usage-item').value;
        if (!itemId) { alert('Please select an item.'); return; }
        const item = usageItemCache[itemId];

        let quantityUsed = null;
        if (kind === 'chemical') {
            quantityUsed = parseFloat(document.getElementById('usage-qty').value);
            if (isNaN(quantityUsed) || quantityUsed <= 0) { alert('Please enter a valid amount used.'); return; }
            const currentStock = parseFloat(item.stock) || 0;
            if (quantityUsed > currentStock) { alert(`Not enough stock: only ${currentStock} ${item.unit || ''} of ${item.name} available.`); return; }
            const { error: stockError } = await supabaseClient.from('chemicals').update({ stock: currentStock - quantityUsed }).eq('id', itemId);
            if (stockError) { alert(`Failed to deduct stock: ${stockError.message}`); return; }
            fetchAndRenderTable('chemicals');
            refreshAlerts(false);
        }

        const { error } = await supabaseClient.from('usage_session_items').insert([{
            session_id: activeSession.id,
            kind,
            item_id: itemId,
            item_name: item.name,
            quantity_used: quantityUsed,
            unit: kind === 'chemical' ? (item.unit || null) : null
        }]);
        if (error) { alert(`Failed to log item: ${error.message}`); return; }

        document.getElementById('usage-item').value = '';
        document.getElementById('usage-qty').value = '';
        renderSessionItems();
    });

    const timeInBtn = document.getElementById('time-in-btn');
    if (timeInBtn) timeInBtn.addEventListener('click', async () => {
        const { data, error } = await supabaseClient.from('usage_sessions').insert([{
            student_name: currentUserName,
            student_number: currentStudentNumber
        }]).select().single();
        if (error) { alert(`Failed to time in: ${error.message}`); return; }
        activeSession = data;
        document.getElementById('timelog-inactive').classList.add('hidden');
        document.getElementById('timelog-active').classList.remove('hidden');
        document.getElementById('session-start-time').innerText = new Date(activeSession.time_in).toLocaleString();
        startSessionTimer();
        await populateUsageItemOptions();
        await renderSessionItems();
    });

    const timeOutBtn = document.getElementById('time-out-btn');
    if (timeOutBtn) timeOutBtn.addEventListener('click', async () => {
        if (!activeSession) return;
        if (!confirm("Time out now? Make sure you've added everything you used during this session.")) return;
        const { error } = await supabaseClient.from('usage_sessions').update({ time_out: new Date().toISOString() }).eq('id', activeSession.id);
        if (error) { alert(`Failed to time out: ${error.message}`); return; }
        stopSessionTimer();
        activeSession = null;
        document.getElementById('timelog-active').classList.add('hidden');
        document.getElementById('timelog-inactive').classList.remove('hidden');
    });

    async function renderTimeLogAdmin() {
        const tbody = document.getElementById('timelog-table-body');
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-zinc-500 text-sm">Loading…</td></tr>`;
        const { data, error } = await supabaseClient.from('usage_sessions').select('*, usage_session_items(*)').order('time_in', { ascending: false });
        if (error || !data) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-red-500 text-sm">Failed to load session log.</td></tr>`;
            console.error(error);
            return;
        }
        timeLogCache = data;
        renderTimeLogRows();
    }

    function renderTimeLogRows() {
        const tbody = document.getElementById('timelog-table-body');
        if (!tbody) return;
        const search = (document.getElementById('timelog-search')?.value || '').trim().toLowerCase();
        const statusFilter = document.getElementById('timelog-filter')?.value || '';

        let rows = timeLogCache;
        if (search) rows = rows.filter(s => (s.student_name || '').toLowerCase().includes(search));
        if (statusFilter === 'active') rows = rows.filter(s => !s.time_out);
        if (statusFilter === 'completed') rows = rows.filter(s => !!s.time_out);

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-zinc-500 text-sm">No matching sessions found.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(s => {
            const items = s.usage_session_items || [];
            const equipmentUsed = items.filter(i => i.kind === 'equipment').map(i => i.item_name).join(', ') || '—';
            const chemicalsUsed = items.filter(i => i.kind === 'chemical').map(i => `${i.item_name} (${i.quantity_used} ${i.unit || ''})`).join(', ') || '—';
            const duration = s.time_out ? formatDuration(new Date(s.time_out) - new Date(s.time_in)) : `<span class="text-emerald-400 font-semibold">In progress</span>`;
            return `<tr>
                <td class="py-3">${s.student_name || '—'}</td>
                <td>${s.student_number || '—'}</td>
                <td>${new Date(s.time_in).toLocaleString()}</td>
                <td>${s.time_out ? new Date(s.time_out).toLocaleString() : '—'}</td>
                <td>${duration}</td>
                <td>${equipmentUsed}</td>
                <td>${chemicalsUsed}</td>
            </tr>`;
        }).join('');
    }

    document.getElementById('timelog-search')?.addEventListener('input', renderTimeLogRows);
    document.getElementById('timelog-filter')?.addEventListener('change', renderTimeLogRows);

    async function loadTimeLog() {
        const studentView = document.getElementById('timelog-student-view');
        const adminView = document.getElementById('timelog-admin-view');
        if (currentUserRole === 'Admin') {
            studentView.classList.add('hidden');
            adminView.classList.remove('hidden');
            renderTimeLogAdmin();
            return;
        }
        adminView.classList.add('hidden');
        studentView.classList.remove('hidden');
        const { data, error } = await supabaseClient.from('usage_sessions').select('*').is('time_out', null).order('time_in', { ascending: false }).limit(1);
        if (!error && data && data.length > 0) {
            activeSession = data[0];
            document.getElementById('timelog-inactive').classList.add('hidden');
            document.getElementById('timelog-active').classList.remove('hidden');
            document.getElementById('session-start-time').innerText = new Date(activeSession.time_in).toLocaleString();
            startSessionTimer();
            await populateUsageItemOptions();
            await renderSessionItems();
        } else {
            activeSession = null;
            document.getElementById('timelog-active').classList.add('hidden');
            document.getElementById('timelog-inactive').classList.remove('hidden');
        }
    }

    // ------------------------------------------------------------------
    // Item Requests: anyone can ask for a new chemical or piece of
    // equipment to be stocked; admins approve/deny/delete the requests.
    // ------------------------------------------------------------------
    let requestsCache = [];

    const requestForm = document.getElementById('request-form');
    if (requestForm) requestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabaseClient.from('item_requests').insert([{
            requester_name: currentUserName,
            category: document.getElementById('req-category').value,
            item_name: document.getElementById('req-item-name').value,
            quantity: document.getElementById('req-quantity').value,
            reason: document.getElementById('req-reason').value
        }]);
        if (error) { alert(`Failed to submit request: ${error.message}`); return; }
        requestForm.reset();
        loadRequests();
    });

    function requestStatusBadge(status) {
        const cls = status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-900'
            : status === 'Denied' ? 'bg-red-500/15 text-red-400 border-red-900'
            : 'bg-amber-500/15 text-amber-400 border-amber-900';
        return `<span class="inline-block ${cls} border text-[11px] font-semibold px-2 py-0.5 rounded-full">${status}</span>`;
    }

    function renderRequestRows() {
        const tbody = document.getElementById('requests-table-body');
        if (!tbody) return;
        const search = (document.getElementById('requests-search')?.value || '').trim().toLowerCase();
        const statusFilter = document.getElementById('requests-filter')?.value || '';

        let rows = requestsCache;
        if (search) rows = rows.filter(r => (r.item_name || '').toLowerCase().includes(search));
        if (statusFilter) rows = rows.filter(r => r.status === statusFilter);

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-zinc-500 text-sm">No matching requests found.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => {
            let actions = '<span class="text-zinc-600">—</span>';
            if (currentUserRole === 'Admin') {
                const decision = r.status === 'Pending'
                    ? `<button onclick="setRequestStatus(${r.id}, 'Approved')" class="text-emerald-500 hover:underline">Approve</button>
                       <button onclick="setRequestStatus(${r.id}, 'Denied')" class="text-red-600 hover:underline">Deny</button>`
                    : '';
                actions = `${decision} <button onclick="deleteRequest(${r.id})" class="text-zinc-500 hover:underline">Delete</button>`;
            }
            return `<tr>
                <td class="py-3">${r.requester_name || '—'}</td>
                <td>${r.category}</td>
                <td>${r.item_name}</td>
                <td>${r.quantity || '—'}</td>
                <td>${r.reason || '—'}</td>
                <td>${requestStatusBadge(r.status)}</td>
                <td class="text-right space-x-3">${actions}</td>
            </tr>`;
        }).join('');
    }

    window.setRequestStatus = async (id, status) => {
        const { error } = await supabaseClient.from('item_requests').update({ status }).eq('id', id);
        if (error) { alert(`Failed to update request: ${error.message}`); return; }
        loadRequests();
    };

    window.deleteRequest = async (id) => {
        if (!confirm('Delete this request?')) return;
        const { error } = await supabaseClient.from('item_requests').delete().eq('id', id);
        if (error) { alert(`Failed to delete request: ${error.message}`); return; }
        loadRequests();
    };

    document.getElementById('requests-search')?.addEventListener('input', renderRequestRows);
    document.getElementById('requests-filter')?.addEventListener('change', renderRequestRows);

    async function loadRequests() {
        const tbody = document.getElementById('requests-table-body');
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-zinc-500 text-sm">Loading…</td></tr>`;
        const { data, error } = await supabaseClient.from('item_requests').select('*').order('created_at', { ascending: false });
        if (error || !data) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-red-500 text-sm">Failed to load requests.</td></tr>`;
            console.error(error);
            return;
        }
        requestsCache = data;
        renderRequestRows();
    }

    document.getElementById('budget-form').addEventListener('submit', (e) => handleFormSubmit(e, 'budgets', {
        fiscal_year: document.getElementById('bud-year').value,
        category: document.getElementById('bud-category').value,
        allocated_amount: document.getElementById('bud-allocated').value,
        spent_amount: document.getElementById('bud-spent').value || 0,
        notes: document.getElementById('bud-notes').value
    }));

    const EDITABLE_FORM_IDS = ['chemical-form', 'material-form', 'equipment-form', 'apparatus-form', 'supplier-form', 'budget-form'];
    function resetFormsAndState() {
        editState = { chemicals: null, materials: null, equipment: null, apparatus: null, suppliers: null, budgets: null };
        EDITABLE_FORM_IDS.forEach(id => {
            const f = document.getElementById(id);
            if (!f) return;
            f.reset();
            const btn = f.querySelector('button[type="submit"]');
            if (btn) btn.innerText = "Save";
        });
    }

    function openDivision(targetDivision, pushHistory) {
        if (!divisionData[targetDivision]) return;
        if (targetDivision === 'admin-settings' && currentUserRole !== 'Admin') { goHome(true); return; }
        stopSessionTimer();
        if(divisionTitle) divisionTitle.innerText = divisionData[targetDivision].title;
        if(divisionDesc) divisionDesc.innerText = divisionData[targetDivision].description;
        viewHome.classList.add('hidden');
        viewDetail.classList.remove('hidden');
        Object.keys(workspaces).forEach(key => { if (workspaces[key]) workspaces[key].classList.toggle('hidden', key !== targetDivision); });
        resetFormsAndState();
        if (targetDivision === 'suppliers' && currentUserRole === 'Admin') {
            populateDeliverySuppliers();
            populateDeliveryItems();
        }
        if (targetDivision === 'admin-settings' && currentUserRole === 'Admin') {
            fetchAndRenderPendingInvites();
        }
        if (targetDivision === 'timelog') {
            loadTimeLog();
        }
        if (targetDivision === 'requests') {
            loadRequests();
        }
        if (pushHistory) history.pushState({ division: targetDivision }, '', '#' + targetDivision);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function goHome(pushHistory) {
        stopSessionTimer();
        viewDetail.classList.add('hidden');
        viewHome.classList.remove('hidden');
        resetFormsAndState();
        if (pushHistory) history.pushState({ division: null }, '', window.location.pathname + window.location.search);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => openDivision(button.getAttribute('data-target'), true));
    });

    backBtn.addEventListener('click', () => goHome(true));

    // Browser back/forward buttons
    window.addEventListener('popstate', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && divisionData[hash]) openDivision(hash, false);
        else goHome(false);
    });

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
                { key: 'status', label: 'Status' }, { key: 'calibration_date', label: 'Last Calibration' },
                { key: 'next_calibration_date', label: 'Next Calibration' }, { key: 'maintenance_date', label: 'Last Maintenance' },
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
                { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'address', label: 'Address' }, { key: 'items_supplied', label: 'Items Supplied' },
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
        tableDataCache[table] = data;
        // Reuses whatever search/category filter is currently applied on screen,
        // so exporting only includes the selected category rather than everything.
        return getFilteredItems(table);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Turns a report title like "Chemicals Inventory Report" into a safe,
    // readable filename fragment: "Chemicals_Inventory_Report"
    function slugifyForFilename(text) {
        return text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function csvEscape(val) {
        if (val === null || val === undefined) return '';
        const s = String(val);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    // Text of the currently selected category filter option for a division,
    // or null if it's set to "All ___" / not applicable.
    function getAppliedFilterLabel(table) {
        const select = document.getElementById(`${table}-filter`);
        if (!select || !select.value) return null;
        return select.options[select.selectedIndex]?.text || select.value;
    }

    async function exportCSV(table) {
        const config = EXPORT_CONFIG[table];
        const rows = await getExportRows(table);
        if (!rows) return;
        const dateStr = new Date().toISOString().split('T')[0];
        const filterLabel = getAppliedFilterLabel(table);
        const preamble = [
            `Report,${csvEscape(config.title)}`,
            `Generated by,${csvEscape(currentUserName)}`,
            `Generated on,${csvEscape(dateStr)}`,
            `Category filter,${csvEscape(filterLabel || 'All')}`,
            `Record count,${rows.length}`,
            ''
        ].join('\n');
        const header = config.columns.map(c => csvEscape(c.label)).join(',');
        const lines = rows.map(row => config.columns.map(c => csvEscape(row[c.key])).join(','));
        const csv = preamble + [header, ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const filenameSuffix = filterLabel ? `_${slugifyForFilename(filterLabel)}` : '';
        downloadBlob(blob, `CBMES_${slugifyForFilename(config.title)}${filenameSuffix}_${dateStr}.csv`);
    }

    async function exportPDF(table) {
        const config = EXPORT_CONFIG[table];
        const rows = await getExportRows(table);
        if (!rows) return;
        if (typeof window.jspdf === 'undefined') { alert('PDF export library did not load. Check your internet connection and try again.'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        if (typeof doc.autoTable !== 'function') { alert('PDF table plugin did not load. Check your internet connection and try again.'); return; }

        try {
            const dateStr = new Date().toLocaleDateString();
            const filterLabel = getAppliedFilterLabel(table);

            doc.setFontSize(14); doc.setTextColor(128, 0, 0);
            doc.text('Mapúa CBMES Inventory Management Portal', 40, 40);
            doc.setFontSize(11); doc.setTextColor(60, 60, 60);
            doc.text(config.title, 40, 58);
            doc.setFontSize(8); doc.setTextColor(120, 120, 120);
            doc.text(`Generated by ${currentUserName} on ${dateStr} — ${rows.length} record${rows.length !== 1 ? 's' : ''}${filterLabel ? ` — Category: ${filterLabel}` : ''}`, 40, 72);

            doc.autoTable({
                startY: 88,
                head: [config.columns.map(c => c.label)],
                body: rows.map(row => config.columns.map(c => (row[c.key] === null || row[c.key] === undefined) ? '' : String(row[c.key]))),
                styles: { fontSize: 7, cellPadding: 4 },
                headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { left: 40, right: 40 },
            });
        } catch (err) {
            console.error('PDF export failed:', err);
            alert(`PDF export failed: ${err.message}`);
            return;
        }

        const dateFile = new Date().toISOString().split('T')[0];
        const filenameSuffix = getAppliedFilterLabel(table) ? `_${slugifyForFilename(getAppliedFilterLabel(table))}` : '';
        doc.save(`CBMES_${slugifyForFilename(config.title)}${filenameSuffix}_${dateFile}.pdf`);
    }

    document.querySelectorAll('[data-export-csv]').forEach(btn => {
        btn.addEventListener('click', () => exportCSV(btn.getAttribute('data-export-csv')));
    });
    document.querySelectorAll('[data-export-pdf]').forEach(btn => {
        btn.addEventListener('click', () => exportPDF(btn.getAttribute('data-export-pdf')));
    });
});

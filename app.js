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

    let currentUserRole = 'Student';
    let editState = { chemicals: null, materials: null, equipment: null };

    supabaseClient.auth.getSession().then(({ data: { session } }) => { handleSession(session); });
    supabaseClient.auth.onAuthStateChange((event, session) => { handleSession(session); });

    function handleSession(session) {
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
        } else {
            viewAuth.classList.remove('hidden');
            viewHome.classList.add('hidden');
            viewDetail.classList.add('hidden');
            btnLogout.classList.add('hidden');
            roleBadge.classList.add('hidden');
        }
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
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
        msg.classList.add('text-gray-600');
        msg.innerText = "Sending invite...";

        const { data, error } = await supabaseClient.functions.invoke('invite-user', {
            body: { email, name, role }
        });

        if (error) {
            msg.classList.replace('text-gray-600', 'text-red-600');
            msg.innerText = "Failed to send invite. Check Edge Function setup.";
            console.error(error);
        } else {
            msg.classList.replace('text-gray-600', 'text-green-600');
            msg.innerText = `Invite sent successfully to ${email}!`;
            e.target.reset();
        }
    });

    const workspaces = {
        chemicals: document.getElementById('chemicals-workspace'),
        materials: document.getElementById('materials-workspace'),
        equipment: document.getElementById('equipment-workspace'),
        'admin-settings': document.getElementById('admin-settings-workspace')
    };

    const divisionData = {
        chemicals: { title: "Chemicals Database Division", description: "Displaying real-time liquid inventory volume states, active CAS numbers, risk thresholds, and localized warehouse tracking data tables." },
        materials: { title: "Materials & Engineering Stocks Workspace", description: "Tracking consumable media allocations, physical sample properties, structural specimens, and substrate counts." },
        equipment: { title: "Lab Equipment & Instrument Registry Sheets", description: "Monitoring operational calibration intervals, active borrowing logs, digital micro-hardware units, and maintenance logs." },
        'admin-settings': { title: "Portal Administration", description: "Manage user access and send secure email invitations to new students or faculty members." }
    };

    async function fetchAndRenderTable(table) {
        const { data, error } = await supabaseClient.from(table).select('*').order('id', { ascending: true });
        if (error) { console.error(`Error fetching ${table}:`, error); return; }

        const tbody = document.getElementById(`${table}-table-body`);
        if (!tbody) return;
        
        tbody.innerHTML = data.map(i => {
            let actionButtons = '';
            if (currentUserRole === 'Admin') {
                actionButtons = `<button onclick="editItem('${table}', ${i.id})" class="text-blue-600 hover:underline">Edit</button>
                                 <button onclick="deleteItem('${table}', ${i.id})" class="text-red-600 hover:underline">Delete</button>`;
            } else {
                const currentVal = table === 'equipment' ? i.status : i.stock;
                actionButtons = `<button onclick="adjustStock('${table}', ${i.id}, '${currentVal}')" class="text-amber-600 hover:underline">Adjust</button>`;
            }

            if (table === 'chemicals') return `<tr><td class="py-3">${i.name}</td><td>${i.cas}</td><td>${i.stock}</td><td>${i.grade}</td><td>${i.location}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            if (table === 'materials') return `<tr><td class="py-3">${i.name}</td><td>${i.category}</td><td>${i.stock}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
            if (table === 'equipment') return `<tr><td class="py-3">${i.name}</td><td>${i.serial}</td><td>${i.status}</td><td class="text-right space-x-3">${actionButtons}</td></tr>`;
        }).join('');
    }

    window.deleteItem = async (table, id) => {
        if (currentUserRole !== 'Admin') return alert("Unauthorized.");
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) alert(`Failed to delete: ${error.message}`);
        else fetchAndRenderTable(table); 
    };

    window.editItem = async (table, id) => {
        if (currentUserRole !== 'Admin') return alert("Unauthorized.");
        const { data, error } = await supabaseClient.from(table).select('*').eq('id', id).single();
        if (error || !data) { alert(`Failed to load item: ${error.message}`); return; }

        editState[table] = id; 
        if (table === 'chemicals') { document.getElementById('chem-name').value = data.name; document.getElementById('chem-cas').value = data.cas; document.getElementById('chem-stock').value = data.stock; document.getElementById('chem-grade').value = data.grade; document.getElementById('chem-location').value = data.location; document.querySelector('#chemical-form button[type="submit"]').innerText = "Update"; }
        else if (table === 'materials') { document.getElementById('mat-name').value = data.name; document.getElementById('mat-category').value = data.category; document.getElementById('mat-stock').value = data.stock; document.querySelector('#material-form button[type="submit"]').innerText = "Update"; }
        else if (table === 'equipment') { document.getElementById('eq-name').value = data.name; document.getElementById('eq-serial').value = data.serial; document.getElementById('eq-status').value = data.status; document.querySelector('#equipment-form button[type="submit"]').innerText = "Update"; }
    };

    window.adjustStock = async (table, id, currentVal) => {
        const message = table === 'equipment' ? `Current Status is: ${currentVal}\nEnter new status (Available / In Use / Maintenance):` : `Current Stock is: ${currentVal}\nEnter new amount after taking/adding:`;
        const newVal = prompt(message, currentVal);
        
        if (newVal !== null && newVal !== currentVal) {
            const updateField = table === 'equipment' ? { status: newVal } : { stock: newVal };
            const { error } = await supabaseClient.from(table).update(updateField).eq('id', id);
            if (error) alert(`Failed to update: ${error.message}`);
            else fetchAndRenderTable(table);
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
        else { fetchAndRenderTable(table); e.target.reset(); e.target.querySelector('button[type="submit"]').innerText = "Save"; }
    }

    document.getElementById('chemical-form').addEventListener('submit', (e) => handleFormSubmit(e, 'chemicals', { name: document.getElementById('chem-name').value, cas: document.getElementById('chem-cas').value, stock: document.getElementById('chem-stock').value, grade: document.getElementById('chem-grade').value, location: document.getElementById('chem-location').value }));
    document.getElementById('material-form').addEventListener('submit', (e) => handleFormSubmit(e, 'materials', { name: document.getElementById('mat-name').value, category: document.getElementById('mat-category').value, stock: document.getElementById('mat-stock').value }));
    document.getElementById('equipment-form').addEventListener('submit', (e) => handleFormSubmit(e, 'equipment', { name: document.getElementById('eq-name').value, serial: document.getElementById('eq-serial').value, status: document.getElementById('eq-status').value }));

    function resetFormsAndState() {
        editState = { chemicals: null, materials: null, equipment: null };
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
});
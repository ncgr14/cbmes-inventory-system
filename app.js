const SUPABASE_URL = 'https://faddbjtlvmfteevktkyf.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_UW105oLT1XuhIHmjzIgOxg_zNiEFHvw'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const viewHome = document.getElementById('view-home');
    const viewDetail = document.getElementById('view-division-detail');
    const divisionTitle = document.getElementById('division-title');
    const divisionDesc = document.getElementById('division-desc');
    const backBtn = document.getElementById('back-home-btn');
    
    const workspaces = {
        chemicals: document.getElementById('chemicals-workspace'),
        materials: document.getElementById('materials-workspace'),
        equipment: document.getElementById('equipment-workspace')
    };

    const divisionData = {
        chemicals: {
            title: "Chemicals Database Division",
            description: "Displaying real-time liquid inventory volume states, active CAS numbers, risk thresholds, and localized warehouse tracking data tables."
        },
        materials: {
            title: "Materials & Engineering Stocks Workspace",
            description: "Tracking consumable media allocations, physical sample properties, structural specimens, and substrate counts."
        },
        equipment: {
            title: "Lab Equipment & Instrument Registry Sheets",
            description: "Monitoring operational calibration intervals, active borrowing logs, digital micro-hardware units, and maintenance logs."
        }
    };

    let editState = { chemicals: null, materials: null, equipment: null };

    async function fetchAndRenderTable(table) {
        const { data, error } = await supabaseClient.from(table).select('*').order('id', { ascending: true });
        
        if (error) {
            console.error(`Error fetching ${table}:`, error);
            return;
        }

        const tbody = document.getElementById(`${table}-table-body`);
        if (!tbody) return; 
        
        if (table === 'chemicals') {
            tbody.innerHTML = data.map(i => `<tr><td class="py-3">${i.name}</td><td>${i.cas}</td><td>${i.stock}</td><td>${i.grade}</td><td>${i.location}</td><td class="text-right space-x-3"><button onclick="editItem('chemicals', ${i.id})" class="text-blue-600 hover:underline">Edit</button><button onclick="deleteItem('chemicals', ${i.id})" class="text-red-600 hover:underline">Delete</button></td></tr>`).join('');
        } else if (table === 'materials') {
            tbody.innerHTML = data.map(i => `<tr><td class="py-3">${i.name}</td><td>${i.category}</td><td>${i.stock}</td><td class="text-right space-x-3"><button onclick="editItem('materials', ${i.id})" class="text-blue-600 hover:underline">Edit</button><button onclick="deleteItem('materials', ${i.id})" class="text-red-600 hover:underline">Delete</button></td></tr>`).join('');
        } else if (table === 'equipment') {
            tbody.innerHTML = data.map(i => `<tr><td class="py-3">${i.name}</td><td>${i.serial}</td><td>${i.status}</td><td class="text-right space-x-3"><button onclick="editItem('equipment', ${i.id})" class="text-blue-600 hover:underline">Edit</button><button onclick="deleteItem('equipment', ${i.id})" class="text-red-600 hover:underline">Delete</button></td></tr>`).join('');
        }
    }

    fetchAndRenderTable('chemicals');
    fetchAndRenderTable('materials');
    fetchAndRenderTable('equipment');


    window.deleteItem = async (table, id) => {
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) {
            alert(`Failed to delete: ${error.message}`);
        } else {
            fetchAndRenderTable(table); 
        }
    };


    window.editItem = async (table, id) => {
        const { data, error } = await supabaseClient.from(table).select('*').eq('id', id).single();
        
        if (error || !data) {
            alert(`Failed to load item: ${error.message}`);
            return;
        }

        editState[table] = id; 

        if (table === 'chemicals') {
            document.getElementById('chem-name').value = data.name;
            document.getElementById('chem-cas').value = data.cas;
            document.getElementById('chem-stock').value = data.stock;
            document.getElementById('chem-grade').value = data.grade;
            document.getElementById('chem-location').value = data.location;
            document.querySelector('#chemical-form button[type="submit"]').innerText = "Update";
        } else if (table === 'materials') {
            document.getElementById('mat-name').value = data.name;
            document.getElementById('mat-category').value = data.category;
            document.getElementById('mat-stock').value = data.stock;
            document.querySelector('#material-form button[type="submit"]').innerText = "Update";
        } else if (table === 'equipment') {
            document.getElementById('eq-name').value = data.name;
            document.getElementById('eq-serial').value = data.serial;
            document.getElementById('eq-status').value = data.status;
            document.querySelector('#equipment-form button[type="submit"]').innerText = "Update";
        }
    };

   
    document.getElementById('chemical-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('chem-name').value,
            cas: document.getElementById('chem-cas').value,
            stock: document.getElementById('chem-stock').value,
            grade: document.getElementById('chem-grade').value,
            location: document.getElementById('chem-location').value
        };
        
        let error;
        if (editState.chemicals) {
            const response = await supabaseClient.from('chemicals').update(payload).eq('id', editState.chemicals);
            error = response.error;
            if(!error) editState.chemicals = null;
        } else {
            const response = await supabaseClient.from('chemicals').insert([payload]);
            error = response.error;
        }

        if (error) {
            alert(`Database Error: ${error.message}`);
        } else {
            fetchAndRenderTable('chemicals'); 
            e.target.reset();
            e.target.querySelector('button[type="submit"]').innerText = "Save";
        }
    });

    document.getElementById('material-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('mat-name').value,
            category: document.getElementById('mat-category').value,
            stock: document.getElementById('mat-stock').value
        };

        let error;
        if (editState.materials) {
            const response = await supabaseClient.from('materials').update(payload).eq('id', editState.materials);
            error = response.error;
            if(!error) editState.materials = null;
        } else {
            const response = await supabaseClient.from('materials').insert([payload]);
            error = response.error;
        }

        if (error) {
            alert(`Database Error: ${error.message}`);
        } else {
            fetchAndRenderTable('materials'); 
            e.target.reset();
            e.target.querySelector('button[type="submit"]').innerText = "Save";
        }
    });

    document.getElementById('equipment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('eq-name').value,
            serial: document.getElementById('eq-serial').value,
            status: document.getElementById('eq-status').value
        };

        let error;
        if (editState.equipment) {
            const response = await supabaseClient.from('equipment').update(payload).eq('id', editState.equipment);
            error = response.error;
            if(!error) editState.equipment = null;
        } else {
            const response = await supabaseClient.from('equipment').insert([payload]);
            error = response.error;
        }

        if (error) {
            alert(`Database Error: ${error.message}`);
        } else {
            fetchAndRenderTable('equipment'); 
            e.target.reset();
            e.target.querySelector('button[type="submit"]').innerText = "Save";
        }
    });

    function resetFormsAndState() {
        editState = { chemicals: null, materials: null, equipment: null };
        document.querySelectorAll('form').forEach(f => {
            f.reset();
            const btn = f.querySelector('button[type="submit"]');
            if(btn) btn.innerText = "Save";
        });
    }

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetDivision = button.getAttribute('data-target');
            
            if (divisionData[targetDivision]) {
                if(divisionTitle) divisionTitle.innerText = divisionData[targetDivision].title;
                if(divisionDesc) divisionDesc.innerText = divisionData[targetDivision].description;

                viewHome.classList.add('hidden');
                viewDetail.classList.remove('hidden');

                Object.keys(workspaces).forEach(key => {
                    if (workspaces[key]) {
                        workspaces[key].classList.toggle('hidden', key !== targetDivision);
                    }
                });
                resetFormsAndState();
            }
        });
    });

    backBtn.addEventListener('click', () => {
        viewDetail.classList.add('hidden');
        viewHome.classList.remove('hidden');
        resetFormsAndState();
    });
});
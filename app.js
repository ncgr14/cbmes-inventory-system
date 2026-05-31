document.addEventListener('DOMContentLoaded', () => {
    const viewHome = document.getElementById('view-home');
    const viewDetail = document.getElementById('view-division-detail');
    const divisionTitle = document.getElementById('division-title');
    const divisionDesc = document.getElementById('division-desc');
    const backBtn = document.getElementById('back-home-btn');
    const urgentAlertBox = document.getElementById('urgent-alert-box');
    const urgentAlertText = document.getElementById('urgent-alert-text');
    
    const workspaces = {
        chemicals: document.getElementById('chemicals-workspace'),
        materials: document.getElementById('materials-workspace'),
        equipment: document.getElementById('equipment-workspace')
    };

    const alertItems = [];
    if (alertItems.length > 0 && urgentAlertBox) {
        let alertMessage = `There are ${alertItems.length} items requiring attention: `;
        const details = alertItems.map(item => `${item.name} (${item.issue})`).join(', ');
        urgentAlertText.innerText = alertMessage + details + ".";
        urgentAlertBox.classList.remove('hidden');
    } else if (urgentAlertBox) {
        urgentAlertBox.classList.add('hidden');
    }

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

    let inventory = { chemicals: [], materials: [], equipment: [] };
    let editState = { chemicals: null, materials: null, equipment: null };

    function renderTables() {
        document.getElementById('chemicals-table-body').innerHTML = inventory.chemicals.map(i => `<tr><td class="py-3">${i.name}</td><td>${i.cas}</td><td>${i.stock}</td><td>${i.grade}</td><td>${i.location}</td><td class="text-right space-x-3"><button onclick="editItem('chemicals', ${i.id})" class="text-blue-600 hover:underline">Edit</button><button onclick="deleteItem('chemicals', ${i.id})" class="text-red-600 hover:underline">Delete</button></td></tr>`).join('');
        document.getElementById('materials-table-body').innerHTML = inventory.materials.map(i => `<tr><td class="py-3">${i.name}</td><td>${i.category}</td><td>${i.stock}</td><td class="text-right space-x-3"><button onclick="editItem('materials', ${i.id})" class="text-blue-600 hover:underline">Edit</button><button onclick="deleteItem('materials', ${i.id})" class="text-red-600 hover:underline">Delete</button></td></tr>`).join('');
        document.getElementById('equipment-table-body').innerHTML = inventory.equipment.map(i => `<tr><td class="py-3">${i.name}</td><td>${i.serial}</td><td>${i.status}</td><td class="text-right space-x-3"><button onclick="editItem('equipment', ${i.id})" class="text-blue-600 hover:underline">Edit</button><button onclick="deleteItem('equipment', ${i.id})" class="text-red-600 hover:underline">Delete</button></td></tr>`).join('');
    }

    window.deleteItem = (cat, id) => {
        inventory[cat] = inventory[cat].filter(i => i.id !== id);
        renderTables();
    };

    window.editItem = (cat, id) => {
        const item = inventory[cat].find(i => i.id === id);
        if (!item) return;
        editState[cat] = id;

        if (cat === 'chemicals') {
            document.getElementById('chem-name').value = item.name;
            document.getElementById('chem-cas').value = item.cas;
            document.getElementById('chem-stock').value = item.stock;
            document.getElementById('chem-grade').value = item.grade;
            document.getElementById('chem-location').value = item.location;
            document.querySelector('#chemical-form button[type="submit"]').innerText = "Update";
        } else if (cat === 'materials') {
            document.getElementById('mat-name').value = item.name;
            document.getElementById('mat-category').value = item.category;
            document.getElementById('mat-stock').value = item.stock;
            document.querySelector('#material-form button[type="submit"]').innerText = "Update";
        } else if (cat === 'equipment') {
            document.getElementById('eq-name').value = item.name;
            document.getElementById('eq-serial').value = item.serial;
            document.getElementById('eq-status').value = item.status;
            document.querySelector('#equipment-form button[type="submit"]').innerText = "Update";
        }
    };

    document.getElementById('chemical-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            id: editState.chemicals || Date.now(),
            name: document.getElementById('chem-name').value,
            cas: document.getElementById('chem-cas').value,
            stock: document.getElementById('chem-stock').value,
            grade: document.getElementById('chem-grade').value,
            location: document.getElementById('chem-location').value
        };
        
        if (editState.chemicals) {
            const index = inventory.chemicals.findIndex(i => i.id === editState.chemicals);
            inventory.chemicals[index] = data;
            editState.chemicals = null;
            e.target.querySelector('button[type="submit"]').innerText = "Save";
        } else {
            inventory.chemicals.push(data);
        }
        renderTables(); e.target.reset();
    });

    document.getElementById('material-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            id: editState.materials || Date.now(),
            name: document.getElementById('mat-name').value,
            category: document.getElementById('mat-category').value,
            stock: document.getElementById('mat-stock').value
        };

        if (editState.materials) {
            const index = inventory.materials.findIndex(i => i.id === editState.materials);
            inventory.materials[index] = data;
            editState.materials = null;
            e.target.querySelector('button[type="submit"]').innerText = "Save";
        } else {
            inventory.materials.push(data);
        }
        renderTables(); e.target.reset();
    });

    document.getElementById('equipment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            id: editState.equipment || Date.now(),
            name: document.getElementById('eq-name').value,
            serial: document.getElementById('eq-serial').value,
            status: document.getElementById('eq-status').value
        };

        if (editState.equipment) {
            const index = inventory.equipment.findIndex(i => i.id === editState.equipment);
            inventory.equipment[index] = data;
            editState.equipment = null;
            e.target.querySelector('button[type="submit"]').innerText = "Save";
        } else {
            inventory.equipment.push(data);
        }
        renderTables(); e.target.reset();
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
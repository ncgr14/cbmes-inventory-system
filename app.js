document.addEventListener('DOMContentLoaded', () => {
    const viewHome = document.getElementById('view-home');
    const viewDetail = document.getElementById('view-division-detail');
    const divisionTitle = document.getElementById('division-title');
    const divisionDesc = document.getElementById('division-desc');
    const backBtn = document.getElementById('back-home-btn');
    const urgentAlertBox = document.getElementById('urgent-alert-box');
    const urgentAlertText = document.getElementById('urgent-alert-text');

    const alertItems = [];

    if (alertItems.length > 0) {
        let alertMessage = `There are ${alertItems.length} items requiring attention: `;
        const details = alertItems.map(item => `${item.name} (${item.issue})`).join(', ');
        urgentAlertText.innerText = alertMessage + details + ".";
        urgentAlertBox.classList.remove('hidden');
    } else {
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

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetDivision = button.getAttribute('data-target');
            
            if (divisionData[targetDivision]) {
                divisionTitle.innerText = divisionData[targetDivision].title;
                divisionDesc.innerText = divisionData[targetDivision].description;

                viewHome.classList.add('hidden');
                viewDetail.classList.remove('hidden');
            }
        });
    });

    backBtn.addEventListener('click', () => {
        viewDetail.classList.add('hidden');
        viewHome.classList.remove('hidden');
    });
});
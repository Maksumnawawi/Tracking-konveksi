/**
 * Logika Aksi Divisi & Modal QC & Packing
 */

function confirmAction(actionName, stageName) {
    let msg = `Apakah Anda yakin ingin melakukan aksi ${actionName} pada tahap "${stageName}"?`;
    if (actionName === 'Selesai') {
        msg = `Apakah Anda yakin tahap "${stageName}" telah selesai?\n\nOrder akan otomatis dipindahkan ke antrean divisi berikutnya.`;
    }
    return confirm(msg);
}

// Modal QC & Packing
function openQcModal(stageId, orderId, orderNumber, totalPcs) {
    const modal = document.getElementById('qcModal');
    if (!modal) return;

    document.getElementById('qcModalStageId').value = stageId;
    document.getElementById('qcModalOrderId').value = orderId;
    document.getElementById('qcModalOrderNumber').textContent = orderNumber;
    document.getElementById('qcModalTotalPcs').textContent = totalPcs;
    document.getElementById('qcModalTotalInput').value = totalPcs;

    // Reset fields
    const passedInput = document.getElementById('qcPassedInput');
    const rejectInput = document.getElementById('qcRejectInput');
    const notesInput = document.getElementById('qcNotesInput');
    const reworkInput = document.getElementById('qcReworkInput');

    passedInput.value = totalPcs; // Default lolos semua
    rejectInput.value = 0;
    if (notesInput) notesInput.value = '';
    if (reworkInput) reworkInput.value = '';

    calculateQcStats();
    modal.classList.remove('hidden');
}

function closeQcModal() {
    const modal = document.getElementById('qcModal');
    if (modal) modal.classList.add('hidden');
}

function calculateQcStats() {
    const totalPcs = parseInt(document.getElementById('qcModalTotalInput').value) || 0;
    const passed = parseInt(document.getElementById('qcPassedInput').value) || 0;
    const reject = parseInt(document.getElementById('qcRejectInput').value) || 0;

    const sum = passed + reject;
    const diff = totalPcs - sum;

    const rateEl = document.getElementById('qcPassRateDisplay');
    const warningEl = document.getElementById('qcSumWarning');
    const percent = totalPcs > 0 ? ((passed / (sum || 1)) * 100).toFixed(1) : 0;

    if (rateEl) {
        rateEl.textContent = `${percent}%`;
    }

    if (warningEl) {
        if (diff !== 0) {
            warningEl.classList.remove('hidden');
            warningEl.textContent = `Peringatan: Jumlah Lolos (${passed}) + Reject (${reject}) = ${sum} pcs (Selisih ${Math.abs(diff)} pcs dari total SPK ${totalPcs} pcs).`;
        } else {
            warningEl.classList.add('hidden');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const passedInput = document.getElementById('qcPassedInput');
    const rejectInput = document.getElementById('qcRejectInput');

    if (passedInput && rejectInput) {
        passedInput.addEventListener('input', calculateQcStats);
        rejectInput.addEventListener('input', calculateQcStats);
    }
});


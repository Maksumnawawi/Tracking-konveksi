/**
 * Public Tracking Client Helpers
 */

function copyTrackingLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copyBtnText');
        if (btn) {
            const original = btn.textContent;
            btn.textContent = 'Link Berhasil Disalin! ✓';
            setTimeout(() => {
                btn.textContent = original;
            }, 2500);
        } else {
            alert('Link tracking berhasil disalin ke clipboard!');
        }
    }).catch(err => {
        prompt('Salin link tracking berikut:', url);
    });
}


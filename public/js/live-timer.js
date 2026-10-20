/**
 * Live Timer Client - WIP Tracking Produksi Konveksi
 * Menghitung waktu bersih pengerjaan secara akurat dan realtime tiap detik
 */

document.addEventListener('DOMContentLoaded', () => {
    const timerElements = document.querySelectorAll('[data-live-timer]');
    if (!timerElements.length) return;

    function formatClock(totalSeconds) {
        if (!totalSeconds || totalSeconds < 0) totalSeconds = 0;
        totalSeconds = Math.floor(totalSeconds);

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    function formatDetailed(totalSeconds) {
        if (!totalSeconds || totalSeconds < 0) totalSeconds = 0;
        totalSeconds = Math.floor(totalSeconds);

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}j`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        return parts.join(' ');
    }

    function updateAllTimers() {
        const now = Date.now();

        timerElements.forEach(el => {
            const status = el.getAttribute('data-timer-status');
            const baseSeconds = parseInt(el.getAttribute('data-timer-seconds')) || 0;
            const startedAtStr = el.getAttribute('data-started-at');

            let currentTotal = baseSeconds;

            if (status === 'IN_PROGRESS' && startedAtStr) {
                const startTime = new Date(startedAtStr).getTime();
                const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
                currentTotal = baseSeconds + elapsed;
            }

            const clockEl = el.querySelector('.timer-clock');
            const detailedEl = el.querySelector('.timer-detailed');

            if (clockEl) {
                clockEl.textContent = formatClock(currentTotal);
            }
            if (detailedEl) {
                detailedEl.textContent = formatDetailed(currentTotal);
            }
        });
    }

    // Jalankan pertama kali & setiap 1 detik
    updateAllTimers();
    setInterval(updateAllTimers, 1000);
});


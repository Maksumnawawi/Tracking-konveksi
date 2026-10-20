/**
 * Helper untuk kalkulasi dan format durasi waktu bersih (Time Tracking)
 */

function formatDurationDetailed(totalSeconds) {
    if (!totalSeconds || totalSeconds < 0) totalSeconds = 0;
    totalSeconds = Math.floor(totalSeconds);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours} jam`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes} mnt`);
    parts.push(`${seconds} dtk`);

    return parts.join(' ');
}

function formatDurationClock(totalSeconds) {
    if (!totalSeconds || totalSeconds < 0) totalSeconds = 0;
    totalSeconds = Math.floor(totalSeconds);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Hitung durasi saat ini jika stage sedang IN_PROGRESS
 */
function getActiveDurationSeconds(stage) {
    let base = stage.total_active_seconds || 0;
    if (stage.status === 'IN_PROGRESS' && stage.last_timer_started_at) {
        const startedTime = new Date(stage.last_timer_started_at).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startedTime) / 1000);
        if (elapsed > 0) {
            base += elapsed;
        }
    }
    return base;
}

module.exports = {
    formatDurationDetailed,
    formatDurationClock,
    getActiveDurationSeconds
};


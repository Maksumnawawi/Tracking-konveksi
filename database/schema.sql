-- ====================================================================
-- SCHEMA DATABASE TRACKING PRODUKSI KONVEKSI & JERSEY (WIP TRACKING)
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. TABEL PENGGUNA (USERS & PIC DIVISI)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL, -- admin, desain, potong, print_sablon, jahit, qc_packing, kirim
    division_name TEXT NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABEL PESANAN (ORDERS / SPK)
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,       -- Contoh: SPK-202610-001
    tracking_code TEXT UNIQUE NOT NULL,      -- Contoh: TRK-98AF23
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    article_name TEXT NOT NULL,              -- Nama Produk/Artikel (misal: "Jersey F.C. Garuda Home")
    category TEXT NOT NULL CHECK(category IN ('kaos', 'jersey')),
    fabric_type TEXT,                        -- Contoh: "Cotton Combed 30s Reaktif" / "Dryfit Milano"
    print_type TEXT,                         -- Contoh: "Plastisol Doff" / "Full Sublimasi Anti-UV"
    notes TEXT,                              -- Catatan khusus SPK
    deadline_date DATE,
    size_xs INTEGER DEFAULT 0,
    size_s INTEGER DEFAULT 0,
    size_m INTEGER DEFAULT 0,
    size_l INTEGER DEFAULT 0,
    size_xl INTEGER DEFAULT 0,
    size_2xl INTEGER DEFAULT 0,
    size_3xl INTEGER DEFAULT 0,
    total_pcs INTEGER NOT NULL,
    current_stage_id INTEGER,                -- ID tahap aktif saat ini
    current_role TEXT,                       -- Role divisi penanggung jawab tahap aktif
    status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 3. TABEL TAHAPAN PRODUKSI PER PESANAN (ORDER_STAGES)
CREATE TABLE IF NOT EXISTS order_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    stage_order INTEGER NOT NULL,            -- Urutan: 1, 2, 3, dst
    assigned_role TEXT NOT NULL,             -- Divisi PIC penanggung jawab
    status TEXT NOT NULL DEFAULT 'WAITING',  -- WAITING, IN_PROGRESS, PAUSED, COMPLETED
    total_active_seconds INTEGER DEFAULT 0,  -- Akumulasi durasi bersih pengerjaan (detik)
    started_at DATETIME,                     -- Waktu pertama kali ditekan Mulai
    last_timer_started_at DATETIME,          -- Waktu sesi timer aktif terakhir berjalan
    completed_at DATETIME,                   -- Waktu tahap selesai
    completed_by_user_id INTEGER REFERENCES users(id)
);

-- 4. TABEL LOG WAKTU KERJA BERSIH (TIME_LOGS)
CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_stage_id INTEGER NOT NULL REFERENCES order_stages(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,                    -- START, PAUSE, RESUME, COMPLETE
    duration_seconds INTEGER DEFAULT 0,      -- Durasi per sesi aktif (detik)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 5. TABEL HASIL INSPEKSI KUALITAS (QC_RESULTS)
CREATE TABLE IF NOT EXISTS qc_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    order_stage_id INTEGER NOT NULL REFERENCES order_stages(id) ON DELETE CASCADE,
    inspector_user_id INTEGER NOT NULL REFERENCES users(id),
    total_checked INTEGER NOT NULL,
    pcs_passed INTEGER NOT NULL,
    pcs_reject INTEGER NOT NULL,
    pass_percentage REAL NOT NULL,           -- Persentase keberhasilan (pcs_passed / total_checked * 100)
    reject_reason TEXT,                      -- Catatan reject (misal: "Jahitan leher miring 2 pcs, noda tinta 1 pcs")
    rework_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABEL NOTIFIKASI & PERUBAHAN OWNER (ORDER_NOTIFICATIONS)
CREATE TABLE IF NOT EXISTS order_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    target_role TEXT DEFAULT 'all',          -- 'all' atau divisi tertentu (e.g. 'print_sablon', 'jahit')
    type TEXT NOT NULL,                      -- 'QTY_CHANGE', 'ORDER_CANCELLED', 'SPEC_UPDATE', 'REVISION'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0
);

-- INDEX UNTUK PERFORMA QUERY
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_stages_order ON order_stages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_stages_role ON order_stages(assigned_role, status);
CREATE INDEX IF NOT EXISTS idx_time_logs_stage ON time_logs(order_stage_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON order_notifications(target_role, is_read);

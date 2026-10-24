-- ====================================================================
-- SEED DATA TRACKING PRODUKSI KONVEKSI & JERSEY
-- Password untuk semua akun default: password123
-- ====================================================================

-- 1. DATA PENGGUNA (ROLE & PIC DIVISI)
-- Default Sandi: Admin -> admin123 | Divisi -> 123456 (bisa diedit di sistem)
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, division_name, phone) VALUES
(1, 'admin', '$2b$10$Sn05EhTJbH4tN.9lxEnnU.eBK06ttr99XbNQgGLxH8.slLthTuTtG', 'Admin', 'admin', 'Admin', '081514418116'),
(2, 'desain', '$2b$10$4hWziEKBezF2mle.D5IHQuQUTFwwoLAqs.F/ZjmxuwafvBb4RSNL6', 'Nama Kepala', 'desain', 'Divisi Desain & Pola', '081234567801'),
(3, 'print_sablon', '$2b$10$4hWziEKBezF2mle.D5IHQuQUTFwwoLAqs.F/ZjmxuwafvBb4RSNL6', 'Nama Kepala', 'print_sablon', 'Divisi Cetak Sablon & Sublim', '081234567802'),
(4, 'potong', '$2b$10$4hWziEKBezF2mle.D5IHQuQUTFwwoLAqs.F/ZjmxuwafvBb4RSNL6', 'Nama Kepala', 'potong', 'Divisi Potong (Cutting)', '081234567803'),
(5, 'jahit', '$2b$10$4hWziEKBezF2mle.D5IHQuQUTFwwoLAqs.F/ZjmxuwafvBb4RSNL6', 'Nama Kepala', 'jahit', 'Divisi Jahit (Sewing)', '081234567804'),
(6, 'qc_packing', '$2b$10$4hWziEKBezF2mle.D5IHQuQUTFwwoLAqs.F/ZjmxuwafvBb4RSNL6', 'Nama Kepala', 'qc_packing', 'Divisi QC & Packing', '081234567805'),
(7, 'kirim', '$2b$10$4hWziEKBezF2mle.D5IHQuQUTFwwoLAqs.F/ZjmxuwafvBb4RSNL6', 'Nama Kepala', 'kirim', 'Divisi Pengiriman & Ekspedisi', '081234567806');

-- 2. PESANAN SAMPEL 1: KAOS KOMUNITAS (SEDANG DI TAHAP JAHIT)
INSERT OR IGNORE INTO orders (
    id, order_number, tracking_code, customer_name, customer_phone, article_name,
    category, fabric_type, print_type, notes, deadline_date,
    size_xs, size_s, size_m, size_l, size_xl, size_2xl, size_3xl, total_pcs,
    current_stage_id, current_role, status, created_by, created_at
) VALUES (
    1, 'SPK-202610-001', 'TRK-KAOS99', 'Komunitas Motor CB Bandung', '081399887766',
    'Kaos Anniversary 10th Riders Club', 'kaos', 'Cotton Combed 30s Reaktif (Hitam)',
    'Sablon Plastisol 3 Warna Dada & Punggung', 'Gunakan jahitan rantai pundak, rib leher spandek 2cm',
    date('now', '+3 days'),
    0, 10, 25, 30, 20, 15, 0, 100,
    5, 'jahit', 'IN_PROGRESS', 1, datetime('now', '-2 days')
);

-- TAHAPAN SAMPEL 1 (KAOS: 7 Stages)
INSERT OR IGNORE INTO order_stages (id, order_id, stage_name, stage_order, assigned_role, status, total_active_seconds, started_at, completed_at, completed_by_user_id) VALUES
(1, 1, 'Desain', 1, 'desain', 'COMPLETED', 3600, datetime('now', '-2 days'), datetime('now', '-2 days', '+1 hour'), 2),
(2, 1, 'Sekrining/Film', 2, 'print_sablon', 'COMPLETED', 2700, datetime('now', '-2 days', '+2 hours'), datetime('now', '-2 days', '+3 hours'), 3),
(3, 1, 'Potong', 3, 'potong', 'COMPLETED', 5400, datetime('now', '-1 day'), datetime('now', '-1 day', '+2 hours'), 4),
(4, 1, 'Sablon', 4, 'print_sablon', 'COMPLETED', 10800, datetime('now', '-1 day', '+3 hours'), datetime('now', '-1 day', '+6 hours'), 3),
(5, 1, 'Jahit', 5, 'jahit', 'IN_PROGRESS', 4200, datetime('now', '-4 hours'), NULL, NULL),
(6, 1, 'QC & Packing', 6, 'qc_packing', 'WAITING', 0, NULL, NULL, NULL),
(7, 1, 'Kirim', 7, 'kirim', 'WAITING', 0, NULL, NULL, NULL);

-- LOG SAMPEL 1
INSERT OR IGNORE INTO time_logs (order_stage_id, order_id, user_id, action, duration_seconds, timestamp) VALUES
(1, 1, 2, 'START', 0, datetime('now', '-2 days')),
(1, 1, 2, 'COMPLETE', 3600, datetime('now', '-2 days', '+1 hour')),
(2, 1, 3, 'START', 0, datetime('now', '-2 days', '+2 hours')),
(2, 1, 3, 'COMPLETE', 2700, datetime('now', '-2 days', '+3 hours')),
(3, 1, 4, 'START', 0, datetime('now', '-1 day')),
(3, 1, 4, 'COMPLETE', 5400, datetime('now', '-1 day', '+2 hours')),
(4, 1, 3, 'START', 0, datetime('now', '-1 day', '+3 hours')),
(4, 1, 3, 'COMPLETE', 10800, datetime('now', '-1 day', '+6 hours')),
(5, 1, 5, 'START', 4200, datetime('now', '-4 hours'));

-- 3. PESANAN SAMPEL 2: JERSEY FUTSAL (BARU DI DESAIN MOCKUP)
INSERT OR IGNORE INTO orders (
    id, order_number, tracking_code, customer_name, customer_phone, article_name,
    category, fabric_type, print_type, notes, deadline_date,
    size_xs, size_s, size_m, size_l, size_xl, size_2xl, size_3xl, total_pcs,
    current_stage_id, current_role, status, created_by, created_at
) VALUES (
    2, 'SPK-202610-002', 'TRK-JRSY02', 'SMA Negeri 5 Surabaya', '081223344556',
    'Jersey Futsal Tim Elang Biru + Nameset', 'jersey', 'Dryfit Milano Premium Gramasi 160',
    'Full Sublimasi Epson UltraChrome', 'Font nomor punggung style Arial Black rounded, kerah V-neck',
    date('now', '+5 days'),
    0, 4, 8, 8, 4, 0, 0, 24,
    8, 'desain', 'WAITING', 1, datetime('now', '-3 hours')
);

-- TAHAPAN SAMPEL 2 (JERSEY: 6 Stages)
INSERT OR IGNORE INTO order_stages (id, order_id, stage_name, stage_order, assigned_role, status, total_active_seconds, started_at, completed_at, completed_by_user_id) VALUES
(8, 2, 'Desain Mockup', 1, 'desain', 'WAITING', 0, NULL, NULL, NULL),
(9, 2, 'Setting Sublim', 2, 'print_sablon', 'WAITING', 0, NULL, NULL, NULL),
(10, 2, 'Potong', 3, 'potong', 'WAITING', 0, NULL, NULL, NULL),
(11, 2, 'Jahit', 4, 'jahit', 'WAITING', 0, NULL, NULL, NULL),
(12, 2, 'QC & Packing', 5, 'qc_packing', 'WAITING', 0, NULL, NULL, NULL),
(13, 2, 'Kirim', 6, 'kirim', 'WAITING', 0, NULL, NULL, NULL);

-- 4. PESANAN SAMPEL 3: JERSEY COMPLETED BESERTA HASIL QC
INSERT OR IGNORE INTO orders (
    id, order_number, tracking_code, customer_name, customer_phone, article_name,
    category, fabric_type, print_type, notes, deadline_date,
    size_xs, size_s, size_m, size_l, size_xl, size_2xl, size_3xl, total_pcs,
    current_stage_id, current_role, status, created_by, created_at, completed_at
) VALUES (
    3, 'SPK-202610-003', 'TRK-DONE88', 'PT. Mandiri Solusindo', '081122334455',
    'Jersey Lari Fun Run 5K Mandiri', 'jersey', 'Dryfit Benzema Anti-Bacterial',
    'Sublimasi Full Body + Reflective Logo', 'Packing plastik per pcs + hangtag barcode manual',
    date('now', '-1 day'),
    0, 15, 20, 10, 5, 0, 0, 50,
    19, 'kirim', 'COMPLETED', 1, datetime('now', '-5 days'), datetime('now', '-1 day')
);

-- TAHAPAN SAMPEL 3
INSERT OR IGNORE INTO order_stages (id, order_id, stage_name, stage_order, assigned_role, status, total_active_seconds, started_at, completed_at, completed_by_user_id) VALUES
(14, 3, 'Desain Mockup', 1, 'desain', 'COMPLETED', 3600, datetime('now', '-5 days'), datetime('now', '-5 days', '+1 hour'), 2),
(15, 3, 'Setting Sublim', 2, 'print_sablon', 'COMPLETED', 4500, datetime('now', '-5 days', '+2 hours'), datetime('now', '-5 days', '+3 hours'), 3),
(16, 3, 'Potong', 3, 'potong', 'COMPLETED', 3000, datetime('now', '-4 days'), datetime('now', '-4 days', '+1 hour'), 4),
(17, 3, 'Jahit', 4, 'jahit', 'COMPLETED', 12000, datetime('now', '-3 days'), datetime('now', '-2 days'), 5),
(18, 3, 'QC & Packing', 5, 'qc_packing', 'COMPLETED', 3600, datetime('now', '-2 days'), datetime('now', '-2 days', '+1 hour'), 6),
(19, 3, 'Kirim', 6, 'kirim', 'COMPLETED', 1800, datetime('now', '-1 day'), datetime('now', '-1 day', '+30 minutes'), 7);

-- HASIL QC SAMPEL 3 (49 lolos, 1 reject = 98% lolos)
INSERT OR IGNORE INTO qc_results (order_id, order_stage_id, inspector_user_id, total_checked, pcs_passed, pcs_reject, pass_percentage, reject_reason, rework_notes) VALUES
(3, 18, 6, 50, 49, 1, 98.0, '1 pcs jersey kerah miring 0.5 cm pada bagian rib leher kanan', 'Diserahkan ke penjahit untuk diperbaiki');


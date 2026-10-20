# 🧵 WIP Tracking Produksi Konveksi & Jersey (Apparel Production Control)

Aplikasi web modern **Work-in-Progress (WIP) Tracking** yang dirancang khusus untuk industri konveksi kaos dan jersey custom. Sistem ini mengutamakan kecepatan operasional lantai produksi **tanpa scanner barcode kamera**, menggunakan antrean digital berbasis meja PIC divisi, cetak lembar kerja fisik A4 siap print, time tracking durasi kerja bersih (bersih dari waktu jeda), kalkulasi mutu QC, serta link pelacakan publik untuk pembeli.

---

## 🌟 1. Alur & Konsep Kerja

1. **Tanpa Scanner Barcode Kamera**: Operasional lantai kerja mengandalkan kartu antrean digital yang responsif di smartphone, tablet, maupun PC desktop PIC divisi.
2. **Cetak Lembar Kerja Fisik (SPK A4)**: Admin menerbitkan pesanan dan mencetak SPK fisik format standar A4 untuk diserahkan ke lantai produksi, dilengkapi QR Code untuk tracking publik dan tabel checklist paraf manual antar divisi.
3. **1 Akun Login per Divisi**: Setiap divisi dipegang oleh 1 ketua/PIC divisi.
4. **Antrean Meja Digital & Tombol Aksi**:
   - **Mulai (Start)**: Memulai timer kerja aktif (live stopwatch berjalan).
   - **Jeda (Pause)**: Menjeda pengerjaan (istirahat/menunggu bahan), waktu jeda **tidak dihitung**.
   - **Lanjutkan (Resume)**: Melanjutkan dari status jeda.
   - **Selesai (Complete)**: Menyelesaikan tahapan dan **secara otomatis memindahkan pesanan ke meja divisi berikutnya**.
5. **Monitoring Owner**: Dashboard internal untuk memantau status semua pesanan, beban antrean divisi, rekapitulasi durasi bersih, dan tingkat keberhasilan QC.
6. **Portal Publik Pelanggan**: Pembeli dapat memantau progres pesanan secara transparan melalui tautan unik `/track/[tracking_code]` tanpa perlu login.

---

## 🛠️ 2. Rekomendasi Tech Stack

| Layer | Teknologi | Alasan Pemilihan |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v18+) | Ringan, non-blocking I/O, cepat dijalankan di berbagai OS. |
| **Framework** | Express.js (v5) | Minimalis, performa tinggi, struktur MVC bersih dan mudah dirawat. |
| **Database** | SQLite (`sql.js` / native) | File-based, tanpa setup server database terpisah, portabel, zero-configuration. |
| **Template Engine** | EJS | Server-side rendering cepat, SEO-friendly, integrasi mudah dengan Tailwind. |
| **CSS & Styling** | Tailwind CSS + Custom CSS | Responsif mobile & desktop, utilities cepat, styling `@media print` presisi A4. |
| **Session & Auth** | `express-session` + `bcryptjs` | Keamanan hashing password standar industri dan session berbasis cookie. |
| **Utility** | `qrcode` | Pembuatan QR Code otomatis untuk lembar fisik SPK A4 dan kartu pesanan. |

---

## 🗂️ 3. Struktur Folder Proyek (File Explorer Rapi)

```text
TRACKING PRODUKSI KONVEKSI/
├── database/
│   ├── schema.sql              # DDL skema database 5 tabel SQLite
│   ├── seed.sql                # Data awal: akun 7 divisi & 3 sampel pesanan
│   └── produksi.sqlite         # File database SQLite (auto-generate)
├── public/
│   ├── css/
│   │   ├── style.css           # Styling kustom, variabel tema, animasi timer
│   │   └── print-spk.css       # CSS presisi format cetak fisik A4 (@media print)
│   ├── js/
│   │   ├── live-timer.js       # Script stopwatch live per detik di browser
│   │   ├── queue-actions.js    # Konfirmasi aksi & modal input QC & Packing
│   │   └── tracking-page.js    # Fitur salin link & auto-refresh tracking publik
│   └── favicon.ico
├── src/
│   ├── config/
│   │   └── database.js         # Koneksi database SQLite & wrapper query
│   ├── controllers/
│   │   ├── authController.js       # Login PIC divisi, quick switcher, logout
│   │   ├── dashboardController.js  # Monitoring control room owner/admin
│   │   ├── orderController.js      # Pembuatan SPK, detail pesanan, cetak A4
│   │   ├── stageController.js      # Antrean meja kerja, aksi Mulai/Jeda/Selesai
│   │   └── trackingController.js   # Halaman pelacakan publik pembeli
│   ├── middleware/
│   │   └── authMiddleware.js       # Autentikasi sesi & pembatasan role
│   ├── models/
│   │   ├── userModel.js        # Model data user & PIC
│   │   ├── orderModel.js       # Model data pesanan & agregasi statistik
│   │   ├── stageModel.js       # Model workflow tahapan & transisi antrean
│   │   ├── timeLogModel.js     # Model pencatatan log waktu kerja bersih
│   │   └── qcModel.js          # Model input & kalkulasi hasil mutu QC
│   ├── routes/
│   │   ├── authRoutes.js       # Rute /login, /logout, /quick-login
│   │   ├── adminRoutes.js      # Rute /admin (dashboard, orders, new, spk)
│   │   ├── divisionRoutes.js   # Rute /division/queue, /division/stage/:id/action
│   │   └── trackingRoutes.js   # Rute /track/:code (publik)
│   └── utils/
│       ├── durationHelper.js   # Format durasi jam:menit:detik bersih
│       ├── qrHelper.js         # Generator QR Code link pelacakan
│       └── workflowConfig.js   # Definisi alur resmi Kaos vs Jersey
├── views/
│   ├── layouts/
│   │   └── main.ejs            # Template layout utama (navbar, sidebar, mobile)
│   ├── partials/
│   │   ├── head.ejs            # Meta, CDN Tailwind, Lucide Icons, CSS
│   │   ├── navbar.ejs          # Topbar info user, role badge, quick PIC switcher
│   │   ├── sidebar.ejs         # Navigasi desktop
│   │   └── mobile-nav.ejs      # Bottom bar navigasi smartphone/tablet
│   ├── auth/
│   │   └── login.ejs           # Login modern + pemilih cepat divisi (1-klik)
│   ├── admin/
│   │   ├── dashboard.ejs       # Monitoring owner: antrean meja, KPI, QC rate
│   │   ├── orders-list.ejs     # Tabel semua SPK dengan filter kategori & status
│   │   ├── order-create.ejs    # Form SPK baru + tabel size breakdown otomatis
│   │   ├── order-detail.ejs    # Detail SPK, rekap durasi per meja, hasil QC
│   │   └── spk-print.ejs       # Lembar Kerja Fisik A4 siap cetak + QR & checklist
│   ├── division/
│   │   ├── queue.ejs           # Meja kerja PIC (tab kerja, jeda, antrean)
│   │   └── partials/
│   │       └── qc-modal.ejs    # Modal input Pcs Lolos & Reject QC
│   └── tracking/
│       └── public-track.ejs    # Halaman progres visual pembeli tanpa login
├── .env.example
├── package.json
└── README.md
```

---

## 🗄️ 4. Rancangan Skema Database (SQLite)

### 1. Tabel `users`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Auto increment |
| `username` | TEXT UNIQUE | Username PIC divisi (e.g. `admin`, `jahit`, `potong`) |
| `password_hash` | TEXT | Hash password via Bcrypt |
| `full_name` | TEXT | Nama lengkap penanggung jawab |
| `role` | TEXT | Role: `admin`, `desain`, `potong`, `print_sablon`, `jahit`, `qc_packing`, `kirim` |
| `division_name` | TEXT | Label divisi (e.g. "Divisi Jahit (Sewing)") |

### 2. Tabel `orders`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Auto increment |
| `order_number` | TEXT UNIQUE | Nomor SPK (e.g. `SPK-202610-001`) |
| `tracking_code` | TEXT UNIQUE | Kode unik publik (e.g. `TRK-KAOS99`) |
| `customer_name` | TEXT | Nama pemesan / instansi |
| `customer_phone`| TEXT | No. WhatsApp pelanggan |
| `article_name` | TEXT | Nama artikel/desain produk |
| `category` | TEXT | `kaos` atau `jersey` |
| `fabric_type` | TEXT | Jenis bahan kain |
| `print_type` | TEXT | Jenis sablon / sublimasi |
| `notes` | TEXT | Instruksi teknis lembar kerja |
| `deadline_date` | DATE | Tenggat waktu pesanan |
| `size_xs` s/d `size_3xl` | INTEGER | Rincian jumlah ukuran baju |
| `total_pcs` | INTEGER | Total pcs pesanan |
| `current_stage_id` | INTEGER | ID tahap yang sedang aktif |
| `current_role` | TEXT | Role divisi penanggung jawab tahap aktif |
| `status` | TEXT | `WAITING`, `IN_PROGRESS`, `PAUSED`, `COMPLETED` |

### 3. Tabel `order_stages`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Auto increment |
| `order_id` | INTEGER FK | Relasi ke `orders.id` (CASCADE) |
| `stage_name` | TEXT | Nama tahapan (e.g. "Potong", "Jahit") |
| `stage_order` | INTEGER | Urutan pengerjaan (1, 2, 3, dst.) |
| `assigned_role` | TEXT | Divisi PIC pelaksana |
| `status` | TEXT | `WAITING`, `IN_PROGRESS`, `PAUSED`, `COMPLETED` |
| `total_active_seconds`| INTEGER | Durasi aktif bersih tersimpan (detik) |
| `started_at` | DATETIME | Waktu pertama kali ditekan Mulai |
| `last_timer_started_at`| DATETIME | Timestamp sesi timer aktif terakhir |
| `completed_at` | DATETIME | Timestamp saat diselesaikan |

### 4. Tabel `time_logs`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Auto increment |
| `order_stage_id` | INTEGER FK | Relasi ke `order_stages.id` |
| `order_id` | INTEGER FK | Relasi ke `orders.id` |
| `user_id` | INTEGER FK | PIC yang menekan tombol |
| `action` | TEXT | `START`, `PAUSE`, `RESUME`, `COMPLETE` |
| `duration_seconds` | INTEGER | Durasi aktif pada sesi tersebut (detik) |
| `timestamp` | DATETIME | Waktu tombol ditekan |

### 5. Tabel `qc_results`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Auto increment |
| `order_id` | INTEGER FK | Relasi ke `orders.id` (UNIQUE) |
| `inspector_user_id` | INTEGER FK | PIC QC yang melakukan inspeksi |
| `total_checked` | INTEGER | Total pcs yang diperiksa |
| `pcs_passed` | INTEGER | Jumlah pcs lolos standar |
| `pcs_reject` | INTEGER | Jumlah pcs cacat/reject |
| `pass_percentage` | REAL | Persentase lolos `(pcs_passed / total_checked * 100)` |
| `reject_reason` | TEXT | Keterangan cacat (misal: jahitan lepas, sablon noda) |
| `rework_notes` | TEXT | Tindakan perbaikan (rework) |

---

## 🔄 5. Alur Tahapan Produksi (Workflow Stages)

Sistem secara otomatis membuat tahapan berurutan sesuai kategori saat SPK diterbitkan:

### Alur Kategori Kaos:
$$\text{Desain} \rightarrow \text{Sekrining/Film} \rightarrow \text{Potong} \rightarrow \text{Sablon} \rightarrow \text{Jahit} \rightarrow \text{QC \& Packing} \rightarrow \text{Kirim}$$
* **Desain** (PIC: `desain`)
* **Sekrining/Film** (PIC: `print_sablon`)
* **Potong** (PIC: `potong`)
* **Sablon** (PIC: `print_sablon`)
* **Jahit** (PIC: `jahit`)
* **QC & Packing** (PIC: `qc_packing`)
* **Kirim** (PIC: `kirim`)

### Alur Kategori Jersey:
$$\text{Desain Mockup} \rightarrow \text{Setting Sublim} \rightarrow \text{Potong} \rightarrow \text{Jahit} \rightarrow \text{QC \& Packing} \rightarrow \text{Kirim}$$
* **Desain Mockup** (PIC: `desain`)
* **Setting Sublim** (PIC: `print_sablon`)
* **Potong** (PIC: `potong`)
* **Jahit** (PIC: `jahit`)
* **QC & Packing** (PIC: `qc_packing`)
* **Kirim** (PIC: `kirim`)

---

## ⏱️ 6. Time Tracking Bersih & Kalkulasi QC

1. **Waktu Bersih (Net Active Duration)**:
   - Saat tombol **Mulai / Lanjutkan** ditekan, timer sesi aktif dicatat.
   - Saat tombol **Jeda (Pause)** ditekan, durasi dari sesi tersebut ditambahkan ke `total_active_seconds` dan timer dihentikan.
   - Waktu jeda (misal: jam istirahat siang, sholat, pergantian shift, menunggu benang) **sama sekali tidak dihitung** dalam total waktu kerja.
2. **Kalkulasi QC**:
   - Di tahap **QC & Packing**, sistem memunculkan formulir wajib:
     - `Pcs Lolos`
     - `Pcs Reject`
     - `Keterangan Cacat`
   - Persentase keberhasilan dihitung otomatis:
     $$\text{Persentase QC} = \left(\frac{\text{Pcs Lolos}}{\text{Total Diperiksa}}\right) \times 100\%$$
   - Hasil persentase langsung terakumulasi pada rekapitulasi akhir pesanan dan dashboard mutu produksi.

---

## 👥 7. Akun Login Default PIC Divisi

Semua akun default menggunakan password: **`password123`**

| Role | Username | Nama PIC | Divisi |
| :--- | :--- | :--- | :--- |
| `admin` | `admin` | Hendra Wijaya | Owner & Manajemen |
| `desain` | `desain` | Bagus Pratama | Divisi Desain & Pola |
| `print_sablon` | `print_sablon`| Fajar Ramadhan | Divisi Cetak Sablon & Sublim |
| `potong` | `potong` | Slamet Riyadi | Divisi Potong (Cutting) |
| `jahit` | `jahit` | Ibu Siti Aminah | Divisi Jahit (Sewing) |
| `qc_packing` | `qc_packing` | Dewi Lestari | Divisi QC & Packing |
| `kirim` | `kirim` | Rian Hidayat | Divisi Ekspedisi & Pengiriman |

> 💡 **Tip:** Halaman login juga dilengkapi tombol **1-Klik Quick Login PIC** untuk memudahkan pengujian dan perpindahan divisi tanpa perlu mengetik manual.

---

## 🚀 8. Panduan Menjalankan Aplikasi Langkah demi Langkah

### Langkah 1: Buka Terminal
Buka PowerShell atau Command Prompt pada direktori proyek:
```bash
cd "c:\Users\LENOVO\Documents\PROYEK\TRACKING PRODUKSI KONVEKSI"
```

### Langkah 2: Jalankan Server
Jalankan perintah berikut:
```bash
npm start
```
*(Atau gunakan `npm run dev` untuk mode hot-reload saat pengembangan)*

### Langkah 3: Akses Aplikasi di Browser
- **Dashboard Internal Owner/Admin**: [http://localhost:3000](http://localhost:3000) (Login sebagai `admin`)
- **Meja Kerja PIC Divisi**: [http://localhost:3000/division/queue](http://localhost:3000/division/queue)
- **Portal Tracking Publik Pelanggan**: [http://localhost:3000/track/TRK-KAOS99](http://localhost:3000/track/TRK-KAOS99)
- **Cetak Lembar Kerja Fisik (A4)**: Buka detail order apa saja &rarr; Klik **Cetak Lembar Kerja A4** &rarr; Tekan `Ctrl + P` (atau klik tombol cetak).

---

## ☁️ 9. Panduan Deploy ke Vercel

Proyek ini telah dikonfigurasi siap pakai untuk Vercel Serverless Function (`vercel.json` & `api/index.js`):

1. Buka dashboard Vercel: [vercel.com](https://vercel.com)
2. Klik tombol **Add New...** &rarr; **Project**.
3. Pilih repositori GitHub: `Maksumnawawi/Tracking-konveksi`.
4. Klik **Deploy** (Framework Preset biarkan *Other*, Build & Output settings default).
5. Vercel akan otomatis membangun dan memberikan domain aktif (misal: `https://tracking-konveksi.vercel.app` atau nama domain kustom Anda).



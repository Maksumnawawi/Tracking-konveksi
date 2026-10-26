/**
 * Definisi Alur Kerja Resmi Berdasarkan Kategori Produk di TRCH Screen Printing:
 * 
 * Desain Mockup diselesaikan di awal & di-upload saat pembuatan SPK / Nota.
 * Di lantai workshop fisik, urutan pengerjaan meja produksi adalah:
 * 1. Kaos:
 *    Desain Mockup (Awal/Selesai) -> Sablon -> Potong -> Jahit -> QC & Packing -> Kirim
 * 
 * 2. Jersey:
 *    Desain Mockup (Awal/Selesai) -> Setting & Cetak Sublim -> Potong -> Jahit -> QC & Packing -> Kirim
 */

const WORKFLOW_CONFIG = {
    kaos: [
        { name: 'Desain Mockup', role: 'desain', description: 'Penyusunan mockup & approval desain artikel kaos' },
        { name: 'Sablon', role: 'print_sablon', description: 'Penyablonan manual/mesin pada kain pola / kaos' },
        { name: 'Potong', role: 'potong', description: 'Pemotongan pola kain kaos (badan, lengan, rib leher)' },
        { name: 'Jahit', role: 'jahit', description: 'Perakitan obras, jahit rantai pundak, pasang rib & label' },
        { name: 'QC & Packing', role: 'qc_packing', description: 'Pemeriksaan kualitas jahitan/sablon, buang benang, steam & packing' },
        { name: 'Kirim', role: 'kirim', description: 'Pengepakan koli ekspedisi & serah terima kurir/pelanggan' }
    ],
    jersey: [
        { name: 'Desain Mockup', role: 'desain', description: 'Setting pola jersey, nameset pemain, nomor & sponsor' },
        { name: 'Setting & Cetak Sublim', role: 'print_sablon', description: 'RIP printing kertas sublim & transfer heat press roll' },
        { name: 'Potong', role: 'potong', description: 'Pemotongan pola jersey hasil press sublim' },
        { name: 'Jahit', role: 'jahit', description: 'Perakitan jersey, pasang kerah V/O-neck, manset lengan' },
        { name: 'QC & Packing', role: 'qc_packing', description: 'Pemeriksaan jahitan sublim, size tag, lipat & plastik OPP' },
        { name: 'Kirim', role: 'kirim', description: 'Pengepakan akhir & pengiriman via ekspedisi' }
    ]
};

const ROLE_LABELS = {
    admin: 'Admin',
    desain: 'Divisi Desain & Pola',
    print_sablon: 'Divisi Cetak Sablon / Sublim',
    potong: 'Divisi Potong (Cutting)',
    jahit: 'Divisi Jahit (Sewing)',
    qc_packing: 'Divisi QC & Packing',
    kirim: 'Divisi Pengiriman & Ekspedisi'
};

const ROLE_BADGES = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    desain: 'bg-blue-100 text-blue-800 border-blue-200',
    print_sablon: 'bg-amber-100 text-amber-800 border-amber-200',
    potong: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    jahit: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    qc_packing: 'bg-rose-100 text-rose-800 border-rose-200',
    kirim: 'bg-sky-100 text-sky-800 border-sky-200'
};

module.exports = {
    WORKFLOW_CONFIG,
    ROLE_LABELS,
    ROLE_BADGES
};


const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const isVercel = Boolean(process.env.VERCEL);
const dbPath = isVercel 
    ? path.join('/tmp', 'produksi.sqlite')
    : path.join(__dirname, '..', '..', 'database', 'produksi.sqlite');

const bundledDbPath = path.join(__dirname, '..', '..', 'database', 'produksi.sqlite');
const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
const seedPath = path.join(__dirname, '..', '..', 'database', 'seed.sql');

let db = null;
let SQL = null;

async function initDatabase() {
    if (db) return db;

    SQL = await initSqlJs({
        locateFile: (file) => {
            const localWasm = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file);
            if (fs.existsSync(localWasm)) return localWasm;
            const cwdWasm = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
            if (fs.existsSync(cwdWasm)) return cwdWasm;
            return file;
        }
    });

    if (isVercel) {
        // Pada Vercel Serverless, hanya folder /tmp yang memiliki akses tulis (writable)
        if (!fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
            try {
                fs.copyFileSync(bundledDbPath, dbPath);
            } catch (copyErr) {
                console.warn('Gagal menyalin database bundled ke /tmp:', copyErr.message);
            }
        }
    } else {
        // Pastikan folder database ada secara lokal
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    const fileExists = fs.existsSync(dbPath);

    if (fileExists) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Jalankan PRAGMA foreign_keys
    db.run("PRAGMA foreign_keys = ON;");

    // Jalankan skema jika file baru atau tabel belum ada
    const checkTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    const isNew = checkTable.length === 0 || checkTable[0].values.length === 0;

    if (isNew) {
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schemaSql);
        }
        if (fs.existsSync(seedPath)) {
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            db.exec(seedSql);
        }
        migrateTrchSchema(db);
        saveDatabase();
    } else {
        // Auto-migration untuk tabel notifikasi jika belum ada
        db.run(`
            CREATE TABLE IF NOT EXISTS order_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                target_role TEXT DEFAULT 'all',
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_read INTEGER DEFAULT 0
            );
        `);
        migrateTrchSchema(db);
        saveDatabase();
    }

    return db;
}

function migrateTrchSchema(database) {
    try {
        const tableInfo = database.exec("PRAGMA table_info(orders);");
        const existingCols = new Set();
        if (tableInfo.length && tableInfo[0].values) {
            tableInfo[0].values.forEach(row => existingCols.add(row[1]));
        }

        const newColumns = [
            { name: 'po_number', type: 'INTEGER DEFAULT 1' },
            { name: 'tgl_masuk', type: 'TEXT' },
            { name: 'tgl_jadi', type: 'TEXT' },
            { name: 'tinta_type', type: 'TEXT DEFAULT "PLASTISOL"' },
            { name: 'finishing_type', type: 'TEXT DEFAULT "PRES DOFT"' },
            { name: 'warna_kaos', type: 'TEXT DEFAULT "HITAM, PUTIH"' },
            { name: 'warna_sablon_depan', type: 'TEXT DEFAULT ""' },
            { name: 'warna_sablon_belakang', type: 'TEXT DEFAULT ""' },
            { name: 'shipping_courier', type: 'TEXT DEFAULT "TUNAI"' },
            { name: 'mockup_front_url', type: 'TEXT DEFAULT ""' },
            { name: 'mockup_back_url', type: 'TEXT DEFAULT ""' },
            { name: 'free_qty', type: 'INTEGER DEFAULT 0' },
            { name: 'items_breakdown_json', type: 'TEXT DEFAULT "[]"' },
            { name: 'price_matrix_json', type: 'TEXT DEFAULT "{}"' },
            { name: 'total_price', type: 'INTEGER DEFAULT 0' },
            { name: 'down_payment', type: 'INTEGER DEFAULT 0' },
            { name: 'remaining_payment', type: 'INTEGER DEFAULT 0' },
            { name: 'nota_number', type: 'TEXT DEFAULT ""' },
            { name: 'nota_month', type: 'TEXT DEFAULT ""' },
            { name: 'nota_notes', type: 'TEXT DEFAULT ""' },
            { name: 'customer_address', type: 'TEXT DEFAULT ""' },
            { name: 'size_4xl', type: 'INTEGER DEFAULT 0' },
            { name: 'size_5xl', type: 'INTEGER DEFAULT 0' },
            { name: 'collar_type', type: 'TEXT DEFAULT ""' },
            { name: 'collar_notes', type: 'TEXT DEFAULT ""' },
            { name: 'category_notes', type: 'TEXT DEFAULT ""' },
            { name: 'variant_notes', type: 'TEXT DEFAULT ""' }
        ];

        newColumns.forEach(col => {
            if (!existingCols.has(col.name)) {
                database.run(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type};`);
            }
        });

        // Update nama dummy lama menjadi 'Nama Kepala' dan 'Admin' jika masih berisi nama sampel bawaan
        database.run(`
            UPDATE users SET full_name = 'Admin', division_name = 'Admin' 
            WHERE username = 'admin' AND (full_name LIKE '%Hendra%' OR full_name LIKE '%Owner%');
        `);
        database.run(`
            UPDATE users SET full_name = 'Nama Kepala' 
            WHERE username != 'admin' AND full_name IN ('Bagus Pratama', 'Fajar Ramadhan', 'Slamet Riyadi', 'Ibu Siti Aminah', 'Dewi Lestari', 'Rian Hidayat');
        `);

        // Otomatis selesaikan tahap Desain yang masih WAITING dan majukan pesanan langsung ke meja Sablon
        try {
            database.run(`
                UPDATE order_stages 
                SET status = 'COMPLETED', completed_at = datetime('now')
                WHERE assigned_role = 'desain' AND status = 'WAITING';
            `);
            database.run(`
                UPDATE orders 
                SET current_stage_id = (
                    SELECT id FROM order_stages 
                    WHERE order_stages.order_id = orders.id AND assigned_role = 'print_sablon' 
                    LIMIT 1
                ),
                current_role = 'print_sablon',
                status = 'IN_PROGRESS'
                WHERE current_role = 'desain' AND EXISTS (
                    SELECT 1 FROM order_stages 
                    WHERE order_stages.order_id = orders.id AND assigned_role = 'print_sablon'
                );
            `);
        } catch (migErr) {
            console.warn('Migrasi tahapan Desain ke Sablon:', migErr.message);
        }
    } catch (e) {
        console.warn('Migration TRCH notice:', e.message);
    }
}

function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    } catch (err) {
        console.error('Gagal menyimpan file database SQLite:', err);
    }
}

// Wrapper query return array of objects: [ { id: 1, name: '...' } ]
function query(sql, params = []) {
    if (!db) throw new Error('Database belum diinisialisasi. Panggil initDatabase() terlebih dahulu.');
    try {
        const stmt = db.prepare(sql);
        if (params && params.length > 0) {
            stmt.bind(params);
        }
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    } catch (err) {
        console.error('SQL Query Error:', err.message, 'SQL:', sql, 'Params:', params);
        throw err;
    }
}

// Wrapper get single row
function get(sql, params = []) {
    const rows = query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// Wrapper run INSERT / UPDATE / DELETE
function run(sql, params = []) {
    if (!db) throw new Error('Database belum diinisialisasi.');
    try {
        db.run(sql, params);
        const lastIdRes = db.exec("SELECT last_insert_rowid() AS id");
        const changesRes = db.exec("SELECT changes() AS changes");
        const lastInsertRowid = lastIdRes.length && lastIdRes[0].values.length ? lastIdRes[0].values[0][0] : 0;
        const changes = changesRes.length && changesRes[0].values.length ? changesRes[0].values[0][0] : 0;
        
        saveDatabase();
        return { lastInsertRowid, changes };
    } catch (err) {
        console.error('SQL Run Error:', err.message, 'SQL:', sql, 'Params:', params);
        throw err;
    }
}

// Wrapper exec multiple raw SQL statements
function exec(sql) {
    if (!db) throw new Error('Database belum diinisialisasi.');
    const result = db.exec(sql);
    saveDatabase();
    return result;
}

module.exports = {
    initDatabase,
    saveDatabase,
    query,
    get,
    run,
    exec,
    getDb: () => db
};

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
        saveDatabase();
    }

    return db;
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

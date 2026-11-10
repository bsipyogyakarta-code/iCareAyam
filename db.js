/**
 * Database Module untuk BRMP DIY Poultry Tracker
 * Kompatibel dengan:
 * 1. Node.js Lokal (Windows/Linux/Mac)
 * 2. Vercel Serverless Function (Menyimpan di /tmp agar tidak EROFS read-only error)
 * 3. Fallback File / JSON Memory jika SQLite tidak aktif di serverless tertentu
 */

const fs = require('node:fs');
const path = require('node:path');

// Deteksi apakah sedang berjalan di lingkungan Vercel Serverless
const isVercel = !!process.env.VERCEL;

// Pada Vercel, hanya folder /tmp yang diizinkan untuk operasi tulis (writable)
const dataDir = isVercel ? path.join('/tmp', 'brmp-data') : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'poultry.sqlite');
const jsonBackupPath = path.join(dataDir, 'poultry_fallback.json');

let db = null;
let useSqlite = false;

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
  useSqlite = true;
  initSqliteTables();
  console.log('✅ SQLite aktif:', dbPath);
} catch (e) {
  console.warn('⚠️ node:sqlite tidak tersedia, beralih ke Fallback JSON Store:', e.message);
  useSqlite = false;
}

function initSqliteTables() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS flocks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      breed TEXT NOT NULL,
      production_type TEXT NOT NULL DEFAULT 'broiler',
      doc_date TEXT NOT NULL,
      initial_pop INTEGER NOT NULL,
      current_pop INTEGER NOT NULL,
      cage_type TEXT DEFAULT '',
      location TEXT DEFAULT '',
      officer TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weighings (
      id TEXT PRIMARY KEY,
      flock_id TEXT NOT NULL,
      week INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      age_days INTEGER NOT NULL,
      avg_weight REAL NOT NULL,
      target_weight REAL NOT NULL,
      sample_count INTEGER DEFAULT 0,
      samples_json TEXT DEFAULT '[]',
      uniformity REAL DEFAULT 0,
      feed_intake_kg REAL DEFAULT 0,
      mortality INTEGER DEFAULT 0,
      cull INTEGER DEFAULT 0,
      population_added INTEGER DEFAULT 0,
      population_decreased INTEGER DEFAULT 0,
      population_shipped INTEGER DEFAULT 0,
      egg_count INTEGER DEFAULT 0,
      egg_weight_kg REAL DEFAULT 0,
      health_note TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flock_id) REFERENCES flocks (id) ON DELETE CASCADE
    );
  `);

  const flockColumns = db.prepare('PRAGMA table_info(flocks)').all().map(column => column.name);
  if (!flockColumns.includes('production_type')) {
    db.exec("ALTER TABLE flocks ADD COLUMN production_type TEXT NOT NULL DEFAULT 'broiler'");
  }
  const weighingColumns = db.prepare('PRAGMA table_info(weighings)').all().map(column => column.name);
  const migrations = [
    ['population_added', 'INTEGER DEFAULT 0'],
    ['population_decreased', 'INTEGER DEFAULT 0'],
    ['population_shipped', 'INTEGER DEFAULT 0'],
    ['egg_count', 'INTEGER DEFAULT 0'],
    ['egg_weight_kg', 'REAL DEFAULT 0']
  ];
  migrations.forEach(([column, definition]) => {
    if (!weighingColumns.includes(column)) {
      db.exec(`ALTER TABLE weighings ADD COLUMN ${column} ${definition}`);
    }
  });
}

// Fallback JSON Store jika Vercel berjalan di runtime tanpa native SQLite
function readJsonStore() {
  try {
    if (fs.existsSync(jsonBackupPath)) {
      const raw = fs.readFileSync(jsonBackupPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {}
  return { flocks: [], weighings: [] };
}

function writeJsonStore(data) {
  try {
    fs.writeFileSync(jsonBackupPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing json store:', e);
  }
}

module.exports = {
  db,
  dataDir,
  dbPath,
  isVercel,

  getAllFlocks() {
    if (useSqlite && db) {
      const stmt = db.prepare('SELECT * FROM flocks ORDER BY created_at DESC');
      return stmt.all();
    }
    const store = readJsonStore();
    return store.flocks.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  },

  getFlockById(id) {
    if (useSqlite && db) {
      const stmt = db.prepare('SELECT * FROM flocks WHERE id = ?');
      return stmt.get(id);
    }
    const store = readJsonStore();
    return store.flocks.find(f => f.id === id) || null;
  },

  createFlock(flock) {
    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO flocks (id, name, code, breed, production_type, doc_date, initial_pop, current_pop, cage_type, location, officer, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        flock.id,
        flock.name,
        flock.code,
        flock.breed,
        flock.productionType || 'broiler',
        flock.docDate,
        flock.initialPop,
        flock.initialPop,
        flock.cageType || '',
        flock.location || '',
        flock.officer || '',
        flock.notes || ''
      );
      return this.getFlockById(flock.id);
    }

    const store = readJsonStore();
    const newF = {
      id: flock.id,
      name: flock.name,
      code: flock.code,
      breed: flock.breed,
      production_type: flock.productionType || 'broiler',
      doc_date: flock.docDate,
      initial_pop: flock.initialPop,
      current_pop: flock.initialPop,
      cage_type: flock.cageType || '',
      location: flock.location || '',
      officer: flock.officer || '',
      notes: flock.notes || '',
      created_at: new Date().toISOString()
    };
    store.flocks.push(newF);
    writeJsonStore(store);
    return newF;
  },

  updateFlockCurrentPop(flockId) {
    const flock = this.getFlockById(flockId);
    if (!flock) return;

    if (useSqlite && db) {
      const weighingsStmt = db.prepare('SELECT mortality, cull, population_added, population_decreased, population_shipped FROM weighings WHERE flock_id = ?');
      const records = weighingsStmt.all(flockId);
      let population = Number(flock.initial_pop) || 0;
      for (const r of records) {
        population += (r.population_added || 0) - (r.population_decreased || 0)
          - (r.population_shipped || 0) - (r.mortality || 0) - (r.cull || 0);
      }
      const currentPop = Math.max(0, population);
      const updateStmt = db.prepare('UPDATE flocks SET current_pop = ? WHERE id = ?');
      updateStmt.run(currentPop, flockId);
      return;
    }

    const store = readJsonStore();
    const weighings = store.weighings.filter(w => w.flock_id === flockId);
    const currentPop = Math.max(0, weighings.reduce((population, w) => population
      + (Number(w.population_added) || 0) - (Number(w.population_decreased) || 0)
      - (Number(w.population_shipped) || 0) - (Number(w.mortality) || 0) - (Number(w.cull) || 0),
    Number(flock.initial_pop) || 0));
    const targetFlock = store.flocks.find(f => f.id === flockId);
    if (targetFlock) {
      targetFlock.current_pop = currentPop;
      writeJsonStore(store);
    }
  },

  deleteFlock(id) {
    if (useSqlite && db) {
      const delWeighings = db.prepare('DELETE FROM weighings WHERE flock_id = ?');
      delWeighings.run(id);
      const delFlock = db.prepare('DELETE FROM flocks WHERE id = ?');
      delFlock.run(id);
      return;
    }

    const store = readJsonStore();
    store.flocks = store.flocks.filter(f => f.id !== id);
    store.weighings = store.weighings.filter(w => w.flock_id !== id);
    writeJsonStore(store);
  },

  getWeighingsByFlock(flockId) {
    if (useSqlite && db) {
      const stmt = db.prepare('SELECT * FROM weighings WHERE flock_id = ? ORDER BY date ASC, age_days ASC, week ASC');
      const rows = stmt.all(flockId);
      return rows.map(r => ({
        id: r.id,
        flockId: r.flock_id,
        week: r.week,
        day: r.age_days,
        date: r.date,
        ageDays: r.age_days,
        avgWeight: r.avg_weight,
        targetWeight: r.target_weight,
        sampleCount: r.sample_count,
        samples: JSON.parse(r.samples_json || '[]'),
        uniformity: r.uniformity,
        feedIntakeKg: r.feed_intake_kg,
        mortality: r.mortality,
        cull: r.cull,
        populationAdded: r.population_added,
        populationDecreased: r.population_decreased,
        populationShipped: r.population_shipped,
        eggCount: r.egg_count,
        eggWeightKg: r.egg_weight_kg,
        healthNote: r.health_note,
        photoUrl: r.photo_url,
        createdAt: r.created_at
      }));
    }

    const store = readJsonStore();
    return store.weighings
      .filter(w => w.flock_id === flockId)
      .sort((a, b) => (a.age_days || a.week * 7) - (b.age_days || b.week * 7))
      .map(r => ({
        id: r.id,
        flockId: r.flock_id,
        week: r.week,
        day: r.age_days,
        date: r.date,
        ageDays: r.age_days,
        avgWeight: r.avg_weight,
        targetWeight: r.target_weight,
        sampleCount: r.sample_count,
        samples: Array.isArray(r.samples) ? r.samples : JSON.parse(r.samples_json || '[]'),
        uniformity: r.uniformity,
        feedIntakeKg: r.feed_intake_kg,
        mortality: r.mortality,
        cull: r.cull,
        populationAdded: r.population_added || 0,
        populationDecreased: r.population_decreased || 0,
        populationShipped: r.population_shipped || 0,
        eggCount: r.egg_count || 0,
        eggWeightKg: r.egg_weight_kg || 0,
        healthNote: r.health_note,
        photoUrl: r.photo_url,
        createdAt: r.created_at
      }));
  },

  upsertWeighing(weighing) {
    const ageDays = Number(weighing.ageDays != null ? weighing.ageDays : (weighing.day != null ? weighing.day : Number(weighing.week || 1) * 7));
    const week = Number(weighing.week || Math.max(1, Math.ceil(ageDays / 7)));
    const id = weighing.id || `w-${weighing.flockId}-d${ageDays}-${weighing.date || 'rec'}`;
    
    if (useSqlite && db) {
      // Cari apakah sudah ada data untuk tanggal atau hari ini pada flok yang bersangkutan
      let recordId = id;
      try {
        const existing = db.prepare('SELECT id FROM weighings WHERE flock_id = ? AND (id = ? OR date = ? OR (age_days = ? AND age_days > 0)) LIMIT 1')
          .get(weighing.flockId, id, weighing.date || '', ageDays);
        if (existing && existing.id) {
          recordId = existing.id;
        }
      } catch (e) {}

      const stmt = db.prepare(`
        INSERT INTO weighings (
          id, flock_id, week, date, age_days, avg_weight, target_weight,
          sample_count, samples_json, uniformity, feed_intake_kg, mortality, cull,
          population_added, population_decreased, population_shipped, egg_count, egg_weight_kg, health_note, photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          date = excluded.date,
          week = excluded.week,
          age_days = excluded.age_days,
          avg_weight = excluded.avg_weight,
          target_weight = excluded.target_weight,
          sample_count = excluded.sample_count,
          samples_json = excluded.samples_json,
          uniformity = excluded.uniformity,
          feed_intake_kg = excluded.feed_intake_kg,
          mortality = excluded.mortality,
          cull = excluded.cull,
          population_added = excluded.population_added,
          population_decreased = excluded.population_decreased,
          population_shipped = excluded.population_shipped,
          egg_count = excluded.egg_count,
          egg_weight_kg = excluded.egg_weight_kg,
          health_note = excluded.health_note,
          photo_url = CASE WHEN excluded.photo_url != '' THEN excluded.photo_url ELSE weighings.photo_url END
      `);

      stmt.run(
        recordId,
        weighing.flockId,
        week,
        weighing.date,
        ageDays,
        Number(weighing.avgWeight || 0),
        Number(weighing.targetWeight || weighing.avgWeight || 0),
        Number(weighing.sampleCount || 0),
        JSON.stringify(weighing.samples || []),
        Number(weighing.uniformity || 0),
        Number(weighing.feedIntakeKg || 0),
        Number(weighing.mortality || 0),
        Number(weighing.cull || 0),
        Number(weighing.populationAdded || 0),
        Number(weighing.populationDecreased || 0),
        Number(weighing.populationShipped || 0),
        Number(weighing.eggCount || 0),
        Number(weighing.eggWeightKg || 0),
        weighing.healthNote || '',
        weighing.photoUrl || ''
      );

      this.updateFlockCurrentPop(weighing.flockId);
      return recordId;
    }

    const store = readJsonStore();
    const existingIndex = store.weighings.findIndex(w =>
      w.flock_id === weighing.flockId && (
        w.id === id ||
        (weighing.date && w.date === weighing.date) ||
        (Number(w.age_days) === ageDays && ageDays > 0)
      )
    );
    const entry = {
      id: existingIndex >= 0 ? store.weighings[existingIndex].id : id,
      flock_id: weighing.flockId,
      week: week,
      date: weighing.date,
      age_days: ageDays,
      avg_weight: Number(weighing.avgWeight || 0),
      target_weight: Number(weighing.targetWeight || weighing.avgWeight || 0),
      sample_count: Number(weighing.sampleCount || 0),
      samples: weighing.samples || [],
      uniformity: Number(weighing.uniformity || 0),
      feed_intake_kg: Number(weighing.feedIntakeKg || 0),
      mortality: Number(weighing.mortality || 0),
      cull: Number(weighing.cull || 0),
      population_added: Number(weighing.populationAdded || 0),
      population_decreased: Number(weighing.populationDecreased || 0),
      population_shipped: Number(weighing.populationShipped || 0),
      egg_count: Number(weighing.eggCount || 0),
      egg_weight_kg: Number(weighing.eggWeightKg || 0),
      health_note: weighing.healthNote || '',
      photo_url: weighing.photoUrl || (existingIndex >= 0 ? store.weighings[existingIndex].photo_url : ''),
      created_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      store.weighings[existingIndex] = entry;
    } else {
      store.weighings.push(entry);
    }

    writeJsonStore(store);
    this.updateFlockCurrentPop(weighing.flockId);
    return entry.id;
  },

  deleteWeighing(flockId, key) {
    if (useSqlite && db) {
      const stmt = db.prepare('DELETE FROM weighings WHERE flock_id = ? AND (id = ? OR date = ? OR age_days = ? OR week = ?)');
      stmt.run(flockId, String(key), String(key), Number(key) || -1, Number(key) || -1);
      this.updateFlockCurrentPop(flockId);
      return;
    }

    const store = readJsonStore();
    store.weighings = store.weighings.filter(w =>
      !(w.flock_id === flockId && (
        w.id === String(key) ||
        w.date === String(key) ||
        Number(w.age_days) === Number(key) ||
        Number(w.week) === Number(key)
      ))
    );
    writeJsonStore(store);
    this.updateFlockCurrentPop(flockId);
  }
};

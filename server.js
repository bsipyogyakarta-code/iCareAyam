/**
 * BRMP DIY Poultry Tracker - Backend Server
 * Terhubung ke Cloud Database & Storage Supabase (PostgreSQL + S3 Storage)
 * Siap untuk Vercel Deployment & Akses Global dari Mana Saja
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

const googleSheetsAdapter = require('./googleSheets');
const supabaseAdapter = require('./supabase');
const localDb = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Seleksi adapter cloud aktif (Prioritas: Google Sheets -> Supabase -> Local)
let cloudAdapter = null;
let providerName = 'Local Database';

if (googleSheetsAdapter.isConfigured) {
  cloudAdapter = googleSheetsAdapter;
  providerName = 'Google Sheets (Spreadsheet Cloud)';
} else if (supabaseAdapter.isConfigured) {
  cloudAdapter = supabaseAdapter;
  providerName = 'Supabase Cloud (PostgreSQL)';
}

// Setup Multer (Gunakan MemoryStorage jika Cloud aktif agar foto langsung diunggah ke Google Drive / Cloud Storage)
let upload = null;
if (cloudAdapter) {
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
  });
} else {
  const uploadDir = localDb.isVercel
    ? path.join('/tmp', 'brmp-uploads', 'documentation')
    : path.join(__dirname, 'uploads', 'documentation');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `doc-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    }
  });

  upload = multer({
    storage: diskStorage,
    limits: { fileSize: 10 * 1024 * 1024 }
  });
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static files
const staticRoot = fs.existsSync(path.join(__dirname, 'index.html'))
  ? __dirname
  : path.join(__dirname, '..');

app.use('/css', express.static(path.join(staticRoot, 'css')));
app.use('/js', express.static(path.join(staticRoot, 'js')));
app.use('/assets', express.static(path.join(staticRoot, 'assets')));
app.use('/uploads', express.static(path.join(staticRoot, 'uploads')));
app.use(express.static(staticRoot));

// Route utama untuk melayani index.html
app.get('/', (req, res) => {
  const indexPath = path.join(staticRoot, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.sendFile(path.join(process.cwd(), 'index.html'));
});

// ==========================================
// API ROUTES
// ==========================================

// 0. Status Koneksi Cloud Database
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    cloud: !!cloudAdapter,
    provider: providerName,
    message: cloudAdapter
      ? `Database ${providerName} aktif. Data tersimpan di Cloud dan dapat diakses dari mana saja secara real-time.`
      : 'Database Cloud belum terhubung. Berjalan dalam mode database lokal.'
  });
});

// Endpoint untuk memperbarui header spreadsheet ke Bahasa Indonesia
app.all('/api/sheets/migrate-headers', async (req, res) => {
  try {
    if (cloudAdapter && typeof cloudAdapter.migrateHeaders === 'function') {
      const result = await cloudAdapter.migrateHeaders();
      return res.json({ success: true, message: 'Header Google Spreadsheet berhasil diselaraskan ke Bahasa Indonesia!', result });
    }
    res.status(400).json({ success: false, error: 'Google Sheets Adapter tidak aktif pada server ini.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint untuk memisahkan sheet ayam pedaging dan petelur
app.all('/api/sheets/separate-sheets', async (req, res) => {
  try {
    if (cloudAdapter && typeof cloudAdapter.separateSheets === 'function') {
      const result = await cloudAdapter.separateSheets();
      return res.json({ success: true, message: 'Sheet ayam pedaging dan petelur berhasil dipisahkan!', result });
    }
    res.status(400).json({ success: false, error: 'Google Sheets Adapter tidak aktif pada server ini.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint diagnosis struktur Google Sheets
app.get('/api/sheets/diagnose', async (req, res) => {
  try {
    if (cloudAdapter && typeof cloudAdapter.diagnose === 'function') {
      const result = await cloudAdapter.diagnose();
      return res.json(result);
    }
    res.status(400).json({ success: false, error: 'Google Sheets Adapter tidak aktif pada server ini.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Ambil Semua Flok / Kandang
app.get('/api/flocks', async (req, res) => {
  try {
    if (cloudAdapter) {
      const flocks = await cloudAdapter.getAllFlocks();
      const result = flocks.map(f => {
        const weighings = f.weighings || [];
        return {
          id: f.id,
          name: f.name,
          code: f.code,
          breed: f.breed,
          productionType: f.production_type || (f.breed === 'layer' ? 'layer' : 'broiler'),
          docDate: f.doc_date,
          initialPop: f.initial_pop,
          currentPop: f.current_pop,
          cageType: f.cage_type,
          location: f.location,
          officer: f.officer,
          notes: f.notes,
          createdAt: f.created_at,
          weighingsCount: weighings.length,
          weighings: weighings
        };
      });
      return res.json({ success: true, cloud: true, provider: providerName, data: result });
    }

    // Fallback Local / Vercel Tmp
    const rawFlocks = localDb.getAllFlocks();
    const result = rawFlocks.map(f => {
      const weighings = localDb.getWeighingsByFlock(f.id);
      return {
        id: f.id,
        name: f.name,
        code: f.code,
        breed: f.breed,
        productionType: f.production_type || (f.breed === 'layer' ? 'layer' : 'broiler'),
        docDate: f.doc_date,
        initialPop: f.initial_pop,
        currentPop: f.current_pop,
        cageType: f.cage_type,
        location: f.location,
        officer: f.officer,
        notes: f.notes,
        createdAt: f.created_at,
        weighingsCount: weighings.length,
        weighings: weighings
      };
    });
    res.json({ success: true, cloud: false, data: result });
  } catch (err) {
    console.error('Error GET /api/flocks:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Tambah Flok Baru
app.post('/api/flocks', async (req, res) => {
  try {
    const { name, code, breed, docDate, initialPop, cageType, location, officer, notes } = req.body;
    const productionType = req.body.productionType || (breed === 'layer' ? 'layer' : 'broiler');
    if (!name || !code || !docDate || !initialPop || !['broiler', 'layer'].includes(productionType)) {
      return res.status(400).json({ success: false, error: 'Data flok belum lengkap.' });
    }
    if (!Number.isInteger(Number(initialPop)) || Number(initialPop) < 1) {
      return res.status(400).json({ success: false, error: 'Populasi awal harus berupa bilangan bulat minimal 1.' });
    }

    const flockId = `flock-${Date.now()}`;
    const payload = {
      id: flockId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      breed: breed || 'kub',
      productionType,
      docDate,
      initialPop: Number(initialPop),
      cageType: cageType || '',
      location: location || '',
      officer: officer || '',
      notes: notes || ''
    };

    if (cloudAdapter) {
      const created = await cloudAdapter.createFlock(payload);
      return res.json({
        success: true,
        cloud: true,
        provider: providerName,
        data: {
          id: created.id,
          name: created.name,
          code: created.code,
          breed: created.breed,
          productionType: created.production_type || productionType,
          docDate: created.doc_date,
          initialPop: created.initial_pop,
          currentPop: created.current_pop,
          cageType: created.cage_type,
          location: created.location,
          officer: created.officer,
          notes: created.notes,
          weighings: []
        }
      });
    }

    const created = localDb.createFlock(payload);
    res.json({
      success: true,
      cloud: false,
      data: {
        id: created.id,
        name: created.name,
        code: created.code,
        breed: created.breed,
        productionType: created.production_type || productionType,
        docDate: created.doc_date,
        initialPop: created.initial_pop,
        currentPop: created.current_pop,
        cageType: created.cage_type,
        location: created.location,
        officer: created.officer,
        notes: created.notes,
        weighings: []
      }
    });
  } catch (err) {
    console.error('Error POST /api/flocks:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Detail Flok Tunggal
app.get('/api/flocks/:id', async (req, res) => {
  try {
    if (cloudAdapter) {
      const f = await cloudAdapter.getFlockById(req.params.id);
      if (!f) return res.status(404).json({ success: false, error: 'Flok tidak ditemukan.' });
      const weighings = await cloudAdapter.getWeighingsByFlock(f.id);
      return res.json({
        success: true,
        cloud: true,
        provider: providerName,
        data: {
          id: f.id,
          name: f.name,
          code: f.code,
          breed: f.breed,
          productionType: f.production_type || (f.breed === 'layer' ? 'layer' : 'broiler'),
          docDate: f.doc_date,
          initialPop: f.initial_pop,
          currentPop: f.current_pop,
          cageType: f.cage_type,
          location: f.location,
          officer: f.officer,
          notes: f.notes,
          weighings
        }
      });
    }

    const f = localDb.getFlockById(req.params.id);
    if (!f) return res.status(404).json({ success: false, error: 'Flok tidak ditemukan.' });
    const weighings = localDb.getWeighingsByFlock(f.id);
    res.json({
      success: true,
      cloud: false,
      data: {
        id: f.id,
        name: f.name,
        code: f.code,
        breed: f.breed,
        productionType: f.production_type || (f.breed === 'layer' ? 'layer' : 'broiler'),
        docDate: f.doc_date,
        initialPop: f.initial_pop,
        currentPop: f.current_pop,
        cageType: f.cage_type,
        location: f.location,
        officer: f.officer,
        notes: f.notes,
        weighings
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Hapus Flok
app.delete('/api/flocks/:id', async (req, res) => {
  try {
    if (cloudAdapter) {
      await cloudAdapter.deleteFlock(req.params.id);
      return res.json({ success: true, message: `Flok berhasil dihapus dari ${providerName}.` });
    }
    localDb.deleteFlock(req.params.id);
    res.json({ success: true, message: 'Flok berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Simpan / Update Penimbangan Mingguan (Termasuk Upload Foto ke Cloud Storage)
app.post('/api/flocks/:id/weighings', upload.single('photo'), async (req, res) => {
  try {
    const flockId = req.params.id;
    let {
      week,
      day,
      date,
      ageDays,
      avgWeight,
      targetWeight,
      sampleCount,
      samples,
      uniformity,
      feedIntakeKg,
      mortality,
      cull,
      populationAdded,
      populationDecreased,
      populationShipped,
      eggCount,
      eggWeightKg,
      healthNote
    } = req.body;

    const finalAgeDays = Number(day != null ? day : (ageDays != null ? ageDays : (week != null ? Number(week) * 7 : 0)));
    const finalWeek = Number(week != null && week !== '' ? week : Math.max(1, Math.ceil(finalAgeDays / 7)));

    const populationValues = [populationAdded, populationDecreased, populationShipped]
      .map(value => Number(value || 0));
    const eggCountValue = Number(eggCount || 0);
    const eggWeightValue = Number(eggWeightKg || 0);
    const feedValue = Number(feedIntakeKg || 0);
    if (!Number.isFinite(finalAgeDays) || finalAgeDays < 0 || !date) {
      return res.status(400).json({ success: false, error: 'Hari monitoring dan tanggal harus diisi dengan benar.' });
    }
    if (populationValues.some(value => !Number.isInteger(value) || value < 0)
      || !Number.isInteger(eggCountValue) || eggCountValue < 0
      || !Number.isFinite(eggWeightValue) || eggWeightValue < 0
      || !Number.isFinite(feedValue) || feedValue < 0) {
      return res.status(400).json({ success: false, error: 'Jumlah populasi, telur, bobot telur, dan pakan harus berupa angka nol atau lebih.' });
    }

    let parsedSamples = [];
    if (typeof samples === 'string') {
      try {
        parsedSamples = JSON.parse(samples);
      } catch (e) {
        parsedSamples = samples.split(/[\s,]+/).map(n => parseFloat(n)).filter(n => !isNaN(n) && n > 0);
      }
    } else if (Array.isArray(samples)) {
      parsedSamples = samples;
    }

    let photoUrl = '';
    // Jika Cloud aktif dan user mengunggah foto, unggah langsung ke Cloud Storage (Google Drive / Supabase)!
    if (req.file) {
      if (cloudAdapter && req.file.buffer) {
        photoUrl = await cloudAdapter.uploadDocumentationPhoto(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
      } else if (req.file.filename) {
        photoUrl = `/uploads/documentation/${req.file.filename}`;
      }
    }

    // Cari informasi tipe pemeliharaan flok (pedaging atau petelur)
    let prodType = '';
    if (cloudAdapter) {
      const currentFlock = await cloudAdapter.getFlockById(flockId);
      if (currentFlock) {
        prodType = currentFlock.production_type || currentFlock.productionType || '';
      }
    } else {
      const currentFlock = localDb.getFlockById(flockId);
      if (currentFlock) {
        prodType = currentFlock.production_type || currentFlock.productionType || '';
      }
    }

    const payload = {
      flockId,
      productionType: prodType,
      week: finalWeek,
      day: finalAgeDays,
      date,
      ageDays: finalAgeDays,
      avgWeight: parseFloat(avgWeight || 0),
      targetWeight: parseFloat(targetWeight || avgWeight || 0),
      sampleCount: Number(sampleCount || (parsedSamples.length > 0 ? parsedSamples.length : 30)),
      samples: parsedSamples,
      uniformity: parseFloat(uniformity || 90),
      feedIntakeKg: feedValue,
      mortality: Number(mortality || 0),
      cull: Number(cull || 0),
      populationAdded: populationValues[0],
      populationDecreased: populationValues[1],
      populationShipped: populationValues[2],
      eggCount: eggCountValue,
      eggWeightKg: eggWeightValue,
      healthNote: healthNote || '',
      photoUrl
    };

    if (cloudAdapter) {
      await cloudAdapter.upsertWeighing(payload);
      const updatedWeighings = await cloudAdapter.getWeighingsByFlock(flockId);
      const updatedFlock = await cloudAdapter.getFlockById(flockId);
      return res.json({
        success: true,
        cloud: true,
        provider: providerName,
        message: `Data monitoring hari ke-${finalAgeDays} tersimpan di ${providerName}!`,
        data: {
          flock: updatedFlock,
          weighings: updatedWeighings
        }
      });
    }

    // Local / Tmp fallback
    localDb.upsertWeighing(payload);
    const updatedWeighings = localDb.getWeighingsByFlock(flockId);
    const updatedFlock = localDb.getFlockById(flockId);
    res.json({
      success: true,
      cloud: false,
      data: {
        flock: updatedFlock,
        weighings: updatedWeighings
      }
    });
  } catch (err) {
    console.error('Error POST weighing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Hapus Penimbangan
app.delete('/api/flocks/:id/weighings/:key', async (req, res) => {
  try {
    const { id, key } = req.params;
    if (cloudAdapter) {
      await cloudAdapter.deleteWeighing(id, key);
      return res.json({ success: true, message: `Data telah dihapus dari ${providerName}.` });
    }
    localDb.deleteWeighing(id, key);
    res.json({ success: true, message: `Data monitoring berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server jika dijalankan langsung
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🐔 Server BRMP PoultryTrack aktif di http://localhost:${PORT}`);
    console.log(`🌐 Mode Database: ${cloudAdapter ? `☁️ ${providerName}` : '💻 Local Database'}`);
  });
}

module.exports = app;

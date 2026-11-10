/**
 * BRMP DIY Poultry Tracker - Google Sheets Cloud Database Adapter
 * Menyimpan data kandang dan penimbangan mingguan di Google Spreadsheet via Apps Script Web App
 * Serta foto dokumentasi di Google Drive
 */

require('dotenv').config();

const scriptUrl = process.env.GOOGLE_SCRIPT_URL ? process.env.GOOGLE_SCRIPT_URL.trim() : '';
const isConfigured = !!(scriptUrl && scriptUrl.startsWith('http'));

if (isConfigured) {
  console.log('📊 Google Sheets Cloud Adapter aktif. URL:', scriptUrl.slice(0, 45) + '...');
} else {
  console.warn('⚠️ GOOGLE_SCRIPT_URL belum disetel di environment.');
}

async function callScript(action, payload = {}) {
  if (!isConfigured) {
    throw new Error('GOOGLE_SCRIPT_URL belum dikonfigurasi di environment variable.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const body = JSON.stringify({ action, ...payload });
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body,
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Apps Script error HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const result = await response.json();
    if (result.success === false) {
      throw new Error(result.error || 'Terjadi kesalahan pada Google Spreadsheet API');
    }
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  isConfigured,
  scriptUrl,

  // 1. Ambil Semua Flok / Kandang
  async getAllFlocks() {
    const result = await callScript('getAllFlocks');
    const flocks = result.data || [];
    return flocks.map(f => ({
      id: String(f.id),
      name: f.name || '',
      code: f.code || '',
      breed: f.breed || 'kub',
      production_type: f.production_type || (f.breed === 'layer' ? 'layer' : 'broiler'),
      doc_date: f.doc_date || '',
      initial_pop: Number(f.initial_pop || 0),
      current_pop: Number(f.current_pop != null ? f.current_pop : f.initial_pop || 0),
      cage_type: f.cage_type || '',
      location: f.location || '',
      officer: f.officer || '',
      notes: f.notes || '',
      created_at: f.created_at || new Date().toISOString()
    }));
  },

  // 2. Ambil Flok Berdasarkan ID
  async getFlockById(id) {
    const result = await callScript('getFlockById', { id: String(id) });
    const f = result.data;
    if (!f) return null;
    return {
      id: String(f.id),
      name: f.name || '',
      code: f.code || '',
      breed: f.breed || 'kub',
      production_type: f.production_type || (f.breed === 'layer' ? 'layer' : 'broiler'),
      doc_date: f.doc_date || '',
      initial_pop: Number(f.initial_pop || 0),
      current_pop: Number(f.current_pop != null ? f.current_pop : f.initial_pop || 0),
      cage_type: f.cage_type || '',
      location: f.location || '',
      officer: f.officer || '',
      notes: f.notes || '',
      created_at: f.created_at || ''
    };
  },

  // 3. Tambah Flok Baru
  async createFlock(flock) {
    const record = {
      id: flock.id,
      name: flock.name,
      code: flock.code,
      breed: flock.breed,
      production_type: flock.productionType || flock.production_type || 'broiler',
      doc_date: flock.docDate || flock.doc_date,
      initial_pop: Number(flock.initialPop || flock.initial_pop),
      current_pop: Number(flock.initialPop || flock.initial_pop),
      cage_type: flock.cageType || flock.cage_type || '',
      location: flock.location || '',
      officer: flock.officer || '',
      notes: flock.notes || ''
    };
    const result = await callScript('createFlock', { flock: record });
    return result.data || record;
  },

  // 4. Hapus Flok
  async deleteFlock(id) {
    const result = await callScript('deleteFlock', { id: String(id) });
    return result.success;
  },

  // 5. Ambil Daftar Penimbangan per Flok
  async getWeighingsByFlock(flockId) {
    const result = await callScript('getWeighingsByFlock', { flockId: String(flockId) });
    const rows = result.data || [];
    return rows.map(r => {
      let parsedSamples = [];
      if (Array.isArray(r.samples_json)) {
        parsedSamples = r.samples_json;
      } else if (typeof r.samples_json === 'string' && r.samples_json) {
        try {
          parsedSamples = JSON.parse(r.samples_json);
        } catch (e) {
          parsedSamples = [];
        }
      }
      return {
        id: String(r.id),
        flockId: String(r.flock_id),
        week: Number(r.week || Math.max(1, Math.ceil(Number(r.age_days || 0) / 7))),
        day: Number(r.age_days || 0),
        date: String(r.date || ''),
        ageDays: Number(r.age_days || 0),
        avgWeight: Number(r.avg_weight || 0),
        targetWeight: Number(r.target_weight || 0),
        sampleCount: Number(r.sample_count || 0),
        samples: parsedSamples,
        uniformity: Number(r.uniformity || 0),
        feedIntakeKg: Number(r.feed_intake_kg || 0),
        mortality: Number(r.mortality || 0),
        cull: Number(r.cull || 0),
        populationAdded: Number(r.population_added || 0),
        populationDecreased: Number(r.population_decreased || 0),
        populationShipped: Number(r.population_shipped || 0),
        eggCount: Number(r.egg_count || 0),
        eggWeightKg: Number(r.egg_weight_kg || 0),
        healthNote: String(r.health_note || ''),
        photoUrl: String(r.photo_url || ''),
        createdAt: String(r.created_at || '')
      };
    });
  },

  // 6. Simpan / Update Penimbangan Harian
  async upsertWeighing(weighing) {
    const ageDays = Number(weighing.ageDays != null ? weighing.ageDays : (weighing.day != null ? weighing.day : Number(weighing.week || 1) * 7));
    const week = Number(weighing.week || Math.max(1, Math.ceil(ageDays / 7)));
    const id = weighing.id || `w-${weighing.flockId}-d${ageDays}-${weighing.date || 'rec'}`;
    const record = {
      id,
      flock_id: weighing.flockId,
      week: week,
      date: weighing.date,
      age_days: ageDays,
      avg_weight: Number(weighing.avgWeight || 0),
      target_weight: Number(weighing.targetWeight || weighing.avgWeight || 0),
      sample_count: Number(weighing.sampleCount || 0),
      samples_json: weighing.samples || [],
      uniformity: Number(weighing.uniformity || 0),
      feed_intake_kg: Number(weighing.feedIntakeKg || 0),
      mortality: Number(weighing.mortality || 0),
      cull: Number(weighing.cull || 0),
      population_added: Number(weighing.populationAdded || 0),
      population_decreased: Number(weighing.populationDecreased || 0),
      populationShipped: Number(weighing.populationShipped || 0),
      egg_count: Number(weighing.eggCount || 0),
      egg_weight_kg: Number(weighing.eggWeightKg || 0),
      health_note: weighing.healthNote || '',
      photo_url: weighing.photoUrl || ''
    };
    const result = await callScript('upsertWeighing', { weighing: record });
    return result.id || id;
  },

  // 7. Hapus Penimbangan
  async deleteWeighing(flockId, key) {
    const result = await callScript('deleteWeighing', {
      flockId: String(flockId),
      key: String(key),
      week: Number(key) || 0
    });
    return result.success;
  },

  // 8. Unggah Foto Dokumentasi ke Google Drive via Apps Script
  async uploadDocumentationPhoto(fileBuffer, originalName, mimeType) {
    const result = await callScript('uploadPhoto', {
      fileBase64: fileBuffer.toString('base64'),
      fileName: originalName,
      mimeType: mimeType || 'image/jpeg'
    });
    return result.url;
  }
};

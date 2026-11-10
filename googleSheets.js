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

  // 1. Ambil Semua Flok / Kandang (Sudah memuat seluruh penimbangan dalam 1 roundtrip cepat)
  async getAllFlocks() {
    const result = await callScript('getAllFlocks');
    const flocks = result.data || [];
    return flocks.map(f => {
      const fid = String(f.id || f.flock_id || f['ID Kandang'] || f['id kandang'] || f.code || '');
      const rawWeighings = f.weighings || [];
      const weighings = rawWeighings.map(r => {
        let rawSamples = r.samples_json != null ? r.samples_json : r['Data Sampel (JSON)'];
        let parsedSamples = [];
        if (Array.isArray(rawSamples)) {
          parsedSamples = rawSamples;
        } else if (typeof rawSamples === 'string' && rawSamples) {
          try {
            parsedSamples = JSON.parse(rawSamples);
          } catch (e) {
            parsedSamples = [];
          }
        }
        const ageDays = Number(r.age_days != null && r.age_days !== '' ? r.age_days : (r['Hari Ke- (Umur)'] != null && r['Hari Ke- (Umur)'] !== '' ? r['Hari Ke- (Umur)'] : (Number(r.week || r['Minggu Ke-'] || 0) * 7)));
        const week = Number(r.week != null && r.week !== '' ? r.week : (r['Minggu Ke-'] != null && r['Minggu Ke-'] !== '' ? r['Minggu Ke-'] : Math.max(1, Math.ceil(ageDays / 7))));
        return {
          id: String(r.id || r['ID Catatan'] || ''),
          flockId: String(r.flock_id || r['ID Kandang'] || fid),
          week: week,
          day: ageDays,
          date: String(r.date || r['Tanggal Catat'] || ''),
          ageDays: ageDays,
          avgWeight: Number(r.avg_weight != null ? r.avg_weight : (r['Bobot Rata-rata (gram)'] || 0)),
          targetWeight: Number(r.target_weight != null ? r.target_weight : (r['Target Bobot (gram)'] || 0)),
          sampleCount: Number(r.sample_count != null ? r.sample_count : (r['Jumlah Sampel (ekor)'] || 0)),
          samples: parsedSamples,
          uniformity: Number(r.uniformity != null ? r.uniformity : (r['Keseragaman (%)'] || 0)),
          feedIntakeKg: Number(r.feed_intake_kg != null ? r.feed_intake_kg : (r['Pakan Harian (kg)'] || 0)),
          mortality: Number(r.mortality != null ? r.mortality : (r['Kematian (ekor)'] || 0)),
          cull: Number(r.cull != null ? r.cull : (r['Afkir (ekor)'] || 0)),
          populationAdded: Number(r.population_added != null ? r.population_added : (r['Ayam Masuk (ekor)'] || 0)),
          populationDecreased: Number(r.population_decreased != null ? r.population_decreased : (r['Ayam Berkurang (ekor)'] || 0)),
          populationShipped: Number(r.population_shipped != null ? r.population_shipped : (r['Ayam Dipanen/Keluar (ekor)'] || 0)),
          eggCount: Number(r.egg_count != null ? r.egg_count : (r['Produksi Telur (butir)'] || 0)),
          eggWeightKg: Number(r.egg_weight_kg != null ? r.egg_weight_kg : (r['Bobot Telur (kg)'] || 0)),
          healthNote: String(r.health_note != null ? r.health_note : (r['Catatan Kesehatan'] || '')),
          photoUrl: String(r.photo_url != null ? r.photo_url : (r['Foto Dokumentasi'] || '')),
          createdAt: String(r.created_at != null ? r.created_at : (r['Waktu Input'] || ''))
        };
      });

      return {
        id: fid,
        name: f.name || f['Nama Kandang'] || '',
        code: f.code || f['Kode Batch'] || '',
        breed: f.breed || f['Jenis/Galur Ayam'] || 'kub',
        production_type: f.production_type || f['Tipe Pemeliharaan'] || (f.breed === 'layer' ? 'layer' : 'broiler'),
        doc_date: f.doc_date || f['Tanggal DOC Masuk'] || '',
        initial_pop: Number(f.initial_pop != null ? f.initial_pop : (f['Populasi Awal (ekor)'] != null ? f['Populasi Awal (ekor)'] : 0)),
        current_pop: Number(f.current_pop != null ? f.current_pop : (f['Populasi Saat Ini (ekor)'] != null ? f['Populasi Saat Ini (ekor)'] : (f.initial_pop || 0))),
        cage_type: f.cage_type || f['Tipe Kandang'] || '',
        location: f.location || f['Lokasi Kandang'] || '',
        officer: f.officer || f['Petugas/PIC'] || '',
        notes: f.notes || f['Catatan Kandang'] || '',
        created_at: f.created_at || f['Waktu Dibuat'] || new Date().toISOString(),
        weighingsCount: weighings.length,
        weighings: weighings
      };
    });
  },

  // 2. Ambil Flok Berdasarkan ID
  async getFlockById(id) {
    const result = await callScript('getFlockById', { id: String(id) });
    const f = result.data;
    if (!f) return null;
    const fid = String(f.id || f.flock_id || f['ID Kandang'] || f['id kandang'] || f.code || id);
    return {
      id: fid,
      name: f.name || f['Nama Kandang'] || '',
      code: f.code || f['Kode Batch'] || '',
      breed: f.breed || f['Jenis/Galur Ayam'] || 'kub',
      production_type: f.production_type || f['Tipe Pemeliharaan'] || (f.breed === 'layer' ? 'layer' : 'broiler'),
      doc_date: f.doc_date || f['Tanggal DOC Masuk'] || '',
      initial_pop: Number(f.initial_pop != null ? f.initial_pop : (f['Populasi Awal (ekor)'] != null ? f['Populasi Awal (ekor)'] : 0)),
      current_pop: Number(f.current_pop != null ? f.current_pop : (f['Populasi Saat Ini (ekor)'] != null ? f['Populasi Saat Ini (ekor)'] : (f.initial_pop || 0))),
      cage_type: f.cage_type || f['Tipe Kandang'] || '',
      location: f.location || f['Lokasi Kandang'] || '',
      officer: f.officer || f['Petugas/PIC'] || '',
      notes: f.notes || f['Catatan Kandang'] || '',
      created_at: f.created_at || f['Waktu Dibuat'] || ''
    };
  },

  // 3. Tambah Flok Baru
  async createFlock(flock) {
    const flockId = flock.id || `flock-${Date.now()}`;
    const record = {
      id: flockId,
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
    const created = result.data || record;
    return {
      id: String(created.id || flockId),
      name: created.name || record.name,
      code: created.code || record.code,
      breed: created.breed || record.breed,
      production_type: created.production_type || record.production_type,
      doc_date: created.doc_date || record.doc_date,
      initial_pop: Number(created.initial_pop != null ? created.initial_pop : record.initial_pop),
      current_pop: Number(created.current_pop != null ? created.current_pop : record.current_pop),
      cage_type: created.cage_type || record.cage_type,
      location: created.location || record.location,
      officer: created.officer || record.officer,
      notes: created.notes || record.notes,
      created_at: created.created_at || new Date().toISOString()
    };
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
      let rawSamples = r.samples_json != null ? r.samples_json : r['Data Sampel (JSON)'];
      let parsedSamples = [];
      if (Array.isArray(rawSamples)) {
        parsedSamples = rawSamples;
      } else if (typeof rawSamples === 'string' && rawSamples) {
        try {
          parsedSamples = JSON.parse(rawSamples);
        } catch (e) {
          parsedSamples = [];
        }
      }

      const ageDays = Number(r.age_days != null && r.age_days !== '' ? r.age_days : (r['Hari Ke- (Umur)'] != null && r['Hari Ke- (Umur)'] !== '' ? r['Hari Ke- (Umur)'] : (Number(r.week || r['Minggu Ke-'] || 0) * 7)));
      const week = Number(r.week != null && r.week !== '' ? r.week : (r['Minggu Ke-'] != null && r['Minggu Ke-'] !== '' ? r['Minggu Ke-'] : Math.max(1, Math.ceil(ageDays / 7))));

      return {
        id: String(r.id || r['ID Catatan'] || ''),
        flockId: String(r.flock_id || r['ID Kandang'] || flockId),
        week: week,
        day: ageDays,
        date: String(r.date || r['Tanggal Catat'] || ''),
        ageDays: ageDays,
        avgWeight: Number(r.avg_weight != null ? r.avg_weight : (r['Bobot Rata-rata (gram)'] || 0)),
        targetWeight: Number(r.target_weight != null ? r.target_weight : (r['Target Bobot (gram)'] || 0)),
        sampleCount: Number(r.sample_count != null ? r.sample_count : (r['Jumlah Sampel (ekor)'] || 0)),
        samples: parsedSamples,
        uniformity: Number(r.uniformity != null ? r.uniformity : (r['Keseragaman (%)'] || 0)),
        feedIntakeKg: Number(r.feed_intake_kg != null ? r.feed_intake_kg : (r['Pakan Harian (kg)'] || 0)),
        mortality: Number(r.mortality != null ? r.mortality : (r['Kematian (ekor)'] || 0)),
        cull: Number(r.cull != null ? r.cull : (r['Afkir (ekor)'] || 0)),
        populationAdded: Number(r.population_added != null ? r.population_added : (r['Ayam Masuk (ekor)'] || 0)),
        populationDecreased: Number(r.population_decreased != null ? r.population_decreased : (r['Ayam Berkurang (ekor)'] || 0)),
        populationShipped: Number(r.population_shipped != null ? r.population_shipped : (r['Ayam Dipanen/Keluar (ekor)'] || 0)),
        eggCount: Number(r.egg_count != null ? r.egg_count : (r['Produksi Telur (butir)'] || 0)),
        eggWeightKg: Number(r.egg_weight_kg != null ? r.egg_weight_kg : (r['Bobot Telur (kg)'] || 0)),
        healthNote: String(r.health_note != null ? r.health_note : (r['Catatan Kesehatan'] || '')),
        photoUrl: String(r.photo_url != null ? r.photo_url : (r['Foto Dokumentasi'] || '')),
        createdAt: String(r.created_at != null ? r.created_at : (r['Waktu Input'] || ''))
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
      production_type: weighing.productionType || weighing.production_type || '',
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
  },

  // 9. Migrasi / Perbarui Header Kolom Spreadsheet ke Bahasa Indonesia
  async migrateHeaders() {
    const result = await callScript('migrateHeaders');
    return result;
  },

  // 10. Pisahkan Sheet Pedaging dan Petelur
  async separateSheets() {
    const result = await callScript('separateSheets');
    return result;
  },

  // 11. Diagnosis Struktur Seluruh Sheet
  async diagnose() {
    const result = await callScript('diagnose');
    return result;
  }
};

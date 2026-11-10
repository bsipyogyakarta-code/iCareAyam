/**
 * BRMP DIY Poultry Tracker - Supabase Cloud Database & Storage Client
 * Mengelola PostgreSQL terpusat dan penyimpanan foto S3 Cloud di Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const isConfigured = !!(supabaseUrl && supabaseKey);

let supabase = null;
if (isConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  console.log('☁️ Terhubung ke Supabase Cloud Database:', supabaseUrl);
} else {
  console.warn('⚠️ Supabase URL / KEY belum disetel di environment.');
}

module.exports = {
  isConfigured,
  supabase,

  // 1. Ambil Semua Flok / Kandang
  async getAllFlocks() {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await supabase
      .from('flocks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(f => ({
      id: f.id,
      name: f.name,
      code: f.code,
      breed: f.breed,
      production_type: f.production_type || (f.breed === 'layer' ? 'layer' : 'broiler'),
      doc_date: f.doc_date,
      initial_pop: f.initial_pop,
      current_pop: f.current_pop,
      cage_type: f.cage_type,
      location: f.location,
      officer: f.officer,
      notes: f.notes,
      created_at: f.created_at
    }));
  },

  // 2. Ambil Flok Berdasarkan ID
  async getFlockById(id) {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await supabase
      .from('flocks')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  // 3. Tambah Flok Baru
  async createFlock(flock) {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
    const record = {
      id: flock.id,
      name: flock.name,
      code: flock.code,
      breed: flock.breed,
      production_type: flock.productionType || 'broiler',
      doc_date: flock.docDate,
      initial_pop: Number(flock.initialPop),
      current_pop: Number(flock.initialPop),
      cage_type: flock.cageType || '',
      location: flock.location || '',
      officer: flock.officer || '',
      notes: flock.notes || ''
    };

    const { data, error } = await supabase
      .from('flocks')
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 4. Hapus Flok
  async deleteFlock(id) {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
    // Weighings akan terhapus otomatis via CASCADE di Postgres
    const { error } = await supabase
      .from('flocks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // 5. Ambil Daftar Penimbangan per Flok
  async getWeighingsByFlock(flockId) {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await supabase
      .from('weighings')
      .select('*')
      .eq('flock_id', flockId)
      .order('week', { ascending: true });

    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      flockId: r.flock_id,
      week: r.week,
      date: r.date,
      ageDays: r.age_days,
      avgWeight: Number(r.avg_weight),
      targetWeight: Number(r.target_weight),
      sampleCount: r.sample_count,
      samples: Array.isArray(r.samples_json) ? r.samples_json : JSON.parse(r.samples_json || '[]'),
      uniformity: Number(r.uniformity),
      feedIntakeKg: Number(r.feed_intake_kg),
      mortality: r.mortality,
      cull: r.cull,
      populationAdded: Number(r.population_added || 0),
      populationDecreased: Number(r.population_decreased || 0),
      populationShipped: Number(r.population_shipped || 0),
      eggCount: Number(r.egg_count || 0),
      eggWeightKg: Number(r.egg_weight_kg || 0),
      healthNote: r.health_note,
      photoUrl: r.photo_url,
      createdAt: r.created_at
    }));
  },

  // 6. Simpan / Update Penimbangan Harian (Upsert)
  async upsertWeighing(weighing) {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
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
      population_shipped: Number(weighing.populationShipped || 0),
      egg_count: Number(weighing.eggCount || 0),
      egg_weight_kg: Number(weighing.eggWeightKg || 0),
      health_note: weighing.healthNote || ''
    };

    if (weighing.photoUrl) {
      record.photo_url = weighing.photoUrl;
    }

    const { error } = await supabase
      .from('weighings')
      .upsert(record, { onConflict: 'id' });

    if (error) throw error;

    // Update populasi terkini
    await this.recalculateCurrentPop(weighing.flockId);
    return id;
  },

  // 7. Hitung Ulang Populasi Terkini
  async recalculateCurrentPop(flockId) {
    if (!isConfigured) return;
    const flock = await this.getFlockById(flockId);
    if (!flock) return;

    const { data: weighings, error } = await supabase
      .from('weighings')
      .select('mortality, cull, population_added, population_decreased, population_shipped')
      .eq('flock_id', flockId);
    if (error) throw error;

    const population = (weighings || []).reduce((total, w) => total
      + (Number(w.population_added) || 0) - (Number(w.population_decreased) || 0)
      - (Number(w.population_shipped) || 0) - (Number(w.mortality) || 0) - (Number(w.cull) || 0),
    Number(flock.initial_pop) || 0);

    const currentPop = Math.max(0, population);
    const { error: updateError } = await supabase
      .from('flocks')
      .update({ current_pop: currentPop })
      .eq('id', flockId);
    if (updateError) throw updateError;
  },

  // 8. Hapus Penimbangan
  async deleteWeighing(flockId, key) {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
    const isNum = !isNaN(Number(key));
    let query = supabase.from('weighings').delete().eq('flock_id', flockId);
    if (isNum) {
      query = query.or(`age_days.eq.${Number(key)},week.eq.${Number(key)},id.eq.${key}`);
    } else {
      query = query.or(`id.eq.${key},date.eq.${key}`);
    }
    const { error } = await query;
    if (error) throw error;
    await this.recalculateCurrentPop(flockId);
    return true;
  },

  // 9. Unggah Foto Dokumentasi ke Supabase Cloud Storage
  async uploadDocumentationPhoto(fileBuffer, originalName, mimeType) {
    if (!isConfigured) throw new Error('Supabase belum dikonfigurasi');
    const ext = originalName.split('.').pop().toLowerCase();
    const filePath = `doc-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('poultry-docs')
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) throw error;

    // Dapatkan URL publik permanen
    const { data: urlData } = supabase.storage
      .from('poultry-docs')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }
};

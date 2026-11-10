/**
 * BRMP DIY - API Client & Data Manager
 * Terhubung langsung ke Backend Express + SQLite
 * Bersih tanpa data dummy hardcoded
 */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.activeFlockId = localStorage.getItem('BRMP_ACTIVE_FLOCK_ID') || null;
  }

  getActiveFlockId() {
    return this.activeFlockId;
  }

  setActiveFlockId(id) {
    this.activeFlockId = id;
    if (id) {
      localStorage.setItem('BRMP_ACTIVE_FLOCK_ID', id);
    } else {
      localStorage.removeItem('BRMP_ACTIVE_FLOCK_ID');
    }
  }

  // Simpan salinan lokal agar aman dari Vercel cold restart
  saveLocalMirror(flocks) {
    try {
      localStorage.setItem('BRMP_LOCAL_MIRROR', JSON.stringify(flocks));
    } catch (e) {}
  }

  getLocalMirror() {
    try {
      const raw = localStorage.getItem('BRMP_LOCAL_MIRROR');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async getFlocks() {
    try {
      const res = await fetch(`${API_BASE}/flocks`);
      const json = await res.json();
      if (json.success) {
        // Jika backend kosong tetapi browser punya data lokal (akibat Vercel restart), pulihkan otomatis
        if (json.data.length === 0) {
          const mirror = this.getLocalMirror();
          if (mirror && mirror.length > 0) {
            console.log('🔄 Memulihkan data dari sinkronisasi lokal ke Vercel backend...');
            for (const f of mirror) {
              await this.createFlock(f);
              if (f.weighings && f.weighings.length > 0) {
                for (const w of f.weighings) {
                  const fd = new FormData();
                  fd.append('day', w.day || w.ageDays || w.week * 7);
                  fd.append('week', w.week || Math.max(1, Math.ceil((w.day || w.ageDays || 7) / 7)));
                  fd.append('date', w.date);
                  fd.append('ageDays', w.ageDays || w.day || w.week * 7);
                  fd.append('avgWeight', w.avgWeight);
                  fd.append('targetWeight', w.targetWeight);
                  fd.append('sampleCount', w.sampleCount || 30);
                  fd.append('samples', JSON.stringify(w.samples || []));
                  fd.append('uniformity', w.uniformity || 90);
                  fd.append('feedIntakeKg', w.feedIntakeKg || 0);
                  fd.append('mortality', w.mortality || 0);
                  fd.append('cull', w.cull || 0);
                  fd.append('populationAdded', w.populationAdded || 0);
                  fd.append('populationDecreased', w.populationDecreased || 0);
                  fd.append('populationShipped', w.populationShipped || 0);
                  fd.append('eggCount', w.eggCount || 0);
                  fd.append('eggWeightKg', w.eggWeightKg || 0);
                  fd.append('healthNote', w.healthNote || '');
                  await this.saveWeighing(f.id, fd);
                }
              }
            }
            const syncedRes = await fetch(`${API_BASE}/flocks`);
            const syncedJson = await syncedRes.json();
            return syncedJson.data;
          }
        }

        if (json.data.length > 0) {
          this.saveLocalMirror(json.data);
        }
        return json.data;
      }
      throw new Error(json.error || 'Gagal memuat data kandang/flok');
    } catch (err) {
      console.error('API Error getFlocks, menggunakan fallback lokal:', err);
      const mirror = this.getLocalMirror();
      if (mirror) return mirror;
      throw err;
    }
  }

  async getFlock(id) {
    try {
      const res = await fetch(`${API_BASE}/flocks/${id}`);
      const json = await res.json();
      if (json.success) {
        return json.data;
      }
      throw new Error(json.error || 'Flok tidak ditemukan');
    } catch (err) {
      console.error('API Error getFlock:', err);
      throw err;
    }
  }

  async createFlock(flockData) {
    try {
      const res = await fetch(`${API_BASE}/flocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flockData)
      });
      const json = await res.json();
      if (json.success) {
        return json.data;
      }
      throw new Error(json.error || 'Gagal membuat flok baru');
    } catch (err) {
      console.error('API Error createFlock:', err);
      throw err;
    }
  }

  async deleteFlock(flockId) {
    try {
      const res = await fetch(`${API_BASE}/flocks/${flockId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        if (this.activeFlockId === flockId) {
          this.setActiveFlockId(null);
        }
        return true;
      }
      throw new Error(json.error || 'Gagal menghapus flok');
    } catch (err) {
      console.error('API Error deleteFlock:', err);
      throw err;
    }
  }

  // Simpan atau update penimbangan mingguan (bisa menyertakan berkas foto dokumentasi)
  async saveWeighing(flockId, formData) {
    try {
      const res = await fetch(`${API_BASE}/flocks/${flockId}/weighings`, {
        method: 'POST',
        body: formData // Mengirim multipart/form-data langsung dari formulir
      });
      const json = await res.json();
      if (json.success) {
        return json.data;
      }
      throw new Error(json.error || 'Gagal menyimpan data penimbangan');
    } catch (err) {
      console.error('API Error saveWeighing:', err);
      throw err;
    }
  }

  async deleteWeighing(flockId, week) {
    try {
      const res = await fetch(`${API_BASE}/flocks/${flockId}/weighings/${week}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        return true;
      }
      throw new Error(json.error || 'Gagal menghapus data penimbangan');
    } catch (err) {
      console.error('API Error deleteWeighing:', err);
      throw err;
    }
  }
}

window.apiClient = new ApiClient();

/**
 * BRMP DIY - Poultry Growth Tracker Master Controller
 * Dynamic, Backend-Connected (Express + SQLite), Photo Documentation
 */

let allFlocks = [];
let currentActiveFlock = null;
let currentStandard = null;
let currentEditingRecordId = null;
let activeProductionType = localStorage.getItem('BRMP_ACTIVE_PRODUCTION_TYPE') || 'broiler';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  loadDataFromBackend();
});

function initTheme() {
  const savedTheme = localStorage.getItem('BRMP_THEME') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('BRMP_THEME', newTheme);
  updateThemeIcon(newTheme);

  if (activeProductionType === 'broiler' && currentActiveFlock && currentStandard) {
    window.renderGrowthChart(currentActiveFlock, currentStandard);
    window.renderGainChart(currentActiveFlock);
    const latest = getLatestWeighing(currentActiveFlock);
    window.renderDistributionChart(latest);
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

// Toast Notification
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}" style="color:${type === 'success' ? 'var(--primary-600)' : 'var(--rose-500)'};"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Periksa status koneksi database (Cloud Supabase vs Lokal)
async function checkCloudStatus() {
  const badge = document.getElementById('cloudStatusBadge');
  if (!badge) return;
  try {
    const res = await fetch('/api/status');
    const json = await res.json();
    if (json.cloud) {
      badge.innerHTML = '<i class="fa-solid fa-cloud" style="color:var(--primary-600); margin-right: 0.25rem;"></i> Data tersimpan';
      badge.style.background = 'var(--primary-100)';
      badge.style.color = 'var(--primary-700)';
      badge.title = 'Catatan Anda tersimpan.';
    } else {
      badge.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 0.25rem;"></i> Data tersimpan';
      badge.title = 'Catatan Anda tersimpan di komputer ini.';
    }
  } catch (e) {
    badge.textContent = 'Data tersimpan';
  }
}

// Load data dynamically from backend
async function loadDataFromBackend() {
  try {
    checkCloudStatus();
    updateCategoryIntro();
    allFlocks = await window.apiClient.getFlocks();

    if (allFlocks.length === 0) {
      renderFlockDropdown();
      showEmptyFlockState();
      return;
    }

    hideEmptyFlockState();

    const savedActiveId = window.apiClient.getActiveFlockId();
    const savedActive = allFlocks.find(f => f.id === savedActiveId);
    if (savedActive) activeProductionType = getProductionType(savedActive);
    const active = savedActive || allFlocks.find(f => getProductionType(f) === activeProductionType) || allFlocks[0];
    activeProductionType = getProductionType(active);
    renderFlockDropdown();
    window.apiClient.setActiveFlockId(active.id);
    setActiveFlock(active);
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Koneksi ke backend gagal. Pastikan server aktif.', 'error');
  }
}

function renderFlockDropdown() {
  const select = document.getElementById('flockSelect');
  if (!select) return;

  const activeId = window.apiClient.getActiveFlockId();
  const flocks = allFlocks.filter(f => getProductionType(f) === activeProductionType);
  if (flocks.length === 0) {
    select.innerHTML = '<option value="">Belum ada kandang di kategori ini</option>';
    return;
  }

  select.innerHTML = flocks.map(f => `
    <option value="${f.id}" ${f.id === activeId ? 'selected' : ''}>
      ${f.name} (${f.code})
    </option>
  `).join('');
}

function getProductionType(flock) {
  return flock?.productionType || (flock?.breed === 'layer' ? 'layer' : 'broiler');
}

function setProductionType(type) {
  activeProductionType = type === 'layer' ? 'layer' : 'broiler';
  localStorage.setItem('BRMP_ACTIVE_PRODUCTION_TYPE', activeProductionType);
  document.querySelectorAll('.production-switch-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.productionType === activeProductionType);
  });
  updateCategoryIntro();
  renderFlockDropdown();
  const flock = allFlocks.find(item => getProductionType(item) === activeProductionType);
  if (flock) {
    window.apiClient.setActiveFlockId(flock.id);
    setActiveFlock(flock);
  } else {
    window.apiClient.setActiveFlockId(null);
    currentActiveFlock = null;
    showEmptyFlockState();
  }
}

function showEmptyFlockState() {
  currentActiveFlock = null;
  document.getElementById('btnViewStandards').style.display = activeProductionType === 'broiler' ? 'inline-flex' : 'none';
  document.getElementById('emptyStateTitle').textContent = activeProductionType === 'layer'
    ? 'Monitoring Ayam Petelur'
    : 'Monitoring Ayam Pedaging';
  document.getElementById('emptyFlockHero').style.display = 'flex';
  document.getElementById('mainDashboardContent').style.display = 'none';
  document.getElementById('flockControlSection').style.display = 'none';
}

function hideEmptyFlockState() {
  document.getElementById('emptyFlockHero').style.display = 'none';
  document.getElementById('mainDashboardContent').style.display = 'flex';
  document.getElementById('flockControlSection').style.display = 'flex';
}

function setActiveFlock(flock) {
  currentActiveFlock = flock;
  hideEmptyFlockState();
  activeProductionType = getProductionType(flock);
  localStorage.setItem('BRMP_ACTIVE_PRODUCTION_TYPE', activeProductionType);
  document.querySelectorAll('.production-switch-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.productionType === activeProductionType);
  });
  const breedKey = flock.breed || 'kub';
  currentStandard = window.POULTRY_STANDARDS[breedKey] || window.POULTRY_STANDARDS.kub;

  renderFlockMeta();
  renderKPIs();

  const isBroiler = activeProductionType === 'broiler';
  updateCategoryIntro();
  document.getElementById('btnViewStandards').style.display = isBroiler ? 'inline-flex' : 'none';
  document.getElementById('broilerAnalytics').closest('details').style.display = isBroiler ? 'block' : 'none';
  document.getElementById('broilerAnalytics').style.display = isBroiler ? 'block' : 'none';
  if (isBroiler) {
    window.renderGrowthChart(currentActiveFlock, currentStandard);
    window.renderGainChart(currentActiveFlock);
    window.renderDistributionChart(getLatestWeighing(currentActiveFlock));
    renderGrowthInsights(getLatestWeighing(currentActiveFlock));
  }
  renderWeighingsTable();
}

function updateCategoryIntro() {
  const isLayer = activeProductionType === 'layer';
  document.getElementById('categoryStep').textContent = 'Jenis pemeliharaan';
  document.getElementById('categoryTitle').textContent = isLayer ? 'Ayam Petelur' : 'Ayam Pedaging';
  document.getElementById('categoryHelp').textContent = isLayer
    ? 'Catat jumlah telur, berat telur, dan pakan setiap hari.'
    : 'Catat pakan, jumlah ayam, dan bobot setiap hari.';
  document.querySelector('#btnCategoryAdd span').textContent = isLayer
    ? 'Catat Telur Harian'
    : 'Catat Hari Ini';
  document.getElementById('btnCategoryAdd').setAttribute('aria-label', isLayer
    ? 'Catat hasil produksi telur hari ini'
    : 'Catat data ayam pedaging hari ini');
  document.getElementById('emptyStateTitle').textContent = isLayer
    ? 'Belum ada kandang ayam petelur'
    : 'Belum ada kandang ayam pedaging';
}

function renderFlockMeta() {
  const f = currentActiveFlock;
  if (!f) return;

  document.getElementById('metaBreed').textContent = activeProductionType === 'layer'
    ? 'Ayam petelur'
    : (currentStandard ? currentStandard.name : f.breed);
  document.getElementById('metaDocDate').textContent = formatDateIndo(f.docDate);
  document.getElementById('metaInitialPop').textContent = `${f.initialPop || 0} ekor`;
  document.getElementById('metaCurrentPop').textContent = `${f.currentPop != null ? f.currentPop : f.initialPop} ekor`;
  
  const initial = Number(f.initialPop) || 1;
  const current = Number(f.currentPop != null ? f.currentPop : initial);
  const survivalRate = ((current / initial) * 100).toFixed(1);
  const metaSurvival = document.getElementById('metaSurvivalRate');
  if (metaSurvival) {
    metaSurvival.textContent = `${survivalRate}%`;
  }
}

function getLatestWeighing(flock) {
  if (!flock || !flock.weighings || flock.weighings.length === 0) return null;
  return flock.weighings[flock.weighings.length - 1];
}

function getPreviousWeighing(flock) {
  if (!flock || !flock.weighings || flock.weighings.length < 2) return null;
  return flock.weighings[flock.weighings.length - 2];
}

function renderKPIs() {
  const latest = getLatestWeighing(currentActiveFlock);
  const records = currentActiveFlock?.weighings || [];
  const population = Number(currentActiveFlock?.currentPop ?? currentActiveFlock?.initialPop) || 0;
  const totalFeed = records.reduce((sum, record) => sum + (Number(record.feedIntakeKg) || 0), 0);
  const setKpi = (index, title, value, unit, sub) => {
    document.getElementById(`kpi${index}Title`).textContent = title;
    document.getElementById(`kpi${index}Value`).textContent = value;
    document.getElementById(`kpi${index}Unit`).textContent = unit;
    document.getElementById(`kpi${index}Sub`).textContent = sub;
  };
  const formatNumber = value => Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  document.getElementById('kpi4Value').style.fontSize = activeProductionType === 'broiler' ? '0.95rem' : '';
  document.getElementById('kpi4Value').style.fontSize = activeProductionType === 'broiler' ? '1.05rem' : '';

  setKpi(1, 'Jumlah ayam sekarang', formatNumber(population), 'ekor', 'Di kandang yang dipilih');
  if (activeProductionType === 'layer') {
    const latestDay = latest ? Number(latest.day != null ? latest.day : (latest.ageDays || Number(latest.week || 0) * 7)) : 0;
    setKpi(2, 'Jumlah telur hari ini', latest ? formatNumber(latest.eggCount) : '-', 'butir',
      latest ? `${formatDateIndo(latest.date)} (Hari ${latestDay})` : 'Belum ada catatan produksi telur');
    setKpi(3, 'Berat telur hari ini', latest ? formatNumber(latest.eggWeightKg) : '0', 'kg',
      latest ? `${formatDateIndo(latest.date)} (Hari ${latestDay})` : 'Belum ada catatan bobot telur');
    setKpi(4, 'Pakan hari ini', latest ? formatNumber(latest.feedIntakeKg) : '0', 'kg',
      latest ? `Total pakan: ${formatNumber(totalFeed)} kg` : 'Belum ada catatan pemberian pakan');
    return;
  }

  const latestDay = latest ? Number(latest.day != null ? latest.day : (latest.ageDays || Number(latest.week || 0) * 7)) : 0;
  setKpi(2, 'Rata-rata bobot terakhir', latest ? formatNumber(latest.avgWeight) : '-', 'gram/ekor',
    latest ? `${formatDateIndo(latest.date)} (Hari ke-${latestDay})` : 'Belum ada catatan bobot harian');
  setKpi(3, 'Pakan harian terakhir', latest ? formatNumber(latest.feedIntakeKg) : '0', 'kg',
    latest ? `Total pakan: ${formatNumber(totalFeed)} kg` : 'Belum ada catatan pemberian pakan');
  const mutations = records.reduce((totals, record) => ({
    added: totals.added + (Number(record.populationAdded) || 0),
    decreased: totals.decreased + (Number(record.populationDecreased) || 0)
      + (Number(record.mortality) || 0) + (Number(record.cull) || 0)
  }), { added: 0, decreased: 0 });
  setKpi(4, 'Perubahan jumlah ayam', 
    `Tambah ${formatNumber(mutations.added)} • Kurang ${formatNumber(mutations.decreased)}`,
    '', 'Total akumulasi perubahan');
}

function renderGrowthInsights(latest) {
  const container = document.getElementById('growthInsightCard');
  if (!container) return;

  if (!latest) {
    container.innerHTML = `
      <div class="insight-icon">🌱</div>
      <div class="insight-content">
        <h3>Memulai Siklus Pencatatan Harian Ayam</h3>
        <p>Kandang ini belum memiliki catatan monitoring harian. Klik tombol <strong>+ Catat Hari Ini</strong> untuk mencatat bobot ayam dan data harian saat ini.</p>
      </div>
    `;
    return;
  }

  const dayNum = Number(latest.day != null ? latest.day : (latest.ageDays || Number(latest.week || 0) * 7));
  const weekApprox = Math.round(dayNum / 7);
  const std = currentStandard?.weeklyStandards?.find(s => Number(s.week) === weekApprox);
  const targetW = std ? std.standardWeight : latest.avgWeight;
  const diffPct = ((latest.avgWeight - targetW) / targetW) * 100;
  const uniformity = latest.uniformity || 90;

  let icon = '🌾';
  let title = 'Pertumbuhan Normal & Terkendali';
  let desc = '';

  if (diffPct >= 5) {
    icon = '🚀';
    title = `Perkembangan Sangat Bagus (+${diffPct.toFixed(1)}% di atas acuan standar)`;
    desc = `Ayam pada flok ini tumbuh melampaui kurva acuan standar. Pertahankan formulasi nutrisi dan pastikan ventilasi kandang tetap sejuk agar laju tumbuh tetap optimal.`;
  } else if (diffPct >= -4) {
    icon = '✅';
    title = `Pertumbuhan Sesuai Target Standar (${diffPct.toFixed(1)}%)`;
    desc = `Rata-rata bobot ayam berada dalam rentang ideal umur ${dayNum} hari. Lanjutkan pemantauan rutin untuk kontrol performa ayam.`;
  } else {
    icon = '⚠️';
    title = `Bobot Tertinggal (${diffPct.toFixed(1)}%) - Perlu Penanganan`;
    desc = `Bobot ayam berada di bawah acuan standar. Saran: (1) Pastikan kecukupan tempat pakan dan minum, (2) Lakukan grading jika perlu, (3) Berikan vitamin dan probiotik tambahan.`;
  }

  if (uniformity < 80) {
    desc += ` Keseragaman ukuran ayam (${uniformity.toFixed(1)}%) masih heterogen, dianjurkan pemisahan sekat grading.`;
  }

  container.innerHTML = `
    <div class="insight-icon">${icon}</div>
    <div class="insight-content">
      <h3>${title}</h3>
      <p>${desc}</p>
    </div>
  `;
}

function renderWeighingsTable() {
  const tbody = document.getElementById('weighingsTableBody');
  if (!tbody) return;

  const weighings = currentActiveFlock?.weighings || [];
  const isLayer = activeProductionType === 'layer';
  document.getElementById('monitoringTableTitle').textContent = isLayer
    ? 'Rekapitulasi Produksi Harian Telur'
    : 'Rekapitulasi Monitoring Harian Ayam Pedaging';
  document.getElementById('monitoringTableHead').innerHTML = `<tr>${
    (isLayer
      ? ['Hari ke-', 'Tanggal', 'Populasi', 'Jumlah Telur', 'Bobot Telur', 'Pakan Harian', 'Mutasi', 'Dokumentasi', 'Aksi']
      : ['Hari ke-', 'Tanggal', 'Bobot Rata-rata', 'Pakan Harian', 'Bertambah', 'Berkurang', 'Dokumentasi', 'Aksi']
    ).map(title => `<th>${title}</th>`).join('')
  }</tr>`;
  if (weighings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isLayer ? 9 : 8}" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">
          Belum ada catatan harian. Klik <strong>+ Catat Hari Ini</strong> untuk menambahkan data.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = weighings.map((w, index) => {
    const dayNum = Number(w.day != null ? w.day : (w.ageDays != null ? w.ageDays : Number(w.week || 0) * 7));
    const photoCell = w.photoUrl ? `
      <button type="button" class="doc-thumbnail-btn" onclick="openPhotoViewer('${w.photoUrl}', 'Dokumentasi Hari ${dayNum}', '${w.healthNote || ''}', '${formatDateIndo(w.date)}', '${isLayer ? `Telur: ${w.eggCount || 0} butir / ${w.eggWeightKg || 0} kg` : `Bobot: ${w.avgWeight} g`}')" title="Lihat Foto Dokumentasi">
        <img src="${w.photoUrl}" alt="Foto hari ${dayNum}">
      </button>
    ` : `
      <span class="doc-placeholder-icon" title="Belum ada foto dokumentasi">
        <i class="fa-regular fa-image"></i>
      </span>
    `;
    const decreased = (Number(w.populationDecreased) || 0) + (Number(w.mortality) || 0) + (Number(w.cull) || 0);
    const movement = `+${Number(w.populationAdded) || 0} / -${decreased}`;
    const recordLabel = dayNum === 0 && !isLayer ? 'DOC (H0)' : `Hari ${dayNum}`;
    const dayPopulation = weighings.slice(0, index + 1).reduce((population, record) => population
      + (Number(record.populationAdded) || 0)
      - (Number(record.populationDecreased) || 0)
      - (Number(record.populationShipped) || 0)
      - (Number(record.mortality) || 0)
      - (Number(record.cull) || 0),
    Number(currentActiveFlock.initialPop) || 0);

    const recordIdentifier = w.id || dayNum;

    return `
      <tr>
        <td><strong>${recordLabel}</strong></td>
        <td>${formatDateIndo(w.date)}</td>
        ${isLayer ? `
          <td>${Math.max(0, dayPopulation).toLocaleString('id-ID')} ekor</td>
          <td>${Number(w.eggCount || 0).toLocaleString('id-ID')} butir</td>
          <td>${Number(w.eggWeightKg || 0).toLocaleString('id-ID')} kg</td>
          <td>${Number(w.feedIntakeKg || 0).toLocaleString('id-ID')} kg</td>
          <td>${movement}</td>
        ` : `
          <td><strong>${Number(w.avgWeight || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} g</strong></td>
          <td>${Number(w.feedIntakeKg || 0).toLocaleString('id-ID')} kg</td>
          <td>${Number(w.populationAdded || 0).toLocaleString('id-ID')}</td>
          <td>${decreased.toLocaleString('id-ID')}</td>
        `}
        <td style="text-align:center;">${photoCell}</td>
        <td>
          <div class="table-action-btns">
            <button class="btn btn-icon btn-sm" title="Edit data" onclick="openEditWeighingModal('${recordIdentifier}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-icon btn-sm" title="Hapus data" onclick="deleteWeighingData('${recordIdentifier}', ${dayNum})" style="color: var(--rose-500);">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Lightbox Photo Viewer
function openPhotoViewer(url, title, notes, date, weight) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightboxTitle').textContent = title;
  document.getElementById('lightboxDate').textContent = date;
  document.getElementById('lightboxWeight').textContent = weight;
  document.getElementById('lightboxNotes').textContent = notes ? `Catatan: ${notes}` : 'Tidak ada catatan tambahan.';
  document.getElementById('modalPhotoViewer').classList.add('active');
}

function setupEventListeners() {
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const flockSelect = document.getElementById('flockSelect');
  if (flockSelect) {
    flockSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (selectedId) {
        window.apiClient.setActiveFlockId(selectedId);
        const f = allFlocks.find(item => item.id === selectedId);
        if (f) setActiveFlock(f);
      }
    });
  }

  document.querySelectorAll('.production-switch-btn').forEach(button => {
    button.addEventListener('click', () => setProductionType(button.dataset.productionType));
  });

  // Buttons
  const btnAddWeighing = document.getElementById('btnAddWeighing');
  if (btnAddWeighing) btnAddWeighing.addEventListener('click', openAddWeighingModal);
  const btnCategoryAdd = document.getElementById('btnCategoryAdd');
  if (btnCategoryAdd) btnCategoryAdd.addEventListener('click', openAddWeighingModal);

  const btnNewFlock = document.getElementById('btnNewFlock');
  if (btnNewFlock) btnNewFlock.addEventListener('click', openNewFlockModal);

  const btnNewFlockHero = document.getElementById('btnNewFlockHero');
  if (btnNewFlockHero) btnNewFlockHero.addEventListener('click', openNewFlockModal);

  const btnDeleteFlock = document.getElementById('btnDeleteFlock');
  if (btnDeleteFlock) btnDeleteFlock.addEventListener('click', handleDeleteFlock);

  const btnStandards = document.getElementById('btnViewStandards');
  if (btnStandards) btnStandards.addEventListener('click', openStandardsModal);

  const btnExportCsv = document.getElementById('btnExportCsv');
  if (btnExportCsv) btnExportCsv.addEventListener('click', exportToCsv);

  const btnPrint = document.getElementById('btnPrintReport');
  if (btnPrint) btnPrint.addEventListener('click', () => window.print());

  // Modal Close, Backdrop, and Escape Key Handlers
  document.querySelectorAll('.modal-close-btn, .btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }
  });

  document.getElementById('broilerPhoto').addEventListener('change', validateMonitoringPhoto);
  document.getElementById('layerPhoto').addEventListener('change', validateMonitoringPhoto);
  document.getElementById('formBroilerMonitoring').addEventListener('submit', handleSaveBroiler);
  document.getElementById('formLayerProduction').addEventListener('submit', handleSaveLayer);

  ['broiler', 'layer'].forEach(prefix => {
    const dateInput = document.getElementById(`${prefix}Date`);
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        if (selectedDate && currentActiveFlock?.docDate && currentEditingRecordId == null) {
          const diff = Math.round((new Date(`${selectedDate}T00:00:00`) - new Date(`${currentActiveFlock.docDate}T00:00:00`)) / 86400000);
          if (diff >= 0) {
            document.getElementById(`${prefix}Day`).value = diff;
          }
        }
      });
    }
  });

  const formFlock = document.getElementById('formNewFlock');
  if (formFlock) formFlock.addEventListener('submit', handleSaveNewFlock);
}

function validateMonitoringPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Pilih berkas foto seperti JPG atau PNG.', 'error');
    event.target.value = '';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Ukuran foto maksimal 10 MB.', 'error');
    event.target.value = '';
  }
}

function getTodayInputDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function openAddWeighingModal() {
  if (!currentActiveFlock) {
    openNewFlockModal();
    return;
  }

  currentEditingRecordId = null;
  const records = currentActiveFlock.weighings || [];
  const isLayer = activeProductionType === 'layer';
  const form = document.getElementById(isLayer ? 'formLayerProduction' : 'formBroilerMonitoring');
  form.reset();

  const prefix = isLayer ? 'layer' : 'broiler';
  const todayStr = getTodayInputDate();
  document.getElementById(`${prefix}Date`).value = todayStr;

  // Hitung perkiraan hari ke- (umur hari) berdasarkan tanggal DOC
  let nextDay = 1;
  if (currentActiveFlock.docDate) {
    const diff = Math.round((new Date(`${todayStr}T00:00:00`) - new Date(`${currentActiveFlock.docDate}T00:00:00`)) / 86400000);
    if (diff >= 0) nextDay = diff;
  }
  if (records.length > 0) {
    const maxDay = Math.max(...records.map(r => Number(r.day != null ? r.day : (r.ageDays || Number(r.week || 0) * 7))));
    if (nextDay <= maxDay) {
      nextDay = maxDay + 1;
    }
  }

  document.getElementById(`${prefix}Day`).value = nextDay;
  document.getElementById(`${prefix}Day`).disabled = false;

  if (isLayer) {
    document.getElementById('layerFormTitle').textContent = 'Catat Produksi Harian Telur';
    document.getElementById('layerAdded').value = 0;
    document.getElementById('layerDecreased').value = 0;
  } else {
    const weekApprox = Math.round(nextDay / 7);
    const standard = currentStandard?.weeklyStandards?.find(item => Number(item.week) === weekApprox);
    document.getElementById('broilerWeight').value = standard?.standardWeight || '';
    document.getElementById('broilerFormTitle').textContent = 'Catat Harian Ayam Pedaging';
    document.getElementById('broilerAdded').value = 0;
    document.getElementById('broilerDecreased').value = 0;
  }

  document.getElementById(isLayer ? 'modalLayerProduction' : 'modalBroilerMonitoring').classList.add('active');
}

function openEditWeighingModal(identifier) {
  const record = (currentActiveFlock?.weighings || []).find(item =>
    String(item.id) === String(identifier) ||
    String(item.day) === String(identifier) ||
    String(item.ageDays) === String(identifier) ||
    String(item.week) === String(identifier)
  );
  if (!record) return;

  currentEditingRecordId = record.id || identifier;
  const isLayer = activeProductionType === 'layer';
  const prefix = isLayer ? 'layer' : 'broiler';
  const form = document.getElementById(isLayer ? 'formLayerProduction' : 'formBroilerMonitoring');
  form.reset();

  const dayNum = Number(record.day != null ? record.day : (record.ageDays != null ? record.ageDays : Number(record.week || 0) * 7));
  document.getElementById(`${prefix}Day`).value = dayNum;
  document.getElementById(`${prefix}Day`).disabled = true;
  document.getElementById(`${prefix}Date`).value = record.date;
  document.getElementById(`${prefix}Notes`).value = record.healthNote || '';

  if (isLayer) {
    document.getElementById('layerEggCount').value = record.eggCount || 0;
    document.getElementById('layerEggWeight').value = record.eggWeightKg || 0;
    document.getElementById('layerFeed').value = record.feedIntakeKg || 0;
    document.getElementById('layerAdded').value = record.populationAdded || 0;
    document.getElementById('layerDecreased').value = (record.populationDecreased || 0)
      + (record.mortality || 0) + (record.cull || 0);
    document.getElementById('layerFormTitle').textContent = `Ubah Catatan Hari ke-${dayNum}`;
    document.getElementById('modalLayerProduction').classList.add('active');
    return;
  }

  document.getElementById('broilerWeight').value = record.avgWeight || '';
  document.getElementById('broilerFeed').value = record.feedIntakeKg || 0;
  document.getElementById('broilerAdded').value = record.populationAdded || 0;
  document.getElementById('broilerDecreased').value = (record.populationDecreased || 0)
    + (record.mortality || 0) + (record.cull || 0);
  document.getElementById('broilerFormTitle').textContent = `Ubah Catatan Hari ke-${dayNum}`;
  document.getElementById('modalBroilerMonitoring').classList.add('active');
}

function handleSaveBroiler(event) {
  event.preventDefault();
  return saveDailyRecord('broiler');
}

function handleSaveLayer(event) {
  event.preventDefault();
  return saveDailyRecord('layer');
}

async function saveDailyRecord(type) {
  if (!currentActiveFlock || getProductionType(currentActiveFlock) !== type) {
    showToast('Pilih kandang dengan jenis ayam yang sesuai terlebih dahulu.', 'error');
    return;
  }

  const isLayer = type === 'layer';
  const prefix = isLayer ? 'layer' : 'broiler';
  const day = Number(document.getElementById(`${prefix}Day`).value);
  const date = document.getElementById(`${prefix}Date`).value;
  const week = Math.max(1, Math.ceil(day / 7));
  const avgWeight = isLayer ? 0 : Number(document.getElementById('broilerWeight').value);
  const feedIntakeKg = Number(document.getElementById(isLayer ? 'layerFeed' : 'broilerFeed').value);
  const populationAdded = isLayer
    ? Number(document.getElementById('layerAdded')?.value || 0)
    : Number(document.getElementById('broilerAdded')?.value || 0);
  const populationDecreased = isLayer
    ? Number(document.getElementById('layerDecreased')?.value || 0)
    : Number(document.getElementById('broilerDecreased')?.value || 0);
  const originalRecord = currentEditingRecordId == null
    ? null
    : (currentActiveFlock.weighings || []).find(item =>
        String(item.id) === String(currentEditingRecordId) ||
        String(item.day) === String(currentEditingRecordId) ||
        String(item.ageDays) === String(currentEditingRecordId) ||
        String(item.week) === String(currentEditingRecordId)
      );

  const weekApprox = Math.round(day / 7);
  const standard = currentStandard?.weeklyStandards?.find(item => Number(item.week) === weekApprox);
  const formData = new FormData();
  if (originalRecord?.id) {
    formData.append('id', originalRecord.id);
  }
  formData.append('day', day);
  formData.append('week', week);
  formData.append('date', date);
  formData.append('ageDays', day);
  formData.append('avgWeight', avgWeight);
  formData.append('targetWeight', standard?.standardWeight || avgWeight);
  formData.append('sampleCount', originalRecord?.sampleCount || (isLayer ? 0 : 30));
  formData.append('samples', JSON.stringify(originalRecord?.samples || []));
  formData.append('uniformity', originalRecord?.uniformity || 90);
  formData.append('feedIntakeKg', feedIntakeKg);
  formData.append('populationAdded', populationAdded);
  formData.append('populationDecreased', populationDecreased);
  formData.append('populationShipped', 0);
  formData.append('eggCount', isLayer ? Number(document.getElementById('layerEggCount').value) : 0);
  formData.append('eggWeightKg', isLayer ? Number(document.getElementById('layerEggWeight').value) : 0);
  formData.append('healthNote', document.getElementById(`${prefix}Notes`).value.trim());

  const photo = document.getElementById(`${prefix}Photo`).files[0];
  if (photo) formData.append('photo', photo);

  try {
    await window.apiClient.saveWeighing(currentActiveFlock.id, formData);
    document.getElementById(isLayer ? 'modalLayerProduction' : 'modalBroilerMonitoring').classList.remove('active');
    currentEditingRecordId = null;
    showToast(`Catatan hari ke-${day} berhasil disimpan.`, 'success');
    await loadDataFromBackend();
  } catch (error) {
    showToast(`Catatan belum berhasil disimpan: ${error.message}`, 'error');
  }
}

async function deleteWeighingData(identifier, dayNumber) {
  const displayDay = dayNumber != null ? dayNumber : identifier;
  if (!confirm(`Hapus catatan hari ke-${displayDay}? Catatan yang dihapus tidak dapat dikembalikan.`)) return;
  try {
    await window.apiClient.deleteWeighing(currentActiveFlock.id, identifier);
    showToast(`Catatan hari ke-${displayDay} telah dihapus.`, 'success');
    await loadDataFromBackend();
  } catch (err) {
    showToast('Gagal menghapus data: ' + err.message, 'error');
  }
}

function openNewFlockModal() {
  const typeSelect = document.getElementById('flockType');
  typeSelect.value = activeProductionType;
  updateBreedOptions();
  document.getElementById('flockFormCategory').textContent = activeProductionType === 'layer'
    ? 'Kandang ayam petelur'
    : 'Kandang ayam pedaging';
  document.getElementById('flockFormTitle').textContent = `Tambah Kandang Ayam ${activeProductionType === 'layer' ? 'Petelur' : 'Pedaging'}`;
  document.getElementById('flockDocDate').value = getTodayInputDate();
  document.getElementById('flockType').value = activeProductionType;
  document.getElementById('modalNewFlock').classList.add('active');
}

function updateBreedOptions() {
  const type = document.getElementById('flockType').value;
  const breedSelect = document.getElementById('flockBreed');
  const currentBreed = breedSelect.value;
  const options = type === 'layer'
    ? [{ value: 'layer', label: 'Ayam petelur' }]
    : [
      { value: 'kub', label: 'Ayam KUB' },
      { value: 'joper', label: 'Ayam Joper' },
      { value: 'broiler', label: 'Ayam broiler' },
      { value: 'kampung_asli', label: 'Ayam kampung' }
    ];
  breedSelect.innerHTML = options.map(option =>
    `<option value="${option.value}">${option.label}</option>`
  ).join('');
  breedSelect.value = options.some(option => option.value === currentBreed)
    ? currentBreed
    : options[0].value;
}

async function handleSaveNewFlock(e) {
  e.preventDefault();
  const name = document.getElementById('flockName').value.trim();
  const code = `${activeProductionType === 'layer' ? 'PET' : 'PED'}-${Date.now()}`;
  const productionType = document.getElementById('flockType').value;
  const breed = document.getElementById('flockBreed').value;
  const docDate = document.getElementById('flockDocDate').value;
  const initialPop = parseInt(document.getElementById('flockInitialPop').value, 10);
  const cageType = document.getElementById('flockCageType').value.trim();
  const location = document.getElementById('flockLocation').value.trim();
  const officer = document.getElementById('flockOfficer').value.trim();
  const notes = document.getElementById('flockNotes').value.trim();

  try {
    const newFlock = await window.apiClient.createFlock({
      name,
      code,
      productionType,
      breed,
      docDate,
      initialPop,
      cageType,
      location,
      officer,
      notes
    });

    window.apiClient.setActiveFlockId(newFlock.id);
    document.getElementById('modalNewFlock').classList.remove('active');
    document.getElementById('formNewFlock').reset();
    showToast(`Kandang ${name} berhasil dibuat!`, 'success');

    await loadDataFromBackend();
  } catch (err) {
    showToast('Gagal membuat kandang: ' + err.message, 'error');
  }
}

async function handleDeleteFlock() {
  if (!currentActiveFlock) return;
  const confirmMsg = `Hapus kandang "${currentActiveFlock.name}" beserta semua catatannya? Penghapusan tidak dapat dibatalkan.`;
  if (confirm(confirmMsg)) {
    try {
      await window.apiClient.deleteFlock(currentActiveFlock.id);
      showToast('Kandang berhasil dihapus.', 'success');
      await loadDataFromBackend();
    } catch (err) {
      showToast('Gagal menghapus: ' + err.message, 'error');
    }
  }
}

function openStandardsModal() {
  const container = document.getElementById('standardsContainer');
  if (!container) return;

  const breeds = Object.values(window.POULTRY_STANDARDS);
  container.innerHTML = breeds.map(b => `
    <div class="standard-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem;">
        <div>
          <h4>${b.name}</h4>
          <span style="font-size:0.72rem; color:var(--text-muted);">${b.category}</span>
        </div>
        <span class="meta-pill">Target Panen: M${b.harvestWeek} (~${b.targetHarvestWeight}g)</span>
      </div>
      <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.75rem;">${b.description}</p>
      
      <div style="max-height: 200px; overflow-y:auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
        <table class="data-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>Minggu</th>
              <th>Target Bobot</th>
              <th>Toleransi (Min - Max)</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            ${b.weeklyStandards.map(s => `
              <tr>
                <td><strong>M${s.week}</strong> (${s.ageDays} hr)</td>
                <td><strong style="color:var(--primary-600);">${s.standardWeight} g</strong></td>
                <td>${s.minWeight} - ${s.maxWeight} g</td>
                <td style="color:var(--text-muted);">${s.note}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');

  document.getElementById('modalStandards').classList.add('active');
}

function exportToCsv() {
  if (!currentActiveFlock) return;
  const weighings = currentActiveFlock.weighings || [];
  if (weighings.length === 0) {
    showToast('Belum ada data monitoring untuk diexport.', 'error');
    return;
  }

  const isLayer = activeProductionType === 'layer';
  const rows = [
    [`BRMP DIY - Laporan Monitoring Ayam ${isLayer ? 'Petelur' : 'Pedaging'}`],
    ['Kandang / Flok', currentActiveFlock.name],
    ['Kode Batch', currentActiveFlock.code],
    ['Jenis Ayam', `${isLayer ? 'Petelur' : 'Pedaging'} - ${currentStandard ? currentStandard.name : currentActiveFlock.breed}`],
    ['Tanggal Mulai', currentActiveFlock.docDate],
    ['Populasi Awal', `${currentActiveFlock.initialPop} ekor`],
    ['Populasi Terkini', `${currentActiveFlock.currentPop} ekor`],
    ['Petugas PIC', currentActiveFlock.officer || '-'],
    [''],
    isLayer
      ? ['Hari ke-', 'Tanggal', 'Populasi', 'Jumlah Telur (butir)', 'Bobot Telur (kg)', 'Pakan Harian (kg)', 'Bertambah (ekor)', 'Berkurang (ekor)', 'Catatan']
      : ['Hari ke-', 'Tanggal', 'Bobot Rata-rata (gram)', 'Pakan Harian (kg)', 'Bertambah (ekor)', 'Berkurang (ekor)', 'Catatan']
  ];

  const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  weighings.forEach((w, index) => {
    const dayNum = Number(w.day != null ? w.day : (w.ageDays != null ? w.ageDays : Number(w.week || 0) * 7));
    const decreased = (Number(w.populationDecreased) || 0) + (Number(w.mortality) || 0) + (Number(w.cull) || 0);
    const common = [
      dayNum === 0 && !isLayer ? 'DOC (H0)' : `Hari ${dayNum}`,
      w.date,
      Number(w.feedIntakeKg) || 0
    ];
    if (isLayer) {
      const population = weighings.slice(0, index + 1).reduce((total, record) => total
        + (Number(record.populationAdded) || 0) - (Number(record.populationDecreased) || 0)
        - (Number(record.populationShipped) || 0) - (Number(record.mortality) || 0)
        - (Number(record.cull) || 0),
      Number(currentActiveFlock.initialPop) || 0);
      rows.push([
        common[0], common[1], Math.max(0, population), Number(w.eggCount) || 0,
        Number(w.eggWeightKg) || 0, common[2], Number(w.populationAdded) || 0,
        decreased, w.healthNote || ''
      ]);
    } else {
      rows.push([
        common[0], common[1], Number(w.avgWeight) || 0, common[2],
        Number(w.populationAdded) || 0, decreased,
        w.healthNote || ''
      ]);
    }
  });

  const csvContent = '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
  const encodedUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `brmp_${activeProductionType}_${currentActiveFlock.code}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// Global functions for inline HTML calls
window.openEditWeighingModal = openEditWeighingModal;
window.deleteWeighingData = deleteWeighingData;
window.openPhotoViewer = openPhotoViewer;

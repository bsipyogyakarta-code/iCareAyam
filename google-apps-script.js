/**
 * =========================================================================
 * BRMP DIY POULTRYTRACK - GOOGLE APPS SCRIPT DATABASE BACKEND
 * =========================================================================
 * Skrip ini dipasang di Google Spreadsheet untuk menjadikannya sebagai
 * Cloud Database dan Cloud Storage foto (Google Drive) secara gratis.
 * 
 * CARA PEMASANGAN (Hanya 2 Menit):
 * 1. Buka Google Spreadsheet baru di Google Drive (https://sheets.new).
 * 2. Beri nama spreadsheet, contoh: "BRMP PoultryTrack Database".
 * 3. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 4. Hapus semua kode default di editor, lalu PASTE SELURUH KODE DI FILE INI.
 * 5. Klik tombol "Simpan" (ikon disket) / Ctrl+S.
 * 6. Klik tombol biru "Terapkan" (Deploy) di kanan atas -> "Penerapan baru" (New deployment).
 * 7. Pada ikon gear (roda gigi) "Pilih jenis", pilih "Aplikasi web" (Web app).
 * 8. Konfigurasi:
 *    - Deskripsi: "BRMP PoultryTrack API"
 *    - Jalankan sebagai (Execute as): "Saya (email Anda)"
 *    - Siapa yang memiliki akses (Who has access): "Siapa saja" (Anyone) -> PENTING!
 * 9. Klik "Terapkan" (Deploy) & berikan izin akses Google jika diminta ("Beri akses" -> "Lanjutan" -> "Buka... (tidak aman)").
 * 10. SALIN "URL Aplikasi web" (formatnya: https://script.google.com/macros/s/.../exec).
 * 11. Masukkan URL tersebut ke Environment Variable di Vercel (atau file .env) dengan nama:
 *     GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 * =========================================================================
 */

var FLOCK_HEADERS = [
  'ID Kandang', 'Nama Kandang', 'Kode Batch', 'Jenis/Galur Ayam', 'Tipe Pemeliharaan',
  'Tanggal DOC Masuk', 'Populasi Awal (ekor)', 'Populasi Saat Ini (ekor)', 'Tipe Kandang',
  'Lokasi Kandang', 'Petugas/PIC', 'Catatan Kandang', 'Waktu Dibuat'
];

var WEIGHING_HEADERS = [
  'ID Catatan', 'ID Kandang', 'Minggu Ke-', 'Tanggal Catat', 'Hari Ke- (Umur)',
  'Bobot Rata-rata (gram)', 'Target Bobot (gram)', 'Jumlah Sampel (ekor)', 'Data Sampel (JSON)',
  'Keseragaman (%)', 'Pakan Harian (kg)', 'Kematian (ekor)', 'Afkir (ekor)',
  'Ayam Masuk (ekor)', 'Ayam Berkurang (ekor)', 'Ayam Dipanen/Keluar (ekor)',
  'Produksi Telur (butir)', 'Bobot Telur (kg)', 'Catatan Kesehatan', 'Foto Dokumentasi', 'Waktu Input'
];

// Peta sinonim untuk mendukung pembacaan header Bahasa Indonesia maupun Bahasa Inggris lama
var HEADER_MAP = {
  // Weighings
  'id': 'id',
  'id catatan': 'id',
  'flock_id': 'flock_id',
  'id kandang': 'flock_id',
  'week': 'week',
  'minggu ke-': 'week',
  'minggu': 'week',
  'date': 'date',
  'tanggal catat': 'date',
  'tanggal': 'date',
  'age_days': 'age_days',
  'hari ke- (umur)': 'age_days',
  'hari ke-': 'age_days',
  'umur (hari)': 'age_days',
  'day': 'age_days',
  'avg_weight': 'avg_weight',
  'bobot rata-rata (gram)': 'avg_weight',
  'bobot rata-rata': 'avg_weight',
  'target_weight': 'target_weight',
  'target bobot (gram)': 'target_weight',
  'target bobot': 'target_weight',
  'sample_count': 'sample_count',
  'jumlah sampel (ekor)': 'sample_count',
  'jumlah sampel': 'sample_count',
  'samples_json': 'samples_json',
  'data sampel (json)': 'samples_json',
  'uniformity': 'uniformity',
  'keseragaman (%)': 'uniformity',
  'keseragaman': 'uniformity',
  'feed_intake_kg': 'feed_intake_kg',
  'pakan harian (kg)': 'feed_intake_kg',
  'pakan harian': 'feed_intake_kg',
  'mortality': 'mortality',
  'kematian (ekor)': 'mortality',
  'kematian': 'mortality',
  'cull': 'cull',
  'afkir (ekor)': 'cull',
  'afkir': 'cull',
  'population_added': 'population_added',
  'ayam masuk (ekor)': 'population_added',
  'population_decreased': 'population_decreased',
  'ayam berkurang (ekor)': 'population_decreased',
  'population_shipped': 'population_shipped',
  'ayam dipanen/keluar (ekor)': 'population_shipped',
  'egg_count': 'egg_count',
  'produksi telur (butir)': 'egg_count',
  'jumlah telur (butir)': 'egg_count',
  'egg_weight_kg': 'egg_weight_kg',
  'bobot telur (kg)': 'egg_weight_kg',
  'total bobot telur (kg)': 'egg_weight_kg',
  'health_note': 'health_note',
  'catatan kesehatan': 'health_note',
  'photo_url': 'photo_url',
  'foto dokumentasi': 'photo_url',
  'link foto dokumentasi': 'photo_url',
  'created_at': 'created_at',
  'waktu input': 'created_at',

  // Flocks
  'nama kandang': 'name',
  'name': 'name',
  'kode batch': 'code',
  'kode': 'code',
  'code': 'code',
  'jenis/galur ayam': 'breed',
  'jenis ayam': 'breed',
  'breed': 'breed',
  'tipe pemeliharaan': 'production_type',
  'production_type': 'production_type',
  'tanggal doc masuk': 'doc_date',
  'tanggal doc': 'doc_date',
  'doc_date': 'doc_date',
  'populasi awal (ekor)': 'initial_pop',
  'populasi awal': 'initial_pop',
  'initial_pop': 'initial_pop',
  'populasi saat ini (ekor)': 'current_pop',
  'populasi saat ini': 'current_pop',
  'current_pop': 'current_pop',
  'tipe kandang': 'cage_type',
  'cage_type': 'cage_type',
  'lokasi kandang': 'location',
  'lokasi': 'location',
  'location': 'location',
  'petugas/pic': 'officer',
  'petugas pic': 'officer',
  'petugas': 'officer',
  'officer': 'officer',
  'catatan kandang': 'notes',
  'notes': 'notes',
  'waktu dibuat': 'created_at'
};

function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#24580b')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetObjects(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return [];
  
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var rawHeaders = data[0];
  var rows = [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Jakarta';
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = { _rowIndex: i + 1 };
    for (var j = 0; j < rawHeaders.length; j++) {
      var headerText = String(rawHeaders[j] || '').trim();
      var cleanKey = headerText.toLowerCase();
      var canonicalKey = HEADER_MAP[cleanKey] || cleanKey;
      var val = row[j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      }
      obj[canonicalKey] = val;
      if (headerText && headerText !== canonicalKey) {
        obj[headerText] = val;
      }
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Menu otomatis saat Spreadsheet dibuka oleh pengguna di browser
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🐔 PoultryTrack BRMP')
    .addItem('🇮🇩 Perbarui Header ke Bahasa Indonesia', 'perbaruiHeaderKeBahasaIndonesia')
    .addItem('✨ Rapikan Format Tabel & Kolom', 'rapikanTampilanSheet')
    .addToUi();
}

/**
 * Fungsi sekali klik untuk mengubah header bahasa Inggris lama ke Bahasa Indonesia
 */
function perbaruiHeaderKeBahasaIndonesia() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Perbarui Sheet Weighings (Catatan Harian)
  var sheetW = ss.getSheetByName('Weighings');
  if (sheetW) {
    sheetW.getRange(1, 1, 1, WEIGHING_HEADERS.length).setValues([WEIGHING_HEADERS]);
    sheetW.getRange(1, 1, 1, WEIGHING_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#24580b')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheetW.setFrozenRows(1);
    for (var i = 1; i <= WEIGHING_HEADERS.length; i++) {
      sheetW.autoResizeColumn(i);
    }
  }

  // 2. Perbarui Sheet Flocks (Master Kandang)
  var sheetF = ss.getSheetByName('Flocks');
  if (sheetF) {
    sheetF.getRange(1, 1, 1, FLOCK_HEADERS.length).setValues([FLOCK_HEADERS]);
    sheetF.getRange(1, 1, 1, FLOCK_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#24580b')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheetF.setFrozenRows(1);
    for (var j = 1; j <= FLOCK_HEADERS.length; j++) {
      sheetF.autoResizeColumn(j);
    }
  }

  try {
    SpreadsheetApp.getUi().alert(
      'Berhasil Diperbarui!',
      'Semua judul kolom di sheet "Weighings" dan "Flocks" kini telah disesuaikan ke Bahasa Indonesia yang rapi sesuai format harian.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // Mode headless (dipanggil melalui API)
  }
}

function rapikanTampilanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      sh.getRange(1, 1, 1, lastCol)
        .setFontWeight('bold')
        .setBackground('#24580b')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      sh.setFrozenRows(1);
      for (var c = 1; c <= lastCol; c++) {
        sh.autoResizeColumn(c);
      }
    }
  }
  try {
    SpreadsheetApp.getUi().alert('Format tabel dan lebar kolom berhasil dirapikan!');
  } catch (e) {}
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: 'online',
    provider: 'Google Spreadsheet Cloud Database (BRMP DIY)',
    message: 'Endpoint Google Apps Script siap menerima request dari Vercel.',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Kunci eksekusi selama maksimal 30 detik untuk menghindari konflik baris
    lock.waitLock(30000);

    var contents = e && e.postData ? e.postData.contents : '{}';
    var payload = JSON.parse(contents);
    var action = payload.action;
    var result = {};

    switch (action) {
      case 'ping':
        result = { success: true, message: 'Pong dari Google Sheets!' };
        break;
      case 'migrateHeaders':
        perbaruiHeaderKeBahasaIndonesia();
        result = { success: true, message: 'Header berhasil diperbarui ke Bahasa Indonesia' };
        break;
      case 'getAllFlocks':
        result = handleGetAllFlocks();
        break;
      case 'getFlockById':
        result = handleGetFlockById(payload.id);
        break;
      case 'createFlock':
        result = handleCreateFlock(payload.flock);
        break;
      case 'deleteFlock':
        result = handleDeleteFlock(payload.id);
        break;
      case 'getWeighingsByFlock':
        result = handleGetWeighingsByFlock(payload.flockId);
        break;
      case 'upsertWeighing':
        result = handleUpsertWeighing(payload.weighing);
        break;
      case 'deleteWeighing':
        result = handleDeleteWeighing(payload.flockId, payload.key != null ? payload.key : payload.week);
        break;
      case 'uploadPhoto':
        result = handleUploadPhoto(payload);
        break;
      default:
        result = { success: false, error: 'Aksi "' + action + '" tidak dikenali.' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------------------
// HANDLERS
// -------------------------------------------------------------------------

function handleGetAllFlocks() {
  var sheet = getOrCreateSheet('Flocks', FLOCK_HEADERS);
  var rows = getSheetObjects(sheet);
  // Sort descending by created_at
  rows.sort(function(a, b) {
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return { success: true, data: rows };
}

function handleGetFlockById(id) {
  var sheet = getOrCreateSheet('Flocks', FLOCK_HEADERS);
  var rows = getSheetObjects(sheet);
  var target = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      target = rows[i];
      break;
    }
  }
  return { success: true, data: target };
}

function handleCreateFlock(flock) {
  var sheet = getOrCreateSheet('Flocks', FLOCK_HEADERS);
  var now = new Date().toISOString();
  var rowData = [
    flock.id || ('flock-' + new Date().getTime()),
    flock.name || '',
    flock.code || '',
    flock.breed || 'kub',
    flock.production_type || flock.productionType || 'broiler',
    flock.doc_date || flock.docDate || '',
    Number(flock.initial_pop || flock.initialPop || 0),
    Number(flock.current_pop || flock.currentPop || flock.initial_pop || 0),
    flock.cage_type || flock.cageType || '',
    flock.location || '',
    flock.officer || '',
    flock.notes || '',
    flock.created_at || now
  ];
  sheet.appendRow(rowData);
  return {
    success: true,
    data: {
      id: rowData[0],
      name: rowData[1],
      code: rowData[2],
      breed: rowData[3],
      production_type: rowData[4],
      doc_date: rowData[5],
      initial_pop: rowData[6],
      current_pop: rowData[7],
      cage_type: rowData[8],
      location: rowData[9],
      officer: rowData[10],
      notes: rowData[11],
      created_at: rowData[12]
    }
  };
}

function handleDeleteFlock(id) {
  var sheetFlocks = getOrCreateSheet('Flocks', FLOCK_HEADERS);
  var rowsFlocks = getSheetObjects(sheetFlocks);
  for (var i = 0; i < rowsFlocks.length; i++) {
    if (String(rowsFlocks[i].id) === String(id)) {
      sheetFlocks.deleteRow(rowsFlocks[i]._rowIndex);
      break;
    }
  }

  // Hapus semua penimbangan yang terkait flok ini
  var sheetWeighings = getOrCreateSheet('Weighings', WEIGHING_HEADERS);
  var rowsW = getSheetObjects(sheetWeighings);
  // Hapus dari indeks terbesar ke terkecil agar indeks baris tidak bergeser
  for (var j = rowsW.length - 1; j >= 0; j--) {
    if (String(rowsW[j].flock_id) === String(id)) {
      sheetWeighings.deleteRow(rowsW[j]._rowIndex);
    }
  }

  return { success: true };
}

function handleGetWeighingsByFlock(flockId) {
  var sheet = getOrCreateSheet('Weighings', WEIGHING_HEADERS);
  var rows = getSheetObjects(sheet);
  var filtered = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].flock_id) === String(flockId)) {
      filtered.push(rows[i]);
    }
  }
  // Sort ascending by age_days or week
  filtered.sort(function(a, b) {
    var dayA = Number(a.age_days != null && a.age_days !== '' ? a.age_days : (Number(a.week || 0) * 7));
    var dayB = Number(b.age_days != null && b.age_days !== '' ? b.age_days : (Number(b.week || 0) * 7));
    return dayA - dayB;
  });
  return { success: true, data: filtered };
}

function handleUpsertWeighing(weighing) {
  var sheetWeighings = getOrCreateSheet('Weighings', WEIGHING_HEADERS);
  var rowsW = getSheetObjects(sheetWeighings);
  var ageDays = Number(weighing.age_days != null ? weighing.age_days : (Number(weighing.week || 1) * 7));
  var week = Number(weighing.week || Math.max(1, Math.ceil(ageDays / 7)));
  var id = weighing.id || ('w-' + weighing.flock_id + '-d' + ageDays + '-' + (weighing.date || 'rec'));
  var existingRowIndex = -1;

  for (var i = 0; i < rowsW.length; i++) {
    if (String(rowsW[i].flock_id) === String(weighing.flock_id) &&
        (String(rowsW[i].id) === String(id) ||
         String(rowsW[i].date) === String(weighing.date) ||
         (Number(rowsW[i].age_days) === ageDays && ageDays > 0))) {
      existingRowIndex = rowsW[i]._rowIndex;
      if (rowsW[i].photo_url && !weighing.photo_url) {
        weighing.photo_url = rowsW[i].photo_url;
      }
      break;
    }
  }

  var samplesStr = typeof weighing.samples_json === 'string'
    ? weighing.samples_json
    : JSON.stringify(weighing.samples_json || weighing.samples || []);

  var rowData = [
    id,
    weighing.flock_id,
    week,
    weighing.date || '',
    ageDays,
    Number(weighing.avg_weight || 0),
    Number(weighing.target_weight || weighing.avg_weight || 0),
    Number(weighing.sample_count || 0),
    samplesStr,
    Number(weighing.uniformity || 90),
    Number(weighing.feed_intake_kg || 0),
    Number(weighing.mortality || 0),
    Number(weighing.cull || 0),
    Number(weighing.population_added || 0),
    Number(weighing.population_decreased || 0),
    Number(weighing.population_shipped || 0),
    Number(weighing.egg_count || 0),
    Number(weighing.egg_weight_kg || 0),
    weighing.health_note || '',
    weighing.photo_url || '',
    weighing.created_at || new Date().toISOString()
  ];

  if (existingRowIndex > 0) {
    sheetWeighings.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheetWeighings.appendRow(rowData);
  }

  recalculateCurrentPop(weighing.flock_id);
  return { success: true, id: id };
}

function handleDeleteWeighing(flockId, key) {
  var sheetWeighings = getOrCreateSheet('Weighings', WEIGHING_HEADERS);
  var rowsW = getSheetObjects(sheetWeighings);
  for (var i = 0; i < rowsW.length; i++) {
    if (String(rowsW[i].flock_id) === String(flockId) &&
        (String(rowsW[i].id) === String(key) ||
         String(rowsW[i].date) === String(key) ||
         Number(rowsW[i].age_days) === Number(key) ||
         Number(rowsW[i].week) === Number(key))) {
      sheetWeighings.deleteRow(rowsW[i]._rowIndex);
      break;
    }
  }

  recalculateCurrentPop(flockId);
  return { success: true };
}

function recalculateCurrentPop(flockId) {
  var sheetFlocks = getOrCreateSheet('Flocks', FLOCK_HEADERS);
  var rowsFlocks = getSheetObjects(sheetFlocks);
  var targetFlock = null;
  var flockRowIndex = -1;

  for (var i = 0; i < rowsFlocks.length; i++) {
    if (String(rowsFlocks[i].id) === String(flockId)) {
      targetFlock = rowsFlocks[i];
      flockRowIndex = rowsFlocks[i]._rowIndex;
      break;
    }
  }

  if (!targetFlock || flockRowIndex <= 0) return;

  var sheetWeighings = getOrCreateSheet('Weighings', WEIGHING_HEADERS);
  var rowsW = getSheetObjects(sheetWeighings);
  var currentPop = Number(targetFlock.initial_pop) || 0;

  for (var j = 0; j < rowsW.length; j++) {
    if (String(rowsW[j].flock_id) === String(flockId)) {
      var w = rowsW[j];
      currentPop += (Number(w.population_added) || 0)
        - (Number(w.population_decreased) || 0)
        - (Number(w.population_shipped) || 0)
        - (Number(w.mortality) || 0)
        - (Number(w.cull) || 0);
    }
  }

  currentPop = Math.max(0, currentPop);
  // Kolom current_pop adalah kolom ke-8 (index 1-based)
  sheetFlocks.getRange(flockRowIndex, 8).setValue(currentPop);
}

function handleUploadPhoto(data) {
  var folderName = 'BRMP_PoultryTrack_Photos';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var decoded = Utilities.base64Decode(data.fileBase64);
  var ext = (data.fileName || 'photo.jpg').split('.').pop().toLowerCase();
  var fileName = 'doc-' + new Date().getTime() + '.' + ext;
  var blob = Utilities.newBlob(decoded, data.mimeType || 'image/jpeg', fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  var photoUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
  return { success: true, url: photoUrl, fileId: fileId };
}

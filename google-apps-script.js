/**
 * =========================================================================
 * BRMP DIY POULTRYTRACK - GOOGLE APPS SCRIPT DATABASE BACKEND
 * =========================================================================
 * Skrip ini dipasang di Google Spreadsheet untuk menjadikannya sebagai
 * Cloud Database dan Cloud Storage foto (Google Drive) secara gratis.
 * 
 * Data dipisahkan menjadi sheet mandiri agar rapi:
 * 1. "Kandang Pedaging"   -> Master flok ayam pedaging/broiler
 * 2. "Monitoring Pedaging"-> Catatan timbangan harian ayam pedaging (tanpa kolom telur)
 * 3. "Kandang Petelur"    -> Master flok ayam petelur/layer
 * 4. "Monitoring Petelur" -> Catatan timbangan harian ayam petelur (lengkap kolom telur)
 * =========================================================================
 */

var SHEET_NAMES = {
  FLOCK_BROILER: 'Kandang Pedaging',
  WEIGHING_BROILER: 'Monitoring Pedaging',
  FLOCK_LAYER: 'Kandang Petelur',
  WEIGHING_LAYER: 'Monitoring Petelur'
};

var FLOCK_HEADERS = [
  'ID Kandang', 'Nama Kandang', 'Kode Batch', 'Jenis/Galur Ayam', 'Tipe Pemeliharaan',
  'Tanggal DOC Masuk', 'Populasi Awal (ekor)', 'Populasi Saat Ini (ekor)', 'Tipe Kandang',
  'Lokasi Kandang', 'Petugas/PIC', 'Catatan Kandang', 'Waktu Dibuat'
];

// Khusus ayam pedaging (tidak bertelur sehingga kolom telur ditiadakan agar rapi)
var WEIGHING_BROILER_HEADERS = [
  'ID Catatan', 'ID Kandang', 'Minggu Ke-', 'Tanggal Catat', 'Hari Ke- (Umur)',
  'Bobot Rata-rata (gram)', 'Target Bobot (gram)', 'Jumlah Sampel (ekor)', 'Data Sampel (JSON)',
  'Keseragaman (%)', 'Pakan Harian (kg)', 'Kematian (ekor)', 'Afkir (ekor)',
  'Ayam Masuk (ekor)', 'Ayam Berkurang (ekor)', 'Ayam Dipanen/Keluar (ekor)',
  'Catatan Kesehatan', 'Foto Dokumentasi', 'Waktu Input'
];

// Khusus ayam petelur (memiliki data produksi telur dan bobot telur)
var WEIGHING_LAYER_HEADERS = [
  'ID Catatan', 'ID Kandang', 'Minggu Ke-', 'Tanggal Catat', 'Hari Ke- (Umur)',
  'Bobot Rata-rata (gram)', 'Target Bobot (gram)', 'Jumlah Sampel (ekor)', 'Data Sampel (JSON)',
  'Keseragaman (%)', 'Pakan Harian (kg)', 'Kematian (ekor)', 'Afkir (ekor)',
  'Ayam Masuk (ekor)', 'Ayam Berkurang (ekor)', 'Ayam Dipanen/Keluar (ekor)',
  'Produksi Telur (butir)', 'Bobot Telur (kg)', 'Catatan Kesehatan', 'Foto Dokumentasi', 'Waktu Input'
];

// Fallback untuk sheet lama Weighings
var WEIGHING_HEADERS = WEIGHING_LAYER_HEADERS;

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

function isLayerFlock(flock) {
  if (!flock) return false;
  var prod = String(flock.production_type || flock.productionType || '').toLowerCase();
  var breed = String(flock.breed || '').toLowerCase();
  return prod === 'layer' || prod === 'petelur' || breed === 'layer' || breed === 'petelur';
}

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
    for (var c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
  }
  return sheet;
}

function getSheetObjects(sheet) {
  if (!sheet) return [];
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

function findFlockByIdAcrossSheets(flockId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = [SHEET_NAMES.FLOCK_BROILER, SHEET_NAMES.FLOCK_LAYER, 'Flocks'];
  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = ss.getSheetByName(sheetNames[s]);
    if (!sheet) continue;
    var rows = getSheetObjects(sheet);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(flockId)) {
        return { flock: rows[i], sheet: sheet, sheetName: sheetNames[s], rowIndex: rows[i]._rowIndex };
      }
    }
  }
  return null;
}

function cleanDuplicateRow(sheetName, flockId, id, date, ageDays) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var rows = getSheetObjects(sheet);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i].flock_id) === String(flockId) &&
      (String(rows[i].id) === String(id) ||
        (date && String(rows[i].date) === String(date)) ||
        (ageDays > 0 && Number(rows[i].age_days) === ageDays))) {
      sheet.deleteRow(rows[i]._rowIndex);
    }
  }
}

/**
 * Menu otomatis saat Spreadsheet dibuka oleh pengguna di browser
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🐔 PoultryTrack BRMP')
    .addItem('📑 Pisahkan Sheet Pedaging & Petelur', 'pisahkanSheetPedagingDanPetelur')
    .addItem('🇮🇩 Perbarui Header ke Bahasa Indonesia', 'perbaruiHeaderKeBahasaIndonesia')
    .addItem('✨ Rapikan Format Tabel & Kolom', 'rapikanTampilanSheet')
    .addToUi();
}

/**
 * Memisahkan dan merapikan sheet antara ayam pedaging dan petelur
 */
function pisahkanSheetPedagingDanPetelur() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Buat 4 sheet khusus
  var sheetFlockBroiler = getOrCreateSheet(SHEET_NAMES.FLOCK_BROILER, FLOCK_HEADERS);
  var sheetWeighBroiler = getOrCreateSheet(SHEET_NAMES.WEIGHING_BROILER, WEIGHING_BROILER_HEADERS);
  var sheetFlockLayer = getOrCreateSheet(SHEET_NAMES.FLOCK_LAYER, FLOCK_HEADERS);
  var sheetWeighLayer = getOrCreateSheet(SHEET_NAMES.WEIGHING_LAYER, WEIGHING_LAYER_HEADERS);

  var stats = {
    flocksPedaging: 0,
    flocksPetelur: 0,
    weighingsPedaging: 0,
    weighingsPetelur: 0
  };

  var flockMap = {}; // id -> isLayer boolean

  // 2. Migrasikan data Flocks lama (dari sheet 'Flocks' jika ada)
  var sheetOldFlocks = ss.getSheetByName('Flocks');
  if (sheetOldFlocks) {
    var oldFlocks = getSheetObjects(sheetOldFlocks);
    var existingBFlocks = getSheetObjects(sheetFlockBroiler);
    var existingLFlocks = getSheetObjects(sheetFlockLayer);

    var existingBIds = {};
    for (var b = 0; b < existingBFlocks.length; b++) existingBIds[existingBFlocks[b].id] = true;
    var existingLIds = {};
    for (var l = 0; l < existingLFlocks.length; l++) existingLIds[existingLFlocks[l].id] = true;

    for (var f = 0; f < oldFlocks.length; f++) {
      var flk = oldFlocks[f];
      var isLayer = isLayerFlock(flk);
      flockMap[flk.id] = isLayer;

      var rowData = [
        flk.id,
        flk.name || '',
        flk.code || '',
        flk.breed || (isLayer ? 'layer' : 'kub'),
        flk.production_type || (isLayer ? 'layer' : 'broiler'),
        flk.doc_date || '',
        Number(flk.initial_pop || 0),
        Number(flk.current_pop != null ? flk.current_pop : (flk.initial_pop || 0)),
        flk.cage_type || '',
        flk.location || '',
        flk.officer || '',
        flk.notes || '',
        flk.created_at || new Date().toISOString()
      ];

      if (isLayer) {
        if (!existingLIds[flk.id]) {
          sheetFlockLayer.appendRow(rowData);
          existingLIds[flk.id] = true;
          stats.flocksPetelur++;
        }
      } else {
        if (!existingBIds[flk.id]) {
          sheetFlockBroiler.appendRow(rowData);
          existingBIds[flk.id] = true;
          stats.flocksPedaging++;
        }
      }
    }
  }

  // Lengkapi peta jenis flok
  var allFlocksCurrent = handleGetAllFlocks().data || [];
  for (var k = 0; k < allFlocksCurrent.length; k++) {
    flockMap[allFlocksCurrent[k].id] = isLayerFlock(allFlocksCurrent[k]);
  }

  // 3. Migrasikan data Weighings lama (dari sheet 'Weighings' jika ada)
  var sheetOldWeighings = ss.getSheetByName('Weighings');
  if (sheetOldWeighings) {
    var oldWeighings = getSheetObjects(sheetOldWeighings);
    var existingBWeighs = getSheetObjects(sheetWeighBroiler);
    var existingLWeighs = getSheetObjects(sheetWeighLayer);

    var existingBWeighIds = {};
    for (var bw = 0; bw < existingBWeighs.length; bw++) existingBWeighIds[existingBWeighs[bw].id] = true;
    var existingLWeighIds = {};
    for (var lw = 0; lw < existingLWeighs.length; lw++) existingLWeighIds[existingLWeighs[lw].id] = true;

    for (var w = 0; w < oldWeighings.length; w++) {
      var wg = oldWeighings[w];
      var isL = flockMap[wg.flock_id] || (Number(wg.egg_count || 0) > 0);
      var samplesStr = typeof wg.samples_json === 'string'
        ? wg.samples_json
        : JSON.stringify(wg.samples_json || []);

      if (isL) {
        if (!existingLWeighIds[wg.id]) {
          sheetWeighLayer.appendRow([
            wg.id,
            wg.flock_id,
            Number(wg.week || 1),
            wg.date || '',
            Number(wg.age_days || 0),
            Number(wg.avg_weight || 0),
            Number(wg.target_weight || 0),
            Number(wg.sample_count || 0),
            samplesStr,
            Number(wg.uniformity || 90),
            Number(wg.feed_intake_kg || 0),
            Number(wg.mortality || 0),
            Number(wg.cull || 0),
            Number(wg.population_added || 0),
            Number(wg.population_decreased || 0),
            Number(wg.population_shipped || 0),
            Number(wg.egg_count || 0),
            Number(wg.egg_weight_kg || 0),
            wg.health_note || '',
            wg.photo_url || '',
            wg.created_at || new Date().toISOString()
          ]);
          existingLWeighIds[wg.id] = true;
          stats.weighingsPetelur++;
        }
      } else {
        if (!existingBWeighIds[wg.id]) {
          sheetWeighBroiler.appendRow([
            wg.id,
            wg.flock_id,
            Number(wg.week || 1),
            wg.date || '',
            Number(wg.age_days || 0),
            Number(wg.avg_weight || 0),
            Number(wg.target_weight || 0),
            Number(wg.sample_count || 0),
            samplesStr,
            Number(wg.uniformity || 90),
            Number(wg.feed_intake_kg || 0),
            Number(wg.mortality || 0),
            Number(wg.cull || 0),
            Number(wg.population_added || 0),
            Number(wg.population_decreased || 0),
            Number(wg.population_shipped || 0),
            wg.health_note || '',
            wg.photo_url || '',
            wg.created_at || new Date().toISOString()
          ]);
          existingBWeighIds[wg.id] = true;
          stats.weighingsPedaging++;
        }
      }
    }
  }

  // 4. Format header dan kolom semua target sheet
  var targetSheets = [sheetFlockBroiler, sheetWeighBroiler, sheetFlockLayer, sheetWeighLayer];
  for (var ts = 0; ts < targetSheets.length; ts++) {
    var sh = targetSheets[ts];
    var colCount = sh.getLastColumn();
    if (colCount > 0) {
      sh.getRange(1, 1, 1, colCount)
        .setFontWeight('bold')
        .setBackground('#24580b')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      sh.setFrozenRows(1);
      for (var c = 1; c <= colCount; c++) {
        sh.autoResizeColumn(c);
      }
    }
  }

  try {
    SpreadsheetApp.getUi().alert(
      'Pemisahan Berhasil!',
      'Data berhasil dipisahkan menjadi 4 sheet teratur:\n' +
      '1. ' + SHEET_NAMES.FLOCK_BROILER + '\n' +
      '2. ' + SHEET_NAMES.WEIGHING_BROILER + '\n' +
      '3. ' + SHEET_NAMES.FLOCK_LAYER + '\n' +
      '4. ' + SHEET_NAMES.WEIGHING_LAYER,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // Mode API headless
  }

  return { success: true, stats: stats };
}

function perbaruiHeaderKeBahasaIndonesia() {
  pisahkanSheetPedagingDanPetelur();
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
  } catch (e) { }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: 'online',
    provider: 'Google Spreadsheet Cloud Database (BRMP DIY)',
    message: 'Endpoint Google Apps Script siap menerima request dari Vercel.',
    sheets: [
      SHEET_NAMES.FLOCK_BROILER,
      SHEET_NAMES.WEIGHING_BROILER,
      SHEET_NAMES.FLOCK_LAYER,
      SHEET_NAMES.WEIGHING_LAYER
    ],
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
      case 'separateSheets':
      case 'migrateSheets':
      case 'migrateHeaders':
        result = pisahkanSheetPedagingDanPetelur();
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = [SHEET_NAMES.FLOCK_BROILER, SHEET_NAMES.FLOCK_LAYER, 'Flocks'];
  var seenIds = {};
  var allFlocks = [];

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = ss.getSheetByName(sheetNames[s]);
    if (!sheet) continue;
    var rows = getSheetObjects(sheet);
    for (var i = 0; i < rows.length; i++) {
      var f = rows[i];
      if (f.id && !seenIds[f.id]) {
        seenIds[f.id] = true;
        allFlocks.push(f);
      }
    }
  }

  // Sort descending by created_at
  allFlocks.sort(function (a, b) {
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return { success: true, data: allFlocks };
}

function handleGetFlockById(id) {
  var found = findFlockByIdAcrossSheets(id);
  return { success: true, data: found ? found.flock : null };
}

function handleCreateFlock(flock) {
  var isLayer = isLayerFlock(flock);
  var targetSheetName = isLayer ? SHEET_NAMES.FLOCK_LAYER : SHEET_NAMES.FLOCK_BROILER;
  var sheet = getOrCreateSheet(targetSheetName, FLOCK_HEADERS);
  var now = new Date().toISOString();
  var rowData = [
    flock.id || ('flock-' + new Date().getTime()),
    flock.name || '',
    flock.code || '',
    flock.breed || (isLayer ? 'layer' : 'kub'),
    flock.production_type || flock.productionType || (isLayer ? 'layer' : 'broiler'),
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var flockSheetNames = [SHEET_NAMES.FLOCK_BROILER, SHEET_NAMES.FLOCK_LAYER, 'Flocks'];
  for (var s = 0; s < flockSheetNames.length; s++) {
    var sheetF = ss.getSheetByName(flockSheetNames[s]);
    if (!sheetF) continue;
    var rowsFlocks = getSheetObjects(sheetF);
    for (var i = 0; i < rowsFlocks.length; i++) {
      if (String(rowsFlocks[i].id) === String(id)) {
        sheetF.deleteRow(rowsFlocks[i]._rowIndex);
        break;
      }
    }
  }

  // Hapus semua penimbangan yang terkait flok ini dari seluruh sheet monitoring
  var weighSheetNames = [SHEET_NAMES.WEIGHING_BROILER, SHEET_NAMES.WEIGHING_LAYER, 'Weighings'];
  for (var w = 0; w < weighSheetNames.length; w++) {
    var sheetW = ss.getSheetByName(weighSheetNames[w]);
    if (!sheetW) continue;
    var rowsW = getSheetObjects(sheetW);
    for (var j = rowsW.length - 1; j >= 0; j--) {
      if (String(rowsW[j].flock_id) === String(id)) {
        sheetW.deleteRow(rowsW[j]._rowIndex);
      }
    }
  }

  return { success: true };
}

function handleGetWeighingsByFlock(flockId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var flockInfo = findFlockByIdAcrossSheets(flockId);
  var candidateSheets = [];

  if (flockInfo && flockInfo.flock) {
    if (isLayerFlock(flockInfo.flock)) {
      candidateSheets = [SHEET_NAMES.WEIGHING_LAYER, 'Weighings'];
    } else {
      candidateSheets = [SHEET_NAMES.WEIGHING_BROILER, 'Weighings'];
    }
  } else {
    candidateSheets = [SHEET_NAMES.WEIGHING_BROILER, SHEET_NAMES.WEIGHING_LAYER, 'Weighings'];
  }

  var filtered = [];
  var seenIds = {};

  for (var s = 0; s < candidateSheets.length; s++) {
    var sheet = ss.getSheetByName(candidateSheets[s]);
    if (!sheet) continue;
    var rows = getSheetObjects(sheet);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].flock_id) === String(flockId)) {
        var recId = rows[i].id || (rows[i].age_days + '-' + rows[i].date);
        if (!seenIds[recId]) {
          seenIds[recId] = true;
          filtered.push(rows[i]);
        }
      }
    }
  }

  // Sort ascending by age_days or week
  filtered.sort(function (a, b) {
    var dayA = Number(a.age_days != null && a.age_days !== '' ? a.age_days : (Number(a.week || 0) * 7));
    var dayB = Number(b.age_days != null && b.age_days !== '' ? b.age_days : (Number(b.week || 0) * 7));
    return dayA - dayB;
  });
  return { success: true, data: filtered };
}

function handleUpsertWeighing(weighing) {
  var flockInfo = findFlockByIdAcrossSheets(weighing.flock_id);
  var isLayer = false;

  if (weighing.production_type) {
    var p = String(weighing.production_type).toLowerCase();
    isLayer = (p === 'layer' || p === 'petelur');
  } else if (flockInfo && flockInfo.flock) {
    isLayer = isLayerFlock(flockInfo.flock);
  }

  var targetSheetName = isLayer ? SHEET_NAMES.WEIGHING_LAYER : SHEET_NAMES.WEIGHING_BROILER;
  var targetHeaders = isLayer ? WEIGHING_LAYER_HEADERS : WEIGHING_BROILER_HEADERS;
  var sheetWeighings = getOrCreateSheet(targetSheetName, targetHeaders);
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

  var rowData;
  if (isLayer) {
    rowData = [
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
  } else {
    // Pedaging / Broiler tanpa kolom telur
    rowData = [
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
      weighing.health_note || '',
      weighing.photo_url || '',
      weighing.created_at || new Date().toISOString()
    ];
  }

  if (existingRowIndex > 0) {
    sheetWeighings.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheetWeighings.appendRow(rowData);
  }

  // Bersihkan dari sheet yang berlawanan dan legacy sheet jika pernah ada
  var oppositeSheetName = isLayer ? SHEET_NAMES.WEIGHING_BROILER : SHEET_NAMES.WEIGHING_LAYER;
  cleanDuplicateRow(oppositeSheetName, weighing.flock_id, id, weighing.date, ageDays);
  cleanDuplicateRow('Weighings', weighing.flock_id, id, weighing.date, ageDays);

  recalculateCurrentPop(weighing.flock_id);
  return { success: true, id: id, sheet: targetSheetName };
}

function handleDeleteWeighing(flockId, key) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var weighSheetNames = [SHEET_NAMES.WEIGHING_BROILER, SHEET_NAMES.WEIGHING_LAYER, 'Weighings'];
  for (var w = 0; w < weighSheetNames.length; w++) {
    var sheetW = ss.getSheetByName(weighSheetNames[w]);
    if (!sheetW) continue;
    var rowsW = getSheetObjects(sheetW);
    for (var i = 0; i < rowsW.length; i++) {
      if (String(rowsW[i].flock_id) === String(flockId) &&
        (String(rowsW[i].id) === String(key) ||
          String(rowsW[i].date) === String(key) ||
          Number(rowsW[i].age_days) === Number(key) ||
          Number(rowsW[i].week) === Number(key))) {
        sheetW.deleteRow(rowsW[i]._rowIndex);
        break;
      }
    }
  }

  recalculateCurrentPop(flockId);
  return { success: true };
}

function recalculateCurrentPop(flockId) {
  var flockInfo = findFlockByIdAcrossSheets(flockId);
  if (!flockInfo || !flockInfo.flock || !flockInfo.sheet) return;

  var currentPop = Number(flockInfo.flock.initial_pop) || 0;
  var weighingsRes = handleGetWeighingsByFlock(flockId);
  var weighings = weighingsRes.data || [];

  for (var j = 0; j < weighings.length; j++) {
    var w = weighings[j];
    currentPop += (Number(w.population_added) || 0)
      - (Number(w.population_decreased) || 0)
      - (Number(w.population_shipped) || 0)
      - (Number(w.mortality) || 0)
      - (Number(w.cull) || 0);
  }

  currentPop = Math.max(0, currentPop);
  // Kolom 'Populasi Saat Ini (ekor)' adalah kolom ke-8 (index 1-based)
  flockInfo.sheet.getRange(flockInfo.rowIndex, 8).setValue(currentPop);
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

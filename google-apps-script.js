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
  // Weighings & Flocks
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

  var sheetName = sheet.getName().toLowerCase();
  var isFlockSheet = (sheetName.indexOf('kandang') !== -1 || sheetName.indexOf('flock') !== -1);

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

    // Normalisasi ID untuk sheet kandang vs penimbangan
    if (isFlockSheet) {
      var fId = obj.id || obj.flock_id || obj['ID Kandang'] || obj['id kandang'] || obj.code || obj['Kode Batch'];
      if (fId) {
        obj.id = String(fId);
        obj.flock_id = String(fId);
      }
    } else {
      if (!obj.id && obj['id catatan']) obj.id = String(obj['id catatan']);
      if (!obj.id && obj['ID Catatan']) obj.id = String(obj['ID Catatan']);
      if (!obj.flock_id && obj['id kandang']) obj.flock_id = String(obj['id kandang']);
      if (!obj.flock_id && obj['ID Kandang']) obj.flock_id = String(obj['ID Kandang']);
    }

    rows.push(obj);
  }
  return rows;
}

function findFlockByIdAcrossSheets(flockId) {
  if (!flockId) return null;
  var targetId = String(flockId).trim().toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = [SHEET_NAMES.FLOCK_BROILER, SHEET_NAMES.FLOCK_LAYER, 'Flocks'];

  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = ss.getSheetByName(sheetNames[s]);
    if (!sheet) continue;
    var rows = getSheetObjects(sheet);
    for (var i = 0; i < rows.length; i++) {
      var fid = String(rows[i].id || rows[i].flock_id || rows[i]['ID Kandang'] || '').trim().toLowerCase();
      var fcode = String(rows[i].code || rows[i]['Kode Batch'] || '').trim().toLowerCase();
      if (fid === targetId || fcode === targetId) {
        rows[i].id = rows[i].id || rows[i].flock_id || rows[i]['ID Kandang'];
        rows[i].flock_id = rows[i].id;
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
  var targetFlock = String(flockId || '').trim();
  for (var i = rows.length - 1; i >= 0; i--) {
    var rFlk = String(rows[i].flock_id || rows[i]['ID Kandang'] || '').trim();
    var rId = String(rows[i].id || rows[i]['ID Catatan'] || '').trim();
    var rDate = String(rows[i].date || rows[i]['Tanggal Catat'] || '').trim();
    var rAge = Number(rows[i].age_days != null ? rows[i].age_days : rows[i]['Hari Ke- (Umur)']);

    if (rFlk === targetFlock &&
      (rId === String(id) ||
        (date && rDate === String(date)) ||
        (ageDays > 0 && rAge === ageDays))) {
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
    .addItem('✨ Rapikan Format Tabel & Kolom', 'rapikanTampilanSheet')
    .addToUi();
}

/**
 * Memisahkan dan merapikan sheet antara ayam pedaging dan petelur secara menyeluruh
 */
function pisahkanSheetPedagingDanPetelur() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Buat / dapatkan 4 sheet target
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

  // Buat set ID yang sudah ada di sheet target untuk mencegah duplikasi
  var existingBFlocks = getSheetObjects(sheetFlockBroiler);
  var existingLFlocks = getSheetObjects(sheetFlockLayer);
  var existingBIds = {};
  for (var b = 0; b < existingBFlocks.length; b++) {
    var bId = existingBFlocks[b].id || existingBFlocks[b].flock_id || existingBFlocks[b]['ID Kandang'];
    if (bId) existingBIds[String(bId).trim()] = true;
  }
  var existingLIds = {};
  for (var l = 0; l < existingLFlocks.length; l++) {
    var lId = existingLFlocks[l].id || existingLFlocks[l].flock_id || existingLFlocks[l]['ID Kandang'];
    if (lId) existingLIds[String(lId).trim()] = true;
  }

  var flockMap = {}; // flockId -> isLayer boolean

  // 2. Scan semua sheet kandang selain sheet target (misal sheet 'Flocks' lama)
  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var sh = allSheets[s];
    var sName = sh.getName();
    if (sName === SHEET_NAMES.FLOCK_BROILER || sName === SHEET_NAMES.FLOCK_LAYER ||
      sName === SHEET_NAMES.WEIGHING_BROILER || sName === SHEET_NAMES.WEIGHING_LAYER) {
      continue;
    }

    var sNameLower = sName.toLowerCase();
    if (sNameLower.indexOf('flock') !== -1 || sNameLower.indexOf('kandang') !== -1) {
      var oldFlocks = getSheetObjects(sh);
      for (var f = 0; f < oldFlocks.length; f++) {
        var flk = oldFlocks[f];
        var flkId = String(flk.id || flk.flock_id || flk['ID Kandang'] || ('flock-' + f)).trim();
        var isLayer = isLayerFlock(flk);
        flockMap[flkId] = isLayer;

        var rowData = [
          flkId,
          flk.name || flk['Nama Kandang'] || '',
          flk.code || flk['Kode Batch'] || '',
          flk.breed || flk['Jenis/Galur Ayam'] || (isLayer ? 'layer' : 'kub'),
          flk.production_type || flk['Tipe Pemeliharaan'] || (isLayer ? 'layer' : 'broiler'),
          flk.doc_date || flk['Tanggal DOC Masuk'] || '',
          Number(flk.initial_pop != null ? flk.initial_pop : (flk['Populasi Awal (ekor)'] || 0)),
          Number(flk.current_pop != null ? flk.current_pop : (flk['Populasi Saat Ini (ekor)'] != null ? flk['Populasi Saat Ini (ekor)'] : (flk.initial_pop || 0))),
          flk.cage_type || flk['Tipe Kandang'] || '',
          flk.location || flk['Lokasi Kandang'] || '',
          flk.officer || flk['Petugas/PIC'] || '',
          flk.notes || flk['Catatan Kandang'] || '',
          flk.created_at || flk['Waktu Dibuat'] || new Date().toISOString()
        ];

        if (isLayer) {
          if (!existingLIds[flkId]) {
            sheetFlockLayer.appendRow(rowData);
            existingLIds[flkId] = true;
            stats.flocksPetelur++;
          }
        } else {
          if (!existingBIds[flkId]) {
            sheetFlockBroiler.appendRow(rowData);
            existingBIds[flkId] = true;
            stats.flocksPedaging++;
          }
        }
      }
    }
  }

  // Lengkapi peta jenis flok dari sheet yang sudah ada
  var currentB = getSheetObjects(sheetFlockBroiler);
  for (var cb = 0; cb < currentB.length; cb++) {
    var cbid = currentB[cb].id || currentB[cb].flock_id;
    if (cbid) flockMap[String(cbid).trim()] = false;
  }
  var currentL = getSheetObjects(sheetFlockLayer);
  for (var cl = 0; cl < currentL.length; cl++) {
    var clid = currentL[cl].id || currentL[cl].flock_id;
    if (clid) flockMap[String(clid).trim()] = true;
  }

  // 3. Scan semua sheet penimbangan selain sheet target (misal sheet 'Weighings' lama)
  var existingBWeighs = getSheetObjects(sheetWeighBroiler);
  var existingLWeighs = getSheetObjects(sheetWeighLayer);
  var existingBWeighIds = {};
  for (var bw = 0; bw < existingBWeighs.length; bw++) {
    var bwid = existingBWeighs[bw].id || (existingBWeighs[bw].flock_id + '-' + existingBWeighs[bw].age_days);
    if (bwid) existingBWeighIds[String(bwid).trim()] = true;
  }
  var existingLWeighIds = {};
  for (var lw = 0; lw < existingLWeighs.length; lw++) {
    var lwid = existingLWeighs[lw].id || (existingLWeighs[lw].flock_id + '-' + existingLWeighs[lw].age_days);
    if (lwid) existingLWeighIds[String(lwid).trim()] = true;
  }

  for (var s2 = 0; s2 < allSheets.length; s2++) {
    var sh2 = allSheets[s2];
    var s2Name = sh2.getName();
    if (s2Name === SHEET_NAMES.FLOCK_BROILER || s2Name === SHEET_NAMES.FLOCK_LAYER ||
      s2Name === SHEET_NAMES.WEIGHING_BROILER || s2Name === SHEET_NAMES.WEIGHING_LAYER) {
      continue;
    }

    var s2NameLower = s2Name.toLowerCase();
    if (s2NameLower.indexOf('weigh') !== -1 || s2NameLower.indexOf('catatan') !== -1 || s2NameLower.indexOf('monitoring') !== -1) {
      var oldWeighings = getSheetObjects(sh2);
      for (var w = 0; w < oldWeighings.length; w++) {
        var wg = oldWeighings[w];
        var flockIdStr = String(wg.flock_id || wg['ID Kandang'] || '').trim();
        var isL = (flockMap[flockIdStr] === true) || (Number(wg.egg_count || wg['Produksi Telur (butir)'] || 0) > 0);
        var wid = String(wg.id || wg['ID Catatan'] || ('w-' + flockIdStr + '-d' + (wg.age_days || w))).trim();

        var samplesStr = typeof wg.samples_json === 'string'
          ? wg.samples_json
          : JSON.stringify(wg.samples_json || wg['Data Sampel (JSON)'] || []);

        if (isL) {
          if (!existingLWeighIds[wid]) {
            sheetWeighLayer.appendRow([
              wid,
              flockIdStr,
              Number(wg.week || wg['Minggu Ke-'] || 1),
              wg.date || wg['Tanggal Catat'] || '',
              Number(wg.age_days != null ? wg.age_days : (wg['Hari Ke- (Umur)'] || 0)),
              Number(wg.avg_weight != null ? wg.avg_weight : (wg['Bobot Rata-rata (gram)'] || 0)),
              Number(wg.target_weight != null ? wg.target_weight : (wg['Target Bobot (gram)'] || 0)),
              Number(wg.sample_count != null ? wg.sample_count : (wg['Jumlah Sampel (ekor)'] || 0)),
              samplesStr,
              Number(wg.uniformity != null ? wg.uniformity : (wg['Keseragaman (%)'] || 90)),
              Number(wg.feed_intake_kg != null ? wg.feed_intake_kg : (wg['Pakan Harian (kg)'] || 0)),
              Number(wg.mortality != null ? wg.mortality : (wg['Kematian (ekor)'] || 0)),
              Number(wg.cull != null ? wg.cull : (wg['Afkir (ekor)'] || 0)),
              Number(wg.population_added != null ? wg.population_added : (wg['Ayam Masuk (ekor)'] || 0)),
              Number(wg.population_decreased != null ? wg.population_decreased : (wg['Ayam Berkurang (ekor)'] || 0)),
              Number(wg.population_shipped != null ? wg.population_shipped : (wg['Ayam Dipanen/Keluar (ekor)'] || 0)),
              Number(wg.egg_count != null ? wg.egg_count : (wg['Produksi Telur (butir)'] || 0)),
              Number(wg.egg_weight_kg != null ? wg.egg_weight_kg : (wg['Bobot Telur (kg)'] || 0)),
              wg.health_note || wg['Catatan Kesehatan'] || '',
              wg.photo_url || wg['Foto Dokumentasi'] || '',
              wg.created_at || wg['Waktu Input'] || new Date().toISOString()
            ]);
            existingLWeighIds[wid] = true;
            stats.weighingsPetelur++;
          }
        } else {
          if (!existingBWeighIds[wid]) {
            sheetWeighBroiler.appendRow([
              wid,
              flockIdStr,
              Number(wg.week || wg['Minggu Ke-'] || 1),
              wg.date || wg['Tanggal Catat'] || '',
              Number(wg.age_days != null ? wg.age_days : (wg['Hari Ke- (Umur)'] || 0)),
              Number(wg.avg_weight != null ? wg.avg_weight : (wg['Bobot Rata-rata (gram)'] || 0)),
              Number(wg.target_weight != null ? wg.target_weight : (wg['Target Bobot (gram)'] || 0)),
              Number(wg.sample_count != null ? wg.sample_count : (wg['Jumlah Sampel (ekor)'] || 0)),
              samplesStr,
              Number(wg.uniformity != null ? wg.uniformity : (wg['Keseragaman (%)'] || 90)),
              Number(wg.feed_intake_kg != null ? wg.feed_intake_kg : (wg['Pakan Harian (kg)'] || 0)),
              Number(wg.mortality != null ? wg.mortality : (wg['Kematian (ekor)'] || 0)),
              Number(wg.cull != null ? wg.cull : (wg['Afkir (ekor)'] || 0)),
              Number(wg.population_added != null ? wg.population_added : (wg['Ayam Masuk (ekor)'] || 0)),
              Number(wg.population_decreased != null ? wg.population_decreased : (wg['Ayam Berkurang (ekor)'] || 0)),
              Number(wg.population_shipped != null ? wg.population_shipped : (wg['Ayam Dipanen/Keluar (ekor)'] || 0)),
              wg.health_note || wg['Catatan Kesehatan'] || '',
              wg.photo_url || wg['Foto Dokumentasi'] || '',
              wg.created_at || wg['Waktu Input'] || new Date().toISOString()
            ]);
            existingBWeighIds[wid] = true;
            stats.weighingsPedaging++;
          }
        }
      }
    }
  }

  // 4. Format header dan kolom semua target sheet
  var targetSheets = [sheetFlockBroiler, sheetWeighBroiler, sheetFlockLayer, sheetWeighLayer];
  for (var ts = 0; ts < targetSheets.length; ts++) {
    var sh3 = targetSheets[ts];
    var colCount = sh3.getLastColumn();
    if (colCount > 0) {
      sh3.getRange(1, 1, 1, colCount)
        .setFontWeight('bold')
        .setBackground('#24580b')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      sh3.setFrozenRows(1);
      for (var c = 1; c <= colCount; c++) {
        sh3.autoResizeColumn(c);
      }
    }
  }

  // 5. Hitung ulang populasi terkini untuk setiap flok
  var allFlocksTotal = handleGetAllFlocks().data || [];
  for (var tf = 0; tf < allFlocksTotal.length; tf++) {
    if (allFlocksTotal[tf].id) {
      recalculateCurrentPop(allFlocksTotal[tf].id);
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
  var contents = e && e.postData ? e.postData.contents : '{}';
  var payload = JSON.parse(contents);
  var action = payload.action;
  var result = {};

  // Hanya aksi penulisan data yang membutuhkan Lock agar aksi pembacaan data selalu instan & bebas antrian timeout
  var isWriteAction = (action === 'createFlock' || action === 'deleteFlock' || action === 'upsertWeighing' || action === 'deleteWeighing' || action === 'separateSheets' || action === 'migrateSheets' || action === 'migrateHeaders');
  var lock = null;
  if (isWriteAction) {
    lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (lockErr) {}
  }

  try {
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
    if (lock) {
      try { lock.releaseLock(); } catch (e) {}
    }
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
      var fid = String(f.id || f.flock_id || f['ID Kandang'] || '').trim();
      if (fid && !seenIds[fid]) {
        f.id = fid;
        f.flock_id = fid;
        seenIds[fid] = true;
        allFlocks.push(f);
      }
    }
  }

  // Muat data penimbangan tiap flok sekaligus dalam 1 roundtrip
  for (var j = 0; j < allFlocks.length; j++) {
    var weighingsRes = handleGetWeighingsByFlock(allFlocks[j].id);
    allFlocks[j].weighings = weighingsRes.data || [];
    allFlocks[j].weighingsCount = allFlocks[j].weighings.length;
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
  var flockId = flock.id || ('flock-' + new Date().getTime());
  var rowData = [
    flockId,
    flock.name || '',
    flock.code || '',
    flock.breed || (isLayer ? 'layer' : 'kub'),
    flock.production_type || flock.productionType || (isLayer ? 'layer' : 'broiler'),
    flock.doc_date || flock.docDate || '',
    Number(flock.initial_pop || flock.initialPop || 0),
    Number(flock.current_pop || flock.currentPop || flock.initial_pop || flock.initialPop || 0),
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
  var targetId = String(id || '').trim().toLowerCase();

  for (var s = 0; s < flockSheetNames.length; s++) {
    var sheetF = ss.getSheetByName(flockSheetNames[s]);
    if (!sheetF) continue;
    var rowsFlocks = getSheetObjects(sheetF);
    for (var i = 0; i < rowsFlocks.length; i++) {
      var fid = String(rowsFlocks[i].id || rowsFlocks[i].flock_id || rowsFlocks[i]['ID Kandang'] || '').trim().toLowerCase();
      if (fid === targetId) {
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
      var wflk = String(rowsW[j].flock_id || rowsW[j]['ID Kandang'] || '').trim().toLowerCase();
      if (wflk === targetId) {
        sheetW.deleteRow(rowsW[j]._rowIndex);
      }
    }
  }

  return { success: true };
}

function handleGetWeighingsByFlock(flockId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetFlockId = String(flockId || '').trim();
  var flockInfo = findFlockByIdAcrossSheets(targetFlockId);
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
      var rowFlockId = String(rows[i].flock_id || rows[i]['ID Kandang'] || '').trim();
      if (rowFlockId === targetFlockId) {
        var recId = String(rows[i].id || rows[i]['ID Catatan'] || (rows[i].age_days + '-' + rows[i].date)).trim();
        if (!seenIds[recId]) {
          seenIds[recId] = true;
          rows[i].id = recId;
          rows[i].flock_id = targetFlockId;
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
  var flockId = String(weighing.flock_id || weighing.flockId || '').trim();
  var flockInfo = findFlockByIdAcrossSheets(flockId);
  var isLayer = false;

  if (weighing.production_type || weighing.productionType) {
    var p = String(weighing.production_type || weighing.productionType).toLowerCase();
    isLayer = (p === 'layer' || p === 'petelur');
  } else if (flockInfo && flockInfo.flock) {
    isLayer = isLayerFlock(flockInfo.flock);
  }

  var targetSheetName = isLayer ? SHEET_NAMES.WEIGHING_LAYER : SHEET_NAMES.WEIGHING_BROILER;
  var targetHeaders = isLayer ? WEIGHING_LAYER_HEADERS : WEIGHING_BROILER_HEADERS;
  var sheetWeighings = getOrCreateSheet(targetSheetName, targetHeaders);
  var rowsW = getSheetObjects(sheetWeighings);

  var ageDays = Number(weighing.age_days != null ? weighing.age_days : (weighing.day != null ? weighing.day : (Number(weighing.week || 1) * 7)));
  var week = Number(weighing.week || Math.max(1, Math.ceil(ageDays / 7)));
  var id = weighing.id || ('w-' + flockId + '-d' + ageDays + '-' + (weighing.date || 'rec'));
  var existingRowIndex = -1;

  for (var i = 0; i < rowsW.length; i++) {
    var rFlockId = String(rowsW[i].flock_id || rowsW[i]['ID Kandang'] || '').trim();
    var rId = String(rowsW[i].id || rowsW[i]['ID Catatan'] || '').trim();
    var rDate = String(rowsW[i].date || rowsW[i]['Tanggal Catat'] || '').trim();
    var rAge = Number(rowsW[i].age_days != null ? rowsW[i].age_days : rowsW[i]['Hari Ke- (Umur)']);

    if (rFlockId === flockId &&
      (rId === String(id) ||
        (weighing.date && rDate === String(weighing.date)) ||
        (ageDays > 0 && rAge === ageDays))) {
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
      flockId,
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
      flockId,
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
  cleanDuplicateRow(oppositeSheetName, flockId, id, weighing.date, ageDays);
  cleanDuplicateRow('Weighings', flockId, id, weighing.date, ageDays);

  recalculateCurrentPop(flockId);
  return { success: true, id: id, sheet: targetSheetName };
}

function handleDeleteWeighing(flockId, key) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var weighSheetNames = [SHEET_NAMES.WEIGHING_BROILER, SHEET_NAMES.WEIGHING_LAYER, 'Weighings'];
  var targetFlock = String(flockId || '').trim();
  var targetKey = String(key || '').trim();

  for (var w = 0; w < weighSheetNames.length; w++) {
    var sheetW = ss.getSheetByName(weighSheetNames[w]);
    if (!sheetW) continue;
    var rowsW = getSheetObjects(sheetW);
    for (var i = rowsW.length - 1; i >= 0; i--) {
      var rFlk = String(rowsW[i].flock_id || rowsW[i]['ID Kandang'] || '').trim();
      var rId = String(rowsW[i].id || rowsW[i]['ID Catatan'] || '').trim();
      var rDate = String(rowsW[i].date || rowsW[i]['Tanggal Catat'] || '').trim();
      var rAge = Number(rowsW[i].age_days != null ? rowsW[i].age_days : rowsW[i]['Hari Ke- (Umur)']);
      var rWk = Number(rowsW[i].week != null ? rowsW[i].week : rowsW[i]['Minggu Ke-']);

      if (rFlk === targetFlock &&
        (rId === targetKey ||
          rDate === targetKey ||
          rAge === Number(targetKey) ||
          rWk === Number(targetKey))) {
        sheetW.deleteRow(rowsW[i]._rowIndex);
      }
    }
  }

  recalculateCurrentPop(flockId);
  return { success: true };
}

function recalculateCurrentPop(flockId) {
  var flockInfo = findFlockByIdAcrossSheets(flockId);
  if (!flockInfo || !flockInfo.flock || !flockInfo.sheet) return;

  var currentPop = Number(flockInfo.flock.initial_pop || flockInfo.flock['Populasi Awal (ekor)'] || 0);
  var weighingsRes = handleGetWeighingsByFlock(flockId);
  var weighings = weighingsRes.data || [];

  for (var j = 0; j < weighings.length; j++) {
    var w = weighings[j];
    currentPop += (Number(w.population_added || w['Ayam Masuk (ekor)'] || 0))
      - (Number(w.population_decreased || w['Ayam Berkurang (ekor)'] || 0))
      - (Number(w.population_shipped || w['Ayam Dipanen/Keluar (ekor)'] || 0))
      - (Number(w.mortality || w['Kematian (ekor)'] || 0))
      - (Number(w.cull || w['Afkir (ekor)'] || 0));
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

/**
 * Visualisasi Data & Grafik BRMP DIY menggunakan Chart.js
 * Disesuaikan dengan Palet Warna Resmi Logo BRMP DIY
 * - Hijau Hutan BRMP (#24580b)
 * - Biru Royal DIY (#003aa8 / #004ecc)
 * - Emas / Amber Lambang (#d97706 / #f59e0b)
 */

let growthChartInstance = null;
let gainChartInstance = null;
let distributionChartInstance = null;

const brmpColors = {
  forestGreen: '#24580b',
  forestGreenSoft: 'rgba(36, 88, 11, 0.18)',
  lightGreen: '#429519',
  royalBlue: '#003aa8',
  royalBlueSoft: 'rgba(0, 58, 168, 0.15)',
  skyBlue: '#004ecc',
  emblemGold: '#d97706',
  emblemGoldSoft: 'rgba(217, 119, 6, 0.18)',
  crimson: '#dc2626',
  gridDark: 'rgba(148, 163, 184, 0.12)',
  gridLight: 'rgba(36, 88, 11, 0.08)'
};

function renderGrowthChart(flock, forcedType) {
  const ctx = document.getElementById('growthChart');
  if (!ctx) return;

  const type = forcedType || flock?.productionType || (window.activeProductionType) || 'broiler';
  const isLayer = type === 'layer';
  const weighings = flock?.weighings || [];
  
  // Kumpulkan hari-hari pencatatan aktual
  const recordedDays = weighings.map(entry => Number(entry.day != null ? entry.day : (entry.ageDays != null ? entry.ageDays : Number(entry.week || 0) * 7)));
  let sortedDays = Array.from(new Set(recordedDays)).sort((a, b) => a - b);
  if (sortedDays.length === 0) {
    sortedDays = isLayer ? [1, 7, 14, 21, 28, 35] : [0, 7, 14, 21, 28, 35];
  }

  const labels = [];
  const actualData = [];

  for (const d of sortedDays) {
    labels.push(d === 0 && !isLayer ? 'DOC (H0)' : `Hari ${d}`);

    const actualEntry = weighings.find(entry => {
      const entryDay = Number(entry.day != null ? entry.day : (entry.ageDays != null ? entry.ageDays : Number(entry.week || 0) * 7));
      return entryDay === d;
    });

    if (isLayer) {
      actualData.push(actualEntry ? Number(actualEntry.eggCount || 0) : null);
    } else {
      actualData.push(actualEntry ? actualEntry.avgWeight : null);
    }
  }

  if (growthChartInstance) {
    growthChartInstance.destroy();
  }

  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDarkMode ? brmpColors.gridDark : brmpColors.gridLight;
  const textColor = isDarkMode ? '#cbd5e1' : '#334835';

  const lineColor = isLayer
    ? (isDarkMode ? '#fbbf24' : '#d97706')
    : (isDarkMode ? brmpColors.lightGreen : brmpColors.forestGreen);

  const bgColor = isLayer
    ? (isDarkMode ? 'rgba(251, 191, 36, 0.22)' : 'rgba(217, 119, 6, 0.16)')
    : (isDarkMode ? 'rgba(84, 180, 35, 0.22)' : 'rgba(36, 88, 11, 0.16)');

  const datasetLabel = isLayer ? 'Produksi Telur (butir)' : 'Bobot Ayam (gram)';
  const yAxisTitle = isLayer ? 'Produksi Telur (butir)' : 'Bobot Ayam (gram)';

  growthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: datasetLabel,
          data: actualData,
          borderColor: lineColor,
          backgroundColor: bgColor,
          borderWidth: 3,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.35,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: isDarkMode ? '#0e1810' : '#ffffff',
          titleColor: isDarkMode ? '#f0f7f1' : '#0c1a0e',
          bodyColor: isDarkMode ? '#95ac98' : '#334835',
          borderColor: isDarkMode ? '#2c4431' : '#cdd9c8',
          borderWidth: 1.5,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              if (val === null || val === undefined) return null;
              if (isLayer) {
                const dayVal = sortedDays[context.dataIndex];
                const entry = weighings.find(e => {
                  const eDay = Number(e.day != null ? e.day : (e.ageDays != null ? e.ageDays : Number(e.week || 0) * 7));
                  return eDay === dayVal;
                });
                const weightNote = entry && Number(entry.eggWeightKg) > 0 ? ` (${entry.eggWeightKg} kg)` : '';
                return ` Produksi: ${val.toLocaleString('id-ID')} butir${weightNote}`;
              }
              return ` Bobot: ${val.toLocaleString('id-ID')} gram`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          title: {
            display: true,
            text: 'Hari ke- (Umur Hari)',
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' }
          },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          title: {
            display: true,
            text: yAxisTitle,
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' }
          },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11 },
            callback: (val) => isLayer ? `${val} butir` : `${val} g`
          }
        }
      }
    }
  });
}

function renderGainChart(flock) {
  const ctx = document.getElementById('gainChart');
  if (!ctx) return;
  if (gainChartInstance) gainChartInstance.destroy();
}

function renderDistributionChart(latestWeighing) {
  const ctx = document.getElementById('distributionChart');
  if (!ctx) return;
  if (distributionChartInstance) distributionChartInstance.destroy();
}

window.renderGrowthChart = renderGrowthChart;
window.renderGainChart = renderGainChart;
window.renderDistributionChart = renderDistributionChart;

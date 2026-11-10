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

function getStandardWeightForDay(breedStandard, day) {
  if (!breedStandard || !breedStandard.weeklyStandards) return null;
  const standards = breedStandard.weeklyStandards;
  const weekExact = day / 7;
  const wLower = Math.floor(weekExact);
  const wUpper = Math.ceil(weekExact);
  const stdLower = standards.find(s => Number(s.week) === wLower);
  const stdUpper = standards.find(s => Number(s.week) === wUpper);
  if (wLower === wUpper && stdLower) {
    return {
      standard: stdLower.standardWeight,
      min: stdLower.minWeight,
      max: stdLower.maxWeight
    };
  }
  if (stdLower && stdUpper) {
    const frac = weekExact - wLower;
    return {
      standard: Math.round(stdLower.standardWeight + frac * (stdUpper.standardWeight - stdLower.standardWeight)),
      min: Math.round(stdLower.minWeight + frac * (stdUpper.minWeight - stdLower.minWeight)),
      max: Math.round(stdLower.maxWeight + frac * (stdUpper.maxWeight - stdLower.maxWeight))
    };
  }
  if (stdLower) return { standard: stdLower.standardWeight, min: stdLower.minWeight, max: stdLower.maxWeight };
  if (stdUpper) return { standard: stdUpper.standardWeight, min: stdUpper.minWeight, max: stdUpper.maxWeight };
  return null;
}

function renderGrowthChart(flock, breedStandard) {
  const ctx = document.getElementById('growthChart');
  if (!ctx) return;

  const weighings = flock?.weighings || [];
  
  // Kumpulkan hari-hari pencatatan aktual
  const recordedDays = weighings.map(entry => Number(entry.day != null ? entry.day : (entry.ageDays != null ? entry.ageDays : Number(entry.week || 0) * 7)));
  const maxRecordedDay = recordedDays.length > 0 ? Math.max(...recordedDays) : 0;
  const harvestDay = (breedStandard?.harvestWeek || 6) * 7;
  const maxDay = Math.max(maxRecordedDay, harvestDay);

  // Buat array hari unik (termasuk kelipatan 7 / mingguan standar)
  const daysSet = new Set([0]);
  for (let d = 7; d <= maxDay; d += 7) {
    daysSet.add(d);
  }
  recordedDays.forEach(d => daysSet.add(d));
  const sortedDays = Array.from(daysSet).sort((a, b) => a - b);

  const labels = [];
  const actualData = [];
  const targetData = [];
  const minTargetData = [];
  const maxTargetData = [];

  for (const d of sortedDays) {
    labels.push(d === 0 ? 'DOC (H0)' : `Hari ${d}`);

    const actualEntry = weighings.find(entry => {
      const entryDay = Number(entry.day != null ? entry.day : (entry.ageDays != null ? entry.ageDays : Number(entry.week || 0) * 7));
      return entryDay === d;
    });
    actualData.push(actualEntry ? actualEntry.avgWeight : null);

    const std = getStandardWeightForDay(breedStandard, d);
    if (std) {
      targetData.push(std.standard);
      minTargetData.push(std.min);
      maxTargetData.push(std.max);
    } else {
      targetData.push(null);
      minTargetData.push(null);
      maxTargetData.push(null);
    }
  }

  if (growthChartInstance) {
    growthChartInstance.destroy();
  }

  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDarkMode ? brmpColors.gridDark : brmpColors.gridLight;
  const textColor = isDarkMode ? '#cbd5e1' : '#334835';
  const actualLineColor = isDarkMode ? brmpColors.lightGreen : brmpColors.forestGreen;

  growthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Bobot Aktual Timbangan (g)',
          data: actualData,
          borderColor: actualLineColor,
          backgroundColor: isDarkMode ? 'rgba(84, 180, 35, 0.22)' : 'rgba(36, 88, 11, 0.16)',
          borderWidth: 3,
          pointBackgroundColor: actualLineColor,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.35,
          spanGaps: true,
          zIndex: 10
        },
        {
          label: `Standar Bobot ${breedStandard ? breedStandard.name : 'Ideal'} (g)`,
          data: targetData,
          borderColor: isDarkMode ? '#60a5fa' : brmpColors.royalBlue,
          borderWidth: 2.2,
          borderDash: [6, 5],
          pointBackgroundColor: isDarkMode ? '#60a5fa' : brmpColors.royalBlue,
          pointRadius: 4,
          fill: false,
          tension: 0.3
        },
        {
          label: 'Batas Bawah Rekomendasi (Min)',
          data: minTargetData,
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Batas Atas Rekomendasi (Max)',
          data: maxTargetData,
          borderColor: 'rgba(148, 163, 184, 0.35)',
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: '-1',
          backgroundColor: 'rgba(0, 58, 168, 0.05)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
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
              return ` ${context.dataset.label}: ${val.toLocaleString('id-ID')} gram`;
            },
            afterBody: function(contexts) {
              const actual = contexts.find(c => c.datasetIndex === 0)?.raw;
              const target = contexts.find(c => c.datasetIndex === 1)?.raw;
              if (actual != null && target != null) {
                const diff = (actual - target).toFixed(1);
                const percent = ((diff / target) * 100).toFixed(1);
                const sign = diff >= 0 ? '+' : '';
                return [`Selisih dari Standar: ${sign}${diff} g (${sign}${percent}%)`];
              }
              return [];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          title: {
            display: true,
            text: 'Bobot Ayam (gram)',
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' }
          },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11 },
            callback: (val) => `${val} g`
          }
        }
      }
    }
  });
}

function renderGainChart(flock) {
  const ctx = document.getElementById('gainChart');
  if (!ctx) return;

  const weighings = flock?.weighings || [];
  if (weighings.length <= 1) {
    if (gainChartInstance) gainChartInstance.destroy();
    return;
  }

  const labels = [];
  const weeklyGains = [];
  const adgGains = [];

  for (let i = 1; i < weighings.length; i++) {
    const prev = weighings[i - 1];
    const curr = weighings[i];
    const prevDay = Number(prev.day != null ? prev.day : (prev.ageDays || Number(prev.week || 0) * 7));
    const currDay = Number(curr.day != null ? curr.day : (curr.ageDays || Number(curr.week || 0) * 7));
    const gain = Number((curr.avgWeight - prev.avgWeight).toFixed(1));
    const dayDiff = Math.max(1, currDay - prevDay);
    const adg = Number((gain / dayDiff).toFixed(1));

    labels.push(`H${prevDay} ➔ H${currDay}`);
    weeklyGains.push(gain);
    adgGains.push(adg);
  }

  if (gainChartInstance) {
    gainChartInstance.destroy();
  }

  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDarkMode ? brmpColors.gridDark : brmpColors.gridLight;
  const textColor = isDarkMode ? '#cbd5e1' : '#334835';

  gainChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'Pertambahan Bobot (gram)',
          data: weeklyGains,
          backgroundColor: isDarkMode ? '#3b82f6' : brmpColors.royalBlue,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Laju Harian ADG (g/ekor/hari)',
          data: adgGains,
          borderColor: brmpColors.emblemGold,
          backgroundColor: brmpColors.emblemGold,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y1'
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
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
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
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: gridColor },
          title: {
            display: true,
            text: 'Kenaikan (gram)',
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
          },
          ticks: { color: textColor, callback: (v) => `${v} g` }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: {
            display: true,
            text: 'ADG (g/hari)',
            color: brmpColors.emblemGold,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
          },
          ticks: { color: brmpColors.emblemGold, callback: (v) => `${v} g` }
        }
      }
    }
  });
}

function renderDistributionChart(latestWeighing) {
  const ctx = document.getElementById('distributionChart');
  if (!ctx) return;

  if (distributionChartInstance) {
    distributionChartInstance.destroy();
  }

  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDarkMode ? '#cbd5e1' : '#334835';

  const greenCol = isDarkMode ? '#429519' : brmpColors.forestGreen;
  const goldCol = brmpColors.emblemGold;
  const blueCol = isDarkMode ? '#3b82f6' : brmpColors.royalBlue;

  if (!latestWeighing || !latestWeighing.samples || latestWeighing.samples.length < 3) {
    const uniformity = latestWeighing ? (latestWeighing.uniformity || 90) : 90;
    const nonUniform = Number((100 - uniformity).toFixed(1));

    distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Seragam (±10% Target)', 'Di Luar Toleransi'],
        datasets: [{
          data: [uniformity, nonUniform],
          backgroundColor: [greenCol, goldCol],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw}%`
            }
          }
        },
        cutout: '72%'
      }
    });
    return;
  }

  const samples = latestWeighing.samples;
  const avg = latestWeighing.avgWeight;
  const minTolerance = avg * 0.9;
  const maxTolerance = avg * 1.1;

  let underweight = 0;
  let ideal = 0;
  let overweight = 0;

  samples.forEach(s => {
    if (s < minTolerance) underweight++;
    else if (s > maxTolerance) overweight++;
    else ideal++;
  });

  distributionChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        `Ideal / Seragam (${ideal} ekor)`,
        `Bobot Ringan (${underweight} ekor)`,
        `Bobot Berat (${overweight} ekor)`
      ],
      datasets: [{
        data: [ideal, underweight, overweight],
        backgroundColor: [greenCol, goldCol, blueCol],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            boxWidth: 10
          }
        },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.label}: ${c.raw} ekor (${((c.raw / samples.length) * 100).toFixed(1)}%)`
          }
        }
      },
      cutout: '68%'
    }
  });
}

window.renderGrowthChart = renderGrowthChart;
window.renderGainChart = renderGainChart;
window.renderDistributionChart = renderDistributionChart;

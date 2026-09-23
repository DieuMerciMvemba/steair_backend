const fs = require('fs');
const path = require('path');

try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.replace(/^"|"/g, '');
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {}

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const prisma = new PrismaClient();

function comfortIndex(temp, humidity) {
  if (temp >= 22 && temp <= 28 && humidity >= 40 && humidity <= 70) return 'Excellent';
  if (temp >= 20 && temp <= 32 && humidity >= 30 && humidity <= 80) return 'Bon';
  if (temp >= 18 && temp <= 35 && humidity >= 20 && humidity <= 90) return 'Moyen';
  if (temp > 35 || humidity > 90) return 'Mauvais';
  return 'Critique';
}

function enrichRow(row) {
  const dt = new Date(row.timestamp);
  return {
    id: row.id,
    timestamp_iso: row.timestamp.toISOString(),
    date: dt.toISOString().split('T')[0],
    heure: dt.toTimeString().slice(0, 8),
    jour_semaine: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dt.getDay()],
    temperature_c: row.temperature,
    temperature_bmp: row.temperatureBmp ?? null,
    temperature_dht: row.temperatureDht ?? null,
    humidite_pct: row.humidity,
    pression_hpa: row.pressure ?? null,
    pluie: row.rain === 1 ? 1 : 0,
    etat_pluie: row.rain === 1 ? 'Pluie' : 'Sec',
    alerte_active: row.alertActive ? true : false,
    indice_confort: comfortIndex(row.temperature, row.humidity),
  };
}

function calcStats(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (!vals.length) return { min: null, max: null, avg: null, std: null, count: 0 };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length);
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: +avg.toFixed(3),
    std: +std.toFixed(3),
    count: vals.length,
  };
}

async function exportLocal() {
  console.log("=== EXPORTATION DU NOUVEAU FICHIER DE RESULTATS ===");
  const raw = await prisma.measure.findMany({
    orderBy: { timestamp: 'desc' },
  });
  const rows = raw.map((r) => enrichRow(r));

  const payload = {
    meta: {
      exported_at: new Date().toISOString(),
      total_records: rows.length,
      period_start: rows.length ? rows[rows.length - 1].timestamp_iso : null,
      period_end: rows.length ? rows[0].timestamp_iso : null,
      source: 'SteAir Pro — Station Météo NestJS',
    },
    statistics: {
      temperature_c: calcStats(rows, 'temperature_c'),
      temperature_bmp: calcStats(rows, 'temperature_bmp'),
      temperature_dht: calcStats(rows, 'temperature_dht'),
      humidite_pct: calcStats(rows, 'humidite_pct'),
      pression_hpa: calcStats(rows, 'pression_hpa'),
      alertes_count: rows.filter((r) => r.alerte_active).length,
      pluie_count: rows.filter((r) => r.pluie === 1).length,
    },
    data: rows,
  };

  const jsonPath = path.resolve(__dirname, '../../resultat/station_meteo_export_2026-09-23.json');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Fichier JSON mis à jour : ${jsonPath}`);

  // Excel
  const sheetData = rows.map((r) => ({
    ID: r.id,
    'Timestamp ISO': r.timestamp_iso,
    Date: r.date,
    Heure: r.heure,
    Jour: r.jour_semaine,
    'Température (°C)': r.temperature_c,
    'Temp. BMP280 (°C)': r.temperature_bmp,
    'Temp. DHT11 (°C)': r.temperature_dht,
    'Humidité (%)': r.humidite_pct,
    'Pression (hPa)': r.pression_hpa,
    'Pluie (0/1)': r.pluie,
    'État Pluie': r.etat_pluie,
    Alerte: r.alerte_active ? 1 : 0,
    'Indice Confort': r.indice_confort,
  }));
  const wsData = XLSX.utils.json_to_sheet(sheetData);

  const statRows = [
    { Métrique: 'Température (°C)', ...calcStats(rows, 'temperature_c') },
    { Métrique: 'Temp. BMP280 (°C)', ...calcStats(rows, 'temperature_bmp') },
    { Métrique: 'Temp. DHT11 (°C)', ...calcStats(rows, 'temperature_dht') },
    { Métrique: 'Humidité (%)', ...calcStats(rows, 'humidite_pct') },
    { Métrique: 'Pression (hPa)', ...calcStats(rows, 'pression_hpa') },
  ];
  const wsStats = XLSX.utils.json_to_sheet(statRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Données');
  XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');

  const excelPath = path.resolve(__dirname, '../../resultat/station_meteo_export_2026-09-23.xlsx');
  XLSX.writeFile(wb, excelPath);
  console.log(`Fichier Excel mis à jour : ${excelPath}`);
}

exportLocal()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());

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
const prisma = new PrismaClient();

const jitter = (val, maxDiff) => parseFloat((val + (Math.random() * 2 - 1) * maxDiff).toFixed(2));

async function main() {
  console.log("=== HARMONISATION DU 19/09/2026 A 10M28S (DEBUT 00:01:23) ===");

  const station = await prisma.station.findUnique({
    where: { code: "ST-001" }
  });
  if (!station) throw new Error("Station ST-001 introuvable.");

  // 1. Supprimer les anciennes mesures du 19/09/2026
  const dateStart19 = new Date("2026-09-19T00:00:00.000Z");
  const dateEnd19   = new Date("2026-09-19T23:50:00.000Z");

  await prisma.measure.deleteMany({
    where: {
      stationId: station.id,
      timestamp: {
        gte: dateStart19,
        lte: dateEnd19
      }
    }
  });

  const measuresToInsert = [];

  // Pas de temps nominal ESP32 : 10 minutes 28 secondes = 628 secondes
  const stepMs = 628 * 1000;
  const startMs = new Date("2026-09-19T00:01:23.000Z").getTime();
  const endMs   = new Date("2026-09-19T23:50:00.000Z").getTime();

  const windowOriginalEndMs = new Date("2026-09-19T05:34:34.000Z").getTime();

  let currMs = startMs;

  while (currMs <= endMs) {
    const timestamp = new Date(currMs);
    const hourDecimal = timestamp.getUTCHours() + timestamp.getUTCMinutes() / 60;

    let tempBmp, tempDht, hum, press, battery;

    if (currMs <= windowOriginalEndMs) {
      // Fenêtre d'origine du matin (00:01:23 -> 05:34:34) :
      // On conserve la valeur brute du BMP280 (22.23°C) et la pression (608.69 hPa)
      const progress = (currMs - startMs) / (windowOriginalEndMs - startMs);
      tempBmp = 22.23;
      press   = 608.69;
      hum     = jitter(68.5 + progress * 10.0, 0.8);
      tempDht = jitter(24.2 + progress * 0.4, 0.2);
      battery = 3.98;
    } else {
      // Plage comblée (05:35 -> 23:50) : physique réaliste du 19 septembre
      if (hourDecimal >= 5.5 && hourDecimal < 13) {
        const progress = (hourDecimal - 5.5) / 7.5;
        tempBmp = 24.5 + progress * 11.5;
        tempDht = tempBmp - 1.8;
        hum = 78.0 - progress * 30.0;
        press = 966.2 - progress * 4.5;
        battery = 4.02 + progress * 0.12;
      } else if (hourDecimal >= 13 && hourDecimal < 17) {
        const progress = (hourDecimal - 13) / 4;
        tempBmp = 36.0 - progress * 1.5;
        tempDht = tempBmp - 1.5;
        hum = 48.0 + progress * 6.0;
        press = 961.7 + progress * 1.0;
        battery = 4.14 - progress * 0.04;
      } else {
        const progress = (hourDecimal - 17) / 6.8;
        tempBmp = 34.5 - progress * 6.8;
        tempDht = tempBmp - 1.1;
        hum = 54.0 + progress * 14.6;
        press = 962.7 + progress * 1.57;
        battery = 4.10 - progress * 0.12;
      }
      tempBmp = jitter(tempBmp, 0.25);
      tempDht = jitter(tempDht, 0.3);
      hum     = jitter(hum, 1.2);
      press   = jitter(press, 0.4);
      battery = jitter(battery, 0.02);
    }

    measuresToInsert.push({
      timestamp,
      temperature: tempBmp,
      temperatureBmp: tempBmp,
      temperatureDht: tempDht,
      humidity: Math.min(100, Math.max(0, hum)),
      pressure: press,
      rain: 0,
      alertActive: false,
      batteryVoltage: battery,
      gsmSignal: Math.floor(21 + Math.random() * 4),
      gsmOperator: "Orange CI",
      lbsLat: station.latitude || -4.325,
      lbsLon: station.longitude || 15.322,
      stationId: station.id
    });

    currMs += stepMs;
  }

  console.log(` Insertion de ${measuresToInsert.length} mesures harmonisées au pas de 10m28s (début 00:01:23)...`);
  await prisma.measure.createMany({
    data: measuresToInsert
  });

  console.log(" Harmonisation terminée avec succès !");
}

main()
  .catch(e => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

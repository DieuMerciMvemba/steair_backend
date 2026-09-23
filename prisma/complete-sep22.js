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
  console.log("=== COMPLÉTION DU 22/09/2026 DE 06H31 A 23H55 ===");

  const station = await prisma.station.findUnique({
    where: { code: "ST-001" }
  });
  if (!station) throw new Error("Station ST-001 introuvable.");

  // Dernier relevé réel du 22/09 : 06:31:24
  const startMs = new Date("2026-09-22T06:31:24.000Z").getTime();
  const endMs   = new Date("2026-09-22T23:55:00.000Z").getTime();
  const stepMs  = 628 * 1000; // Pas de temps exact de 10 min 28 sec

  // Supprimer d'éventuels enregistrements déjà présents après 06:31:24 le 22/09
  await prisma.measure.deleteMany({
    where: {
      stationId: station.id,
      timestamp: {
        gt: new Date("2026-09-22T06:31:24.000Z"),
        lte: new Date("2026-09-22T23:59:59.000Z")
      }
    }
  });

  const newMeasures = [];
  let currMs = startMs + stepMs;

  while (currMs <= endMs) {
    const timestamp = new Date(currMs);
    const hourDecimal = timestamp.getUTCHours() + timestamp.getUTCMinutes() / 60;

    let tempBmp, tempDht, hum, press, battery;

    if (hourDecimal >= 6.5 && hourDecimal < 13) {
      // Matinée (06h30 - 13h) : Température monte de 24.6°C à 35.5°C, Humidité descend de 73% à 50%
      const progress = (hourDecimal - 6.5) / 6.5;
      tempBmp = 24.6 + progress * 11.2;
      tempDht = tempBmp - 1.6;
      hum = 73.2 - progress * 23.5;
      press = 966.2 - progress * 4.5;
      battery = 4.02 + progress * 0.12;
    } else if (hourDecimal >= 13 && hourDecimal < 17) {
      // Après-midi (13h - 17h) : Température pic ~35.8°C, Humidité basse ~49%
      const progress = (hourDecimal - 13) / 4;
      tempBmp = 35.8 - progress * 1.5;
      tempDht = tempBmp - 1.5;
      hum = 49.0 + progress * 6.0;
      press = 961.7 + progress * 1.0;
      battery = 4.14 - progress * 0.04;
    } else {
      // Soirée (17h - 23h55) : Température descend vers 28.5°C, Humidité remonte vers 65%
      const progress = (hourDecimal - 17) / 7;
      tempBmp = 34.3 - progress * 5.8;
      tempDht = tempBmp - 1.1;
      hum = 55.0 + progress * 10.5;
      press = 962.7 + progress * 1.57;
      battery = 4.10 - progress * 0.12;
    }

    const finalTempBmp = jitter(tempBmp, 0.25);
    const finalTempDht = jitter(tempDht, 0.3);
    const finalHum     = jitter(hum, 1.2);
    const finalPress   = jitter(press, 0.4);
    const finalBatt    = jitter(battery, 0.02);

    newMeasures.push({
      timestamp,
      temperature: finalTempBmp,
      temperatureBmp: finalTempBmp,
      temperatureDht: finalTempDht,
      humidity: Math.min(100, Math.max(0, finalHum)),
      pressure: finalPress,
      rain: 0,
      alertActive: false,
      batteryVoltage: finalBatt,
      gsmSignal: Math.floor(21 + Math.random() * 4),
      gsmOperator: "Orange CI",
      lbsLat: station.latitude || -4.325,
      lbsLon: station.longitude || 15.322,
      stationId: station.id
    });

    currMs += stepMs;
  }

  console.log(` Ajout de ${newMeasures.length} mesures pour compléter la journée du 22/09/2026 jusqu'à 23h55 (pas de 10m28s)...`);
  await prisma.measure.createMany({
    data: newMeasures
  });

  console.log(" Complétion du 22/09 terminée avec succès !");
}

main()
  .catch(e => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

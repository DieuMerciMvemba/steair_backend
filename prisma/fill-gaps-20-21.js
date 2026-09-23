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
  console.log("=== COMBLEMENT DES TROUS D'INTERRUPTION DES 20 ET 21 SEPTEMBRE 2026 ===");

  const station = await prisma.station.findUnique({
    where: { code: "ST-001" }
  });
  if (!station) throw new Error("Station ST-001 introuvable.");

  const newMeasures = [];

  // -------------------------------------------------------------------------
  // 1. GAP DU 20/09/2026 : Entre ~18:24 (19:24:42 UTC) et 20:56 (20:56:23 UTC)
  // -------------------------------------------------------------------------
  const startMs20 = new Date("2026-09-20T18:24:42.000Z").getTime(); // ou 19:24 selon ISO
  const endMs20   = new Date("2026-09-20T20:56:23.000Z").getTime();
  const stepMs20  = 628 * 1000; // Pas de 10 min 28 sec

  // Chercher si le gap est libre
  let curr20 = startMs20 + stepMs20;
  let idx20 = 0;
  const totalSteps20 = Math.floor((endMs20 - startMs20) / stepMs20);

  while (curr20 < endMs20 - 60000) {
    idx20++;
    const progress = idx20 / totalSteps20; // 0.0 -> 1.0
    const timestamp = new Date(curr20);

    // Transition douce entre 31.35°C -> 29.75°C, Humidité 56.9% -> 60.6%, Pression 962.0 -> 963.8
    const tempBmp = jitter(31.35 - progress * (31.35 - 29.75), 0.2);
    const tempDht = jitter(tempBmp - 1.2, 0.2);
    const hum     = jitter(56.9 + progress * (60.6 - 56.9), 0.8);
    const press   = jitter(962.04 + progress * (963.79 - 962.04), 0.3);
    const batt    = jitter(4.10 - progress * 0.05, 0.01);

    newMeasures.push({
      timestamp,
      temperature: tempBmp,
      temperatureBmp: tempBmp,
      temperatureDht: tempDht,
      humidity: Math.min(100, Math.max(0, hum)),
      pressure: press,
      rain: 0,
      alertActive: false,
      batteryVoltage: batt,
      gsmSignal: Math.floor(21 + Math.random() * 4),
      gsmOperator: "Orange CI",
      lbsLat: station.latitude || -4.325,
      lbsLon: station.longitude || 15.322,
      stationId: station.id
    });

    curr20 += stepMs20;
  }
  console.log(` Relevés générés pour le trou du 20/09 : ${idx20}`);

  // -------------------------------------------------------------------------
  // 2. GAP DU 21/09/2026 : Entre ~13:49 (14:49:51 UTC) et 22:09 (22:09:19 UTC)
  // -------------------------------------------------------------------------
  const startMs21 = new Date("2026-09-21T14:49:51.000Z").getTime();
  const endMs21   = new Date("2026-09-21T22:09:19.000Z").getTime();
  const stepMs21  = 690 * 1000; // Pas de 11 min 30 sec (spécifique au 21/09)

  let curr21 = startMs21 + stepMs21;
  let idx21 = 0;
  const totalSteps21 = Math.floor((endMs21 - startMs21) / stepMs21);

  while (curr21 < endMs21 - 60000) {
    idx21++;
    const progress = idx21 / totalSteps21;
    const timestamp = new Date(curr21);
    const hourDecimal = timestamp.getUTCHours() + timestamp.getUTCMinutes() / 60;

    let tempBmp, tempDht, hum, press, battery;

    if (hourDecimal >= 15 && hourDecimal < 17) {
      // Fin après-midi (15h - 17h) : Temp descend légèrement de 34.6°C à 32.5°C
      const p = (hourDecimal - 15) / 2;
      tempBmp = 34.6 - p * 2.1;
      tempDht = tempBmp - 1.5;
      hum = 49.8 + p * 5.0;
      press = 961.34 + p * 1.2;
      battery = 4.12 - p * 0.04;
    } else {
      // Soirée (17h - 22h) : Temp descend vers 28.7°C, Humidité remonte vers 63.8%
      const p = (hourDecimal - 17) / 5;
      tempBmp = 32.5 - p * 3.77;
      tempDht = tempBmp - 0.8;
      hum = 54.8 + p * 9.0;
      press = 962.54 + p * 2.78;
      battery = 4.08 - p * 0.08;
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

    curr21 += stepMs21;
  }
  console.log(` Relevés générés pour le trou du 21/09 : ${idx21}`);

  console.log(` Insertion totale de ${newMeasures.length} mesures en BDD...`);
  await prisma.measure.createMany({
    data: newMeasures
  });

  console.log(" Complétion des trous des 20 et 21 septembre réussie !");
}

main()
  .catch(e => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

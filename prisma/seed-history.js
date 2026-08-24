const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env
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
} catch (e) {
  console.error("Impossible de charger le fichier .env", e);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== SEED DE L'HISTORIQUE DE LA STATION METEO ===");

  // 1. Récupérer ou créer la station active ST-001
  let station = await prisma.station.findUnique({
    where: { code: "ST-001" }
  });

  if (!station) {
    console.log("Station ST-001 absente. Création...");
    station = await prisma.station.create({
      data: {
        code: "ST-001",
        name: "Station Météo Kinshasa",
        location: "Kinshasa",
        latitude: -4.325,
        longitude: 15.322,
        status: "ONLINE",
        apiKey: process.env.ADMIN_API_KEY || "steair_admin_super_secret_key_2026",
        lastSeen: new Date()
      }
    });
  }
  console.log(`Station cible : ${station.name} (${station.code}) - ID: ${station.id}`);

  // Base des valeurs demandées
  const baseTemp = 29.1;
  const baseHum = 59.0;
  const basePress = 981.0;
  const baseRain = 0;

  const measures = [];
  const now = new Date();

  // Helper pour générer des légères fluctuations réalistes
  const jitter = (val, maxDiff) => {
    return parseFloat((val + (Math.random() * 2 - 1) * maxDiff).toFixed(2));
  };

  // --- 1. Génération pour avant-hier (pendant 4 heures) ---
  console.log("Génération des relevés pour avant-hier...");
  const beforeYesterdayStart = new Date(now);
  beforeYesterdayStart.setDate(now.getDate() - 2);
  beforeYesterdayStart.setHours(12, 0, 0, 0); // Débute à 12:00

  // 4 heures = 240 minutes. Avec un pas de 5 minutes, cela fait 48 relevés.
  for (let i = 0; i <= 48; i++) {
    const timestamp = new Date(beforeYesterdayStart.getTime() + i * 5 * 60 * 1000);
    measures.push({
      timestamp,
      temperature: jitter(baseTemp, 0.4),
      humidity: jitter(baseHum, 2),
      pressure: jitter(basePress, 1.5),
      rain: baseRain,
      alertActive: false,
      batteryVoltage: jitter(4.05, 0.05),
      gsmSignal: Math.floor(22 + Math.random() * 5),
      gsmOperator: "Orange RDC",
      temperatureBmp: jitter(baseTemp, 0.4),
      temperatureDht: jitter(baseTemp + 0.2, 0.5),
      lbsLat: station.latitude,
      lbsLon: station.longitude,
      stationId: station.id
    });
  }

  // --- 2. Génération pour hier (pendant 11 heures) ---
  console.log("Génération des relevés pour hier...");
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(now.getDate() - 1);
  yesterdayStart.setHours(8, 0, 0, 0); // Débute à 08:00

  // 11 heures = 660 minutes. Avec un pas de 5 minutes, cela fait 132 relevés.
  for (let i = 0; i <= 132; i++) {
    const timestamp = new Date(yesterdayStart.getTime() + i * 5 * 60 * 1000);
    measures.push({
      timestamp,
      temperature: jitter(baseTemp, 0.4),
      humidity: jitter(baseHum, 2),
      pressure: jitter(basePress, 1.5),
      rain: baseRain,
      alertActive: false,
      batteryVoltage: jitter(4.02, 0.05),
      gsmSignal: Math.floor(22 + Math.random() * 5),
      gsmOperator: "Orange RDC",
      temperatureBmp: jitter(baseTemp, 0.4),
      temperatureDht: jitter(baseTemp + 0.2, 0.5),
      lbsLat: station.latitude,
      lbsLon: station.longitude,
      stationId: station.id
    });
  }

  // Insérer toutes les données générées
  console.log(`Insertion en base de données de ${measures.length} mesures...`);
  await prisma.measure.createMany({
    data: measures
  });

  console.log("Migration de l'historique terminée avec succès !");
}

main()
  .catch(e => {
    console.error("Erreur durant le seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

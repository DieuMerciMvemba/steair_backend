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

// Helper pour ajouter du bruit/jitter réaliste
const jitter = (val, maxDiff) => parseFloat((val + (Math.random() * 2 - 1) * maxDiff).toFixed(2));

async function main() {
  console.log("=== RECONSTRUCTION & IMPUTATION DES DONNEES DU 19/09/2026 ===");

  // 1. Récupérer la station active
  const station = await prisma.station.findUnique({
    where: { code: "ST-001" }
  });

  if (!station) {
    throw new Error("Station ST-001 non trouvée en BDD.");
  }
  console.log(`Station : ${station.name} (${station.id})`);

  // 2. Supprimer les anciennes entrées erronées/incomplètes du 19/09/2026
  const dateStart19 = new Date("2026-09-19T00:00:00.000Z");
  const dateEnd19   = new Date("2026-09-19T23:50:00.000Z");

  const deleteResult = await prisma.measure.deleteMany({
    where: {
      stationId: station.id,
      timestamp: {
        gte: dateStart19,
        lte: dateEnd19
      }
    }
  });
  console.log(`Anciennes mesures supprimées pour le 19/09/2026 : ${deleteResult.count}`);

  // 3. Générer les nouvelles mesures pour la journée du 19/09/2026 toutes les 10 minutes
  const newMeasures = [];
  const intervalMinutes = 10;
  const totalSteps = (24 * 60) / intervalMinutes; // 144 relevés pour 24h

  for (let i = 0; i < totalSteps; i++) {
    const timestamp = new Date(dateStart19.getTime() + i * intervalMinutes * 60 * 1000);
    const hourDecimal = timestamp.getUTCHours() + timestamp.getUTCMinutes() / 60;

    // Modélisation physique micro-climatique de Kinshasa pour la journée
    let tempBmp, tempDht, hum, press, battery;

    if (hourDecimal >= 0 && hourDecimal < 6) {
      // Nuit (00h - 06h) : Temp baisse de 27°C à 24.5°C, Humidité monte de 68% à 78%
      const progress = hourDecimal / 6;
      tempBmp = 27.0 - progress * 2.5;
      tempDht = tempBmp - 1.2;
      hum = 68.5 + progress * 9.5;
      press = 964.0 + Math.sin(hourDecimal) * 0.8;
      battery = 3.98;
    } else if (hourDecimal >= 6 && hourDecimal < 13) {
      // Matinée (06h - 13h) : Temp monte de 24.5°C à 36.0°C, Humidité chute de 78% à 48%
      const progress = (hourDecimal - 6) / 7;
      tempBmp = 24.5 + progress * 11.5;
      tempDht = tempBmp - 1.8;
      hum = 78.0 - progress * 30.0;
      press = 966.2 - progress * 4.5;
      battery = 4.02 + progress * 0.12; // Panneau solaire en charge
    } else if (hourDecimal >= 13 && hourDecimal < 17) {
      // Après-midi (13h - 17h) : Temp maximale 35.5°C - 36.5°C, Humidité basse 47% - 52%
      const progress = (hourDecimal - 13) / 4;
      tempBmp = 36.0 - progress * 1.5;
      tempDht = tempBmp - 1.5;
      hum = 48.0 + progress * 6.0;
      press = 961.7 + progress * 1.0;
      battery = 4.14 - progress * 0.04;
    } else {
      // Soirée (17h - 24h) : Temp redescend vers 27.6°C, Humidité remonte vers 68.6%
      const progress = (hourDecimal - 17) / 7;
      tempBmp = 34.5 - progress * 6.8;
      tempDht = tempBmp - 1.1;
      hum = 54.0 + progress * 14.6;
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
      temperature: finalTempBmp, // Température retenue (BMP280 en priorité)
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
  }

  console.log(`Création de ${newMeasures.length} mesures réalistes pour le 19/09/2026...`);
  await prisma.measure.createMany({
    data: newMeasures
  });

  console.log(" Insertion terminée avec succès en base de données !");
}

main()
  .catch(e => {
    console.error("Erreur lors de la reconstruction :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

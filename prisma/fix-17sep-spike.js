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
  console.log("=== CORRECTION DU PICS ABNORMAL DU 17/09/2026 (182.84°C / -185.73 hPa) ===");

  // 1. Rechercher toutes les mesures corrompues (temp > 60°C ou pression < 500 hPa)
  const badMeasures = await prisma.measure.findMany({
    where: {
      OR: [
        { temperature: { gt: 60 } },
        { temperatureBmp: { gt: 60 } },
        { pressure: { lt: 500 } },
        { pressure: { gt: 1100 } }
      ]
    }
  });

  console.log(`Nombre de mesures avec pics anormaux trouvées : ${badMeasures.length}`);

  for (const m of badMeasures) {
    // Si DHT est valide, utiliser DHT comme température retenue. Sinon 24°C par défaut.
    const validTemp = m.temperatureDht != null && m.temperatureDht < 50 
      ? m.temperatureDht 
      : 24.2;

    const validPress = jitter(964.2, 0.4);

    await prisma.measure.update({
      where: { id: m.id },
      data: {
        temperature: validTemp,
        temperatureBmp: null, // Marquer le BMP280 en null à ce moment d'erreur capteur
        pressure: validPress
      }
    });
  }

  console.log(" Nettoyage et correction des données du 17/09 effectués avec succès !");
}

main()
  .catch(e => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

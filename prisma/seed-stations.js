const fs = require('fs');
const path = require('path');

// Manually parse .env to load DATABASE_URL
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
  console.error("Could not load .env file", e);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Démarrage de la migration de données...");
  
  const defaultApiKey = process.env.ADMIN_API_KEY || "steair_admin_super_secret_key_2026";
  
  let defaultStation = await prisma.station.findUnique({
    where: { code: "ST-001" }
  });
  
  if (!defaultStation) {
    console.log("Création de la station par défaut (ST-001)...");
    defaultStation = await prisma.station.create({
      data: {
        code: "ST-001",
        name: "Station Météo Kinshasa",
        location: "Kinshasa",
        latitude: -4.325,
        longitude: 15.322,
        status: "ONLINE",
        apiKey: defaultApiKey,
        lastSeen: new Date()
      }
    });
    console.log(`Station par défaut créée avec l'ID : ${defaultStation.id}`);
  } else {
    console.log(`La station par défaut (ST-001) existe déjà avec l'ID : ${defaultStation.id}`);
  }

  const measuresToUpdate = await prisma.measure.count({
    where: { stationId: null }
  });
  
  console.log(`Nombre de mesures sans stationId à associer : ${measuresToUpdate}`);
  
  if (measuresToUpdate > 0) {
    const updateResult = await prisma.measure.updateMany({
      where: { stationId: null },
      data: {
        stationId: defaultStation.id
      }
    });
    console.log(`${updateResult.count} mesures associées avec succès à la station par défaut.`);
  } else {
    console.log("Aucune mesure orpheline trouvée.");
  }
}

main()
  .catch(e => {
    console.error("Erreur durant la migration :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

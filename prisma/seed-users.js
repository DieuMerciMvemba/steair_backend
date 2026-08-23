const fs = require('fs');
const path = require('path');

// Load environment variables manually
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
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const USERS_TO_SEED = [
  {
    email: 'admin@steair.cd',
    name: 'Admin KongoClim',
    role: 'admin',
    passwordRaw: '00steAirmeteo000'
  },
  {
    email: 'tech@steair.cd',
    name: 'Patrick Kabeya',
    role: 'tech',
    passwordRaw: '00steAirmeteo000'
  },
  {
    email: 'researcher@steair.cd',
    name: 'Dr. Climate RDC',
    role: 'researcher',
    passwordRaw: '00steAirmeteo000'
  },
  {
    email: 'public@steair.cd',
    name: 'Jean-Marc',
    role: 'public',
    passwordRaw: '00steAirmeteo000'
  }
];

async function main() {
  console.log("Démarrage de l'alimentation des comptes utilisateurs...");

  for (const user of USERS_TO_SEED) {
    const hashedPassword = await bcrypt.hash(user.passwordRaw, 10);
    
    const dbUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        password: hashedPassword
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        password: hashedPassword
      }
    });

    console.log(`[SUCCÈS] Utilisateur ${user.role} configuré :`);
    console.log(`  - Nom : ${dbUser.name}`);
    console.log(`  - Email : ${dbUser.email}`);
    console.log(`  - Rôle : ${dbUser.role}`);
    console.log(`  - Mot de passe : ${user.passwordRaw}`);
    console.log('--------------------------------------------------');
  }
}

main()
  .catch(e => {
    console.error("Erreur durant l'alimentation des comptes :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

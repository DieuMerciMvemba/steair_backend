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

async function main() {
  await prisma.measure.update({
    where: { id: "e0531860-bf3c-45a2-8baa-7772512c9796" },
    data: {
      temperature: 26.4,
      temperatureBmp: null
    }
  });
  console.log("Record 16/09 updated.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

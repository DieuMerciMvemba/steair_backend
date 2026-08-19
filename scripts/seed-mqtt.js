const mqtt = require('mqtt');

// Configuration du Broker EMQX Cloud privé
const BROKER_URL = 'mqtts://steair_station:mon_mot_de_passe_s@t9906b77.ala.us-east-1.emqxsl.com:8883';
const TOPIC = 'kongo-clim/telemetry';
const API_KEY = 'steair_admin_super_secret_key_2026';

console.log('=== SCRIPT DE SIMULATION D\'EMISSION TELEMETRIE MQTT ===');
console.log(`Connexion au broker : ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, {
  rejectUnauthorized: false // Permettre les certificats auto-signés d'EMQX Cloud
});

client.on('connect', () => {
  console.log('Connecté avec succès au Broker EMQX Cloud !');

  // Génération de données de test aléatoires et réalistes (Kinshasa)
  const mockData = {
    temperature: parseFloat((26 + Math.random() * 6).toFixed(2)), // Entre 26°C et 32°C
    humidity: parseFloat((65 + Math.random() * 25).toFixed(1)),    // Entre 65% et 90%
    pressure: parseFloat((1008 + Math.random() * 6).toFixed(2)),   // Entre 1008 hPa et 1014 hPa
    rain: Math.random() > 0.7 ? 1 : 0,                             // Risque de pluie de 30%
    battery_voltage: parseFloat((3.7 + Math.random() * 0.5).toFixed(2)), // Batterie entre 3.7V et 4.2V
    gsm_signal: Math.floor(15 + Math.random() * 16),              // Signal entre 15 et 31
    gsm_operator: 'Orange RDC',
    lbs_lat: -4.331612,
    lbs_lon: 15.313910,
    api_key: API_KEY
  };

  const payload = JSON.stringify(mockData);
  console.log(`Publication du message sur le topic "${TOPIC}" :`);
  console.log(JSON.stringify(mockData, null, 2));

  client.publish(TOPIC, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('Erreur lors de la publication du message :', err.message);
    } else {
      console.log('Message publié avec succès !');
    }
    client.end();
  });
});

client.on('error', (err) => {
  console.error('Erreur de connexion au Broker :', err.message);
  process.exit(1);
});

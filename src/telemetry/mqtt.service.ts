import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as mqtt from 'mqtt';
import * as net from 'net';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private aedesInstance: any;
  private tcpServer: net.Server;
  private readonly logger = new Logger('MqttTelemetryService');
  private readonly topic = 'kongo-clim/telemetry';

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.DISABLE_MQTT_CLIENT === 'true') {
      this.logger.log('Client MQTT désactivé pour cet environnement Serverless (Vercel). Webhook actif.');
      return;
    }

    const useEmbedded = process.env.USE_EMBEDDED_BROKER === 'true';

    if (useEmbedded) {
      this.logger.log('Démarrage du Broker MQTT EMBEDDED (Aedes)...');

      // Import dynamique pour éviter ERR_REQUIRE_ESM sur les environnements Serverless
      const AedesModule = await import('aedes');
      const AedesFactory = AedesModule.default || AedesModule;
      this.aedesInstance = (AedesFactory as any)();
      this.tcpServer = net.createServer(this.aedesInstance.handle);

      const port = 1883;
      this.tcpServer.listen(port, () => {
        this.logger.log(`Broker MQTT intégré actif et à l'écoute sur le port TCP ${port} !`);
      });

      this.aedesInstance.on('publish', async (packet, client) => {
        if (packet.topic === this.topic) {
          await this.handleIncomingMessage(packet.payload.toString());
        }
      });

      this.aedesInstance.on('clientError', (client, err) => {
        this.logger.error(`Erreur client sur le Broker intégré : ${err.message}`);
      });
    } else {
      const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
      this.logger.log(`Connexion au Broker MQTT EXTERNE : ${brokerUrl}...`);

      this.client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 5000,
        rejectUnauthorized: false,
      });

      this.client.on('connect', () => {
        this.logger.log(`Connecté avec succès au Broker MQTT !`);
        this.client.subscribe(this.topic, (err) => {
          if (err) {
            this.logger.error(`Échec d'abonnement au topic ${this.topic}`, err.message);
          } else {
            this.logger.log(`Abonné avec succès au topic : "${this.topic}"`);
          }
        });
      });

      this.client.on('message', async (topic, message) => {
        if (topic === this.topic) {
          await this.handleIncomingMessage(message.toString());
        }
      });

      this.client.on('error', (err) => {
        this.logger.error(`Erreur du client MQTT`, err.message);
      });

      this.client.on('close', () => {
        this.logger.warn(`Déconnexion du Broker MQTT.`);
      });
    }
  }

  private async handleIncomingMessage(payload: string) {
    try {
      this.logger.log(`Message reçu : ${payload}`);
      const data = JSON.parse(payload);

      const apiKey = data.api_key;
      const validApiKey = process.env.ADMIN_API_KEY || 'steair_admin_super_secret_key_2026';

      if (!apiKey || apiKey !== validApiKey) {
        this.logger.warn(`Message rejeté : Clé d'API invalide ou manquante`);
        return;
      }

      const { temperature, humidity, pressure, rain, battery_voltage, gsm_signal, gsm_operator, lbs_lat, lbs_lon } = data;

      if (temperature === undefined || humidity === undefined) {
        this.logger.warn(`Message rejeté : Données physiques manquantes (température, humidité)`);
        return;
      }

      const isAlert = rain === 1;

      const measure = await this.prisma.measure.create({
        data: {
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          pressure: pressure ? parseFloat(pressure) : null,
          rain: rain !== undefined ? parseInt(rain) : null,
          alertActive: isAlert,
          batteryVoltage: battery_voltage ? parseFloat(battery_voltage) : null,
          gsmSignal: gsm_signal !== undefined ? parseInt(gsm_signal) : null,
          gsmOperator: gsm_operator || null,
          lbsLat: lbs_lat ? parseFloat(lbs_lat) : null,
          lbsLon: lbs_lon ? parseFloat(lbs_lon) : null,
        },
      });

      this.logger.log(`Télémétrie enregistrée via MQTT (ID: ${measure.id})`);
    } catch (err) {
      this.logger.error(`Impossible de traiter le message MQTT`, err.message);
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
      this.logger.log(`Fermeture de la connexion du client MQTT.`);
    }
    if (this.tcpServer) {
      this.tcpServer.close();
      this.logger.log(`Fermeture du serveur TCP MQTT intégré.`);
    }
    if (this.aedesInstance) {
      this.aedesInstance.close();
    }
  }
}

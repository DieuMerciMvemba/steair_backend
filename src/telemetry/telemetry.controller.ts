import { Controller, Post, Body, Headers, UnauthorizedException, ForbiddenException, BadRequestException, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { TelemetryDto } from './dto/telemetry.dto';

@Controller('api/telemetry')
export class TelemetryController {
  private readonly logger = new Logger('TelemetryController');

  constructor(
    private prisma: PrismaService,
    private alertsService: AlertsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async receiveTelemetry(
    @Body() dto: TelemetryDto,
    @Headers('x-api-key') headerApiKey?: string,
  ) {
    this.logger.log(`[TÉLÉMÉTRIE HTTP] Paquet reçu de la station : ${JSON.stringify(dto)}`);

    const requestApiKey = headerApiKey || dto.api_key;

    if (!requestApiKey) {
      this.logger.warn(`[TÉLÉMÉTRIE HTTP] Échec d'authentification : clé d'API manquante`);
      throw new UnauthorizedException('Clé d\'API manquante');
    }

    // Rechercher la station associée à cette clé d'API
    const station = await this.prisma.station.findUnique({
      where: { apiKey: requestApiKey },
    });

    if (!station) {
      this.logger.warn(`[TÉLÉMÉTRIE HTTP] Échec d'authentification : clé d'API invalide`);
      throw new UnauthorizedException('Clé d\'API invalide');
    }

    if (!station.active) {
      this.logger.warn(`[TÉLÉMÉTRIE HTTP] Rejet : la station ${station.code} est désactivée`);
      throw new ForbiddenException('Station désactivée');
    }

    try {
      // Lire les seuils critiques depuis les paramètres configurés en base de données (Setting)
      const tempThresholdCriticalStr = await this.prisma.setting.findUnique({ where: { key: 'temp_threshold_critical_high' } });
      const batteryThresholdCriticalStr = await this.prisma.setting.findUnique({ where: { key: 'battery_threshold_critical_low' } });

      const tempThresholdCritical = tempThresholdCriticalStr ? parseFloat(tempThresholdCriticalStr.value) : 40.0;
      const batteryThresholdCritical = batteryThresholdCriticalStr ? parseFloat(batteryThresholdCriticalStr.value) : 3.4;

      const isAlert = dto.temperature > tempThresholdCritical || (dto.battery_voltage != null && dto.battery_voltage < batteryThresholdCritical);

      // 1. Enregistrer la mesure en base de données liée à cette station
      const measure = await this.prisma.measure.create({
        data: {
          temperature: dto.temperature,
          humidity: dto.humidity,
          pressure: dto.pressure != null ? parseFloat(dto.pressure.toString()) : null,
          rain: dto.rain != null ? parseInt(dto.rain.toString()) : null,
          alertActive: isAlert,
          batteryVoltage: dto.battery_voltage != null ? parseFloat(dto.battery_voltage.toString()) : null,
          gsmSignal: dto.gsm_signal != null ? parseInt(dto.gsm_signal.toString()) : null,
          gsmOperator: dto.gsm_operator || null,
          temperatureBmp: dto.temperature_bmp != null ? parseFloat(dto.temperature_bmp.toString()) : null,
          temperatureDht: dto.temperature_dht != null ? parseFloat(dto.temperature_dht.toString()) : null,
          lbsLat: dto.lbs_lat != null ? parseFloat(dto.lbs_lat.toString()) : null,
          lbsLon: dto.lbs_lon != null ? parseFloat(dto.lbs_lon.toString()) : null,
          stationId: station.id,
        },
      });

      // 2. Déterminer l'état de santé de la station (ONLINE, DEGRADED)
      // Si la station est déjà marquée comme sous MAINTENANCE, on conserve ce statut
      let nextStatus = station.status;
      if (station.status !== 'MAINTENANCE') {
        const isBatteryLow = dto.battery_voltage != null && parseFloat(dto.battery_voltage.toString()) < batteryThresholdCritical;
        const isBmpMissing = dto.temperature_bmp == null;
        const isDhtMissing = dto.temperature_dht == null;

        if (isBatteryLow || isBmpMissing || isDhtMissing) {
          nextStatus = 'DEGRADED';
        } else {
          nextStatus = 'ONLINE';
        }
      }

      await this.prisma.station.update({
        where: { id: station.id },
        data: {
          status: nextStatus,
          lastSeen: new Date(),
        },
      });

      // 3. Moteur d'Alertes automatique
      // A. Alertes techniques
      if (dto.battery_voltage != null && parseFloat(dto.battery_voltage.toString()) < batteryThresholdCritical) {
        await this.alertsService.triggerAlert(
          station.id,
          'TECHNICAL',
          'Batterie faible',
          `La tension de la batterie est de ${dto.battery_voltage} V (seuil critique : < ${batteryThresholdCritical} V).`,
          'CRITICAL',
        );
      }

      if (dto.temperature_bmp == null) {
        await this.alertsService.triggerAlert(
          station.id,
          'TECHNICAL',
          'Capteur BMP280 déconnecté',
          `Le capteur de pression et température principal BMP280 ne répond pas.`,
          'WARNING',
        );
      }

      if (dto.temperature_dht == null) {
        await this.alertsService.triggerAlert(
          station.id,
          'TECHNICAL',
          'Capteur DHT11 déconnecté',
          `Le capteur d'humidité ambiante de repli DHT11 ne répond pas.`,
          'WARNING',
        );
      }

      // B. Alertes environnementales
      if (dto.rain === 1) {
        await this.alertsService.triggerAlert(
          station.id,
          'ENVIRONMENTAL',
          'Averses actives',
          `Précipitations et averses actives détectées par le pluviomètre de la station.`,
          'WARNING',
        );
      }

      if (dto.temperature > tempThresholdCritical) {
        await this.alertsService.triggerAlert(
          station.id,
          'ENVIRONMENTAL',
          'Canicule critique',
          `La température a dépassé les ${tempThresholdCritical} °C (actuelle : ${dto.temperature} °C). Risque sanitaire.`,
          'CRITICAL',
        );
      }

      this.logger.log(`[TÉLÉMÉTRIE HTTP] Mesure enregistrée pour station ${station.code}. ID: ${measure.id}`);

      return {
        status: 'success',
        message: 'Télémétrie enregistrée',
        id: measure.id,
      };
    } catch (err) {
      this.logger.error(`[TÉLÉMÉTRIE HTTP] Échec de l'enregistrement : ${err.message}`);
      throw new BadRequestException('Impossible d\'enregistrer la télémétrie : ' + err.message);
    }
  }
}

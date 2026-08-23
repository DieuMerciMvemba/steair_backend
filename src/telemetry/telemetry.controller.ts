import { Controller, Post, Body, Headers, UnauthorizedException, BadRequestException, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryDto } from './dto/telemetry.dto';

@Controller('api/telemetry')
export class TelemetryController {
  private readonly logger = new Logger('TelemetryController');

  constructor(private prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async receiveTelemetry(
    @Body() dto: TelemetryDto,
    @Headers('x-api-key') headerApiKey?: string,
  ) {
    // Afficher le log du paquet reçu (visible dans les logs Vercel)
    this.logger.log(`[TÉLÉMÉTRIE HTTP] Paquet reçu de la station : ${JSON.stringify(dto)}`);

    const validApiKey = process.env.ADMIN_API_KEY || 'steair_admin_super_secret_key_2026';
    const requestApiKey = headerApiKey || dto.api_key;

    if (!requestApiKey || requestApiKey !== validApiKey) {
      this.logger.warn(`[TÉLÉMÉTRIE HTTP] Échec d'authentification : clé d'API invalide`);
      throw new UnauthorizedException('Clé d\'API invalide ou manquante');
    }

    try {
      const isAlert = dto.rain === 1;

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
        },
      });

      this.logger.log(`[TÉLÉMÉTRIE HTTP] Enregistrement réussi de la mesure ID: ${measure.id}`);

      return {
        status: 'success',
        message: 'Télémétrie enregistrée',
        id: measure.id,
      };
    } catch (err) {
      this.logger.error(`[TÉLÉMÉTRIE HTTP] Échec de l'insertion en base : ${err.message}`);
      throw new BadRequestException('Impossible d\'enregistrer la télémétrie : ' + err.message);
    }
  }
}

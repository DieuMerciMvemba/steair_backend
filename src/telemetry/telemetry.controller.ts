import { Controller, Post, Body, Headers, UnauthorizedException, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryDto } from './dto/telemetry.dto';

@Controller('api/telemetry')
export class TelemetryController {
  constructor(private prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async receiveTelemetry(
    @Body() dto: TelemetryDto,
    @Headers('x-api-key') headerApiKey?: string,
  ) {
    const validApiKey = process.env.ADMIN_API_KEY || 'steair_admin_super_secret_key_2026';
    const requestApiKey = headerApiKey || dto.api_key;

    if (!requestApiKey || requestApiKey !== validApiKey) {
      throw new UnauthorizedException('Clé d\'API invalide ou manquante');
    }

    try {
      const isAlert = dto.rain === 1;

      const measure = await this.prisma.measure.create({
        data: {
          temperature: dto.temperature,
          humidity: dto.humidity,
          pressure: dto.pressure || null,
          rain: dto.rain !== undefined ? dto.rain : null,
          alertActive: isAlert,
          batteryVoltage: dto.battery_voltage ? parseFloat(dto.battery_voltage.toString()) : null,
          gsmSignal: dto.gsm_signal !== undefined ? parseInt(dto.gsm_signal.toString()) : null,
          gsmOperator: dto.gsm_operator || null,
          lbsLat: dto.lbs_lat ? parseFloat(dto.lbs_lat.toString()) : null,
          lbsLon: dto.lbs_lon ? parseFloat(dto.lbs_lon.toString()) : null,
        },
      });

      return {
        status: 'success',
        message: 'Télémétrie enregistrée',
        id: measure.id,
      };
    } catch (err) {
      throw new BadRequestException('Impossible d\'enregistrer la télémétrie : ' + err.message);
    }
  }
}

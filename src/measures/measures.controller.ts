import { Controller, Get, Delete, Query, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class MeasuresController {
  constructor(private prisma: PrismaService) {}

  // GET /api/realtime
  @Get('realtime')
  async getRealtime(@Query('stationId') stationId?: string) {
    const where: any = {};
    if (stationId) {
      where.stationId = stationId;
    }
    const measure = await this.prisma.measure.findFirst({
      where,
      orderBy: { timestamp: 'desc' },
    });
    if (!measure) {
      return null;
    }
    return measure;
  }

  // GET /api/daily-summary
  @Get('daily-summary')
  async getDailySummary(
    @Query('date') dateStr?: string,
    @Query('stationId') stationId?: string,
    @Query('filterParasites') filterParasitesQuery?: string,
  ) {
    const filterParasites = filterParasitesQuery === 'true' || filterParasitesQuery === '1';
    const targetDateStr = dateStr || new Date().toISOString().split('T')[0];
    
    const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

    const where: any = {
      timestamp: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (stationId) {
      if (stationId.includes(',')) {
        where.stationId = { in: stationId.split(',') };
      } else {
        where.stationId = stationId;
      }
    }

    const rawMeasures = await this.prisma.measure.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    const dayOfWeekNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayName = dayOfWeekNames[startOfDay.getDay()];

    const enriched = rawMeasures.map((r) => {
      const isParasite =
        (r.pressure !== null && r.pressure < 800) ||
        (r.temperatureBmp !== null && Math.abs(r.temperatureBmp - 22.23) < 0.01) ||
        r.humidity === 0;

      const tempBmp = r.temperatureBmp ?? r.temperature;
      const tempDht = r.temperatureDht ?? null;
      const deltaTemp = tempBmp !== null && tempDht !== null ? +(tempBmp - tempDht).toFixed(2) : null;

      return {
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        heure: new Date(r.timestamp).toTimeString().slice(0, 5),
        temperatureBmp: tempBmp,
        temperatureDht22: tempDht,
        deltaTemp,
        humidityDht22: r.humidity,
        pressureBmp: r.pressure,
        rain: r.rain === 1,
        alertActive: r.alertActive,
        isParasite,
      };
    });

    const activeRows = filterParasites ? enriched.filter((r) => !r.isParasite) : enriched;

    const calcObjStats = (arr: number[]) => {
      if (!arr.length) return { min: null, max: null, avg: null };
      const sum = arr.reduce((a, b) => a + b, 0);
      return {
        min: +Math.min(...arr).toFixed(2),
        max: +Math.max(...arr).toFixed(2),
        avg: +(sum / arr.length).toFixed(2),
      };
    };

    const bmpTemps = activeRows.map((r) => r.temperatureBmp).filter((v) => v !== null) as number[];
    const dhtTemps = activeRows.map((r) => r.temperatureDht22).filter((v) => v !== null) as number[];
    const hums = activeRows.map((r) => r.humidityDht22).filter((v) => v !== null) as number[];
    const press = activeRows.map((r) => r.pressureBmp).filter((v) => v !== null) as number[];
    const deltas = activeRows.map((r) => r.deltaTemp).filter((v) => v !== null) as number[];

    return {
      date: targetDateStr,
      dayName,
      totalCount: enriched.length,
      validCount: activeRows.length,
      filterParasitesApplied: filterParasites,
      summary: {
        temperatureBmp: calcObjStats(bmpTemps),
        temperatureDht22: calcObjStats(dhtTemps),
        humidityDht22: calcObjStats(hums),
        pressureBmp: calcObjStats(press),
        biasDelta: deltas.length ? +(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2) : null,
      },
      observations: enriched,
    };
  }

  // GET /api/history
  @Get('history')
  async getHistory(
    @Query('stationId') stationId?: string,
    @Query('limit') limitQuery?: string,
    @Query('offset') offsetQuery?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('minTemp') minTempQuery?: string,
    @Query('maxTemp') maxTempQuery?: string,
    @Query('alertOnly') alertOnlyQuery?: string,
  ) {
    const limit = limitQuery ? parseInt(limitQuery) : 100;
    const offset = offsetQuery ? parseInt(offsetQuery) : 0;
    const minTemp = minTempQuery ? parseFloat(minTempQuery) : undefined;
    const maxTemp = maxTempQuery ? parseFloat(maxTempQuery) : undefined;
    const alertOnly = alertOnlyQuery === 'true' || alertOnlyQuery === '1';

    const where: any = {};

    if (stationId) {
      if (stationId.includes(',')) {
        where.stationId = { in: stationId.split(',') };
      } else {
        where.stationId = stationId;
      }
    }

    if (start || end) {
      where.timestamp = {};
      if (start) {
        where.timestamp.gte = start.includes('T') ? new Date(start) : new Date(`${start}T00:00:00.000Z`);
      }
      if (end) {
        where.timestamp.lte = end.includes('T') ? new Date(end) : new Date(`${end}T23:59:59.999Z`);
      }
    }

    if (minTemp !== undefined || maxTemp !== undefined) {
      where.temperature = {};
      if (minTemp !== undefined) where.temperature.gte = minTemp;
      if (maxTemp !== undefined) where.temperature.lte = maxTemp;
    }

    if (alertOnly) {
      where.alertActive = true;
    }

    const data = await this.prisma.measure.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.measure.count({ where });

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  // GET /api/stats
  @Get('stats')
  async getStats(@Query('stationId') stationId?: string) {
    const where: any = {};
    if (stationId) {
      if (stationId.includes(',')) {
        where.stationId = { in: stationId.split(',') };
      } else {
        where.stationId = stationId;
      }
    }

    const total = await this.prisma.measure.count({ where });
    const lastMeasure = await this.prisma.measure.findFirst({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Calculer les statistiques globales
    const rawMeasures = await this.prisma.measure.findMany({
      where,
      take: 1000, // Limiter pour les stats rapides
      orderBy: { timestamp: 'desc' },
    });

    const temps = rawMeasures.map((r) => r.temperature);
    const hums = rawMeasures.map((r) => r.humidity);

    const stats = {
      temperature: {
        min: temps.length ? Math.min(...temps) : null,
        max: temps.length ? Math.max(...temps) : null,
        avg: temps.length ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2) : null,
      },
      humidity: {
        min: hums.length ? Math.min(...hums) : null,
        max: hums.length ? Math.max(...hums) : null,
        avg: hums.length ? +(hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(2) : null,
      },
    };

    return {
      totalMeasures: total,
      lastMeasure,
      stats,
    };
  }

  // DELETE /api/cleanup (Réservé à l'Admin)
  @Delete('cleanup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async cleanup(@Query('days') daysQuery?: string) {
    const days = daysQuery ? parseInt(daysQuery) : 30;
    if (isNaN(days) || days <= 0) {
      throw new BadRequestException('Le paramètre days doit être un nombre valide supérieur à 0');
    }

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const deleteResult = await this.prisma.measure.deleteMany({
      where: {
        timestamp: { lt: dateLimit },
      },
    });

    return {
      message: `${deleteResult.count} enregistrements supprimés`,
      deleted: deleteResult.count,
    };
  }
}

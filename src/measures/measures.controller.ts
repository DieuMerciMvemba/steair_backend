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
  async getRealtime() {
    const measure = await this.prisma.measure.findFirst({
      orderBy: { timestamp: 'desc' },
    });
    if (!measure) {
      return null;
    }
    return measure;
  }

  // GET /api/history
  @Get('history')
  async getHistory(
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

    if (start || end) {
      where.timestamp = {};
      if (start) where.timestamp.gte = new Date(start);
      if (end) where.timestamp.lte = new Date(end);
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
  async getStats() {
    const total = await this.prisma.measure.count();
    const lastMeasure = await this.prisma.measure.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    // Calculer les statistiques globales
    const rawMeasures = await this.prisma.measure.findMany({
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

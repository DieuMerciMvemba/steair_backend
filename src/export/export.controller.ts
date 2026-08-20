import { Controller, Get, Res, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private prisma: PrismaService) {}

  private comfortIndex(temp: number, humidity: number): string {
    if (temp >= 22 && temp <= 28 && humidity >= 40 && humidity <= 70) return 'Excellent';
    if (temp >= 20 && temp <= 32 && humidity >= 30 && humidity <= 80) return 'Bon';
    if (temp >= 18 && temp <= 35 && humidity >= 20 && humidity <= 90) return 'Moyen';
    if (temp > 35 || humidity > 90) return 'Mauvais';
    return 'Critique';
  }

  private enrichRow(row: any) {
    const dt = new Date(row.timestamp);
    return {
      id: row.id,
      timestamp_iso: row.timestamp.toISOString(),
      date: dt.toISOString().split('T')[0],
      heure: dt.toTimeString().slice(0, 8),
      jour_semaine: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dt.getDay()],
      temperature_c: row.temperature,
      humidite_pct: row.humidity,
      pression_hpa: row.pressure ?? null,
      pluie: row.rain === 1 ? 1 : 0,
      etat_pluie: row.rain === 1 ? 'Pluie' : 'Sec',
      alerte_active: row.alertActive ? true : false,
      indice_confort: this.comfortIndex(row.temperature, row.humidity),
    };
  }

  private calcStats(rows: any[], key: string) {
    const vals = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && !isNaN(v));
    if (!vals.length) return { min: null, max: null, avg: null, std: null, count: 0 };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: +avg.toFixed(3),
      std: +std.toFixed(3),
      count: vals.length,
    };
  }

  @Get('json')
  async exportJson(@Res() res: Response) {
    try {
      const raw = await this.prisma.measure.findMany({
        orderBy: { timestamp: 'desc' },
      });
      const rows = raw.map((r) => this.enrichRow(r));

      const tempStats = this.calcStats(rows, 'temperature_c');
      const humStats = this.calcStats(rows, 'humidite_pct');
      const presStats = this.calcStats(rows, 'pression_hpa');

      const payload = {
        meta: {
          exported_at: new Date().toISOString(),
          total_records: rows.length,
          period_start: rows.length ? rows[rows.length - 1].timestamp_iso : null,
          period_end: rows.length ? rows[0].timestamp_iso : null,
          source: 'SteAir Pro — Station Météo NestJS',
        },
        statistics: {
          temperature_c: tempStats,
          humidite_pct: humStats,
          pression_hpa: presStats,
          alertes_count: rows.filter((r) => r.alerte_active).length,
          pluie_count: rows.filter((r) => r.pluie === 1).length,
        },
        data: rows,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=steair_export_${new Date().toISOString().split('T')[0]}.json`,
      );
      return res.json(payload);
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de l\'export JSON : ' + error.message);
    }
  }

  @Get('excel')
  async exportExcel(@Res() res: Response) {
    try {
      const raw = await this.prisma.measure.findMany({
        orderBy: { timestamp: 'desc' },
      });
      const rows = raw.map((r) => this.enrichRow(r));

      // ── Onglet 1 : Données brutes enrichies ──────────────────────────────────
      const sheetData = rows.map((r) => ({
        ID: r.id,
        'Timestamp ISO': r.timestamp_iso,
        Date: r.date,
        Heure: r.heure,
        Jour: r.jour_semaine,
        'Température (°C)': r.temperature_c,
        'Humidité (%)': r.humidite_pct,
        'Pression (hPa)': r.pression_hpa,
        'Pluie (0/1)': r.pluie,
        'État Pluie': r.etat_pluie,
        Alerte: r.alerte_active ? 1 : 0,
        'Indice Confort': r.indice_confort,
      }));
      const wsData = XLSX.utils.json_to_sheet(sheetData);
      wsData['!cols'] = [
        { wch: 36 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 16 },
      ];

      // ── Onglet 2 : Statistiques descriptives ─────────────────────────────────
      const statRows = [
        { Métrique: 'Température (°C)', ...this.calcStats(rows, 'temperature_c') },
        { Métrique: 'Humidité (%)', ...this.calcStats(rows, 'humidite_pct') },
        { Métrique: 'Pression (hPa)', ...this.calcStats(rows, 'pression_hpa') },
      ];
      const wsStats = XLSX.utils.json_to_sheet(
        statRows.map((r) => ({
          Métrique: r.Métrique,
          Min: r.min,
          Max: r.max,
          Moyenne: r.avg,
          'Écart-type': r.std,
          N: r.count,
        })),
      );
      wsStats['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];

      // ── Onglet 3 : Résumé par jour ───────────────────────────────────────────
      const byDay: Record<string, any[]> = {};
      rows.forEach((r) => {
        if (!byDay[r.date]) byDay[r.date] = [];
        byDay[r.date].push(r);
      });
      const dailyRows = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, recs]) => ({
          Date: date,
          Relevés: recs.length,
          'Temp. Min (°C)': Math.min(...recs.map((r) => r.temperature_c)).toFixed(1),
          'Temp. Max (°C)': Math.max(...recs.map((r) => r.temperature_c)).toFixed(1),
          'Temp. Moy (°C)': (recs.reduce((s, r) => s + r.temperature_c, 0) / recs.length).toFixed(1),
          'Hum. Moy (%)': (recs.reduce((s, r) => s + r.humidite_pct, 0) / recs.length).toFixed(0),
          Alertes: recs.filter((r) => r.alerte_active).length,
          'Épisodes Pluie': recs.filter((r) => r.pluie === 1).length,
        }));
      const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
      wsDaily['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 14 }];

      // ── Assemblage workbook ───────────────────────────────────────────────────
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsData, 'Données');
      XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Résumé Journalier');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=steair_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      );
      return res.send(buffer);
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de l\'export Excel : ' + error.message);
    }
  }
}

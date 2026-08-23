import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.alert.findMany({
      where: { active: true },
      include: {
        station: {
          select: {
            code: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alerte avec l'ID ${id} non trouvée`);
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        active: false,
        resolvedAt: new Date(),
      },
    });
  }

  // Helper method used by Ingestion/Telemetry to create alerts automatically
  async triggerAlert(stationId: string, type: 'ENVIRONMENTAL' | 'TECHNICAL', title: string, message: string, severity: 'INFO' | 'WARNING' | 'CRITICAL') {
    // Check if an identical active alert already exists to prevent duplication
    const existing = await this.prisma.alert.findFirst({
      where: {
        stationId,
        type,
        title,
        active: true,
      },
    });

    if (existing) {
      return existing; // Don't duplicate the alert
    }

    return this.prisma.alert.create({
      data: {
        stationId,
        type,
        title,
        message,
        severity,
        active: true,
      },
    });
  }
}

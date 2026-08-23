import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.maintenance.findMany({
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

  async create(data: { stationId: string; technicianName: string; description: string; action: string; result: string; status: string }) {
    const station = await this.prisma.station.findUnique({
      where: { id: data.stationId },
    });

    if (!station) {
      throw new NotFoundException(`Station avec l'ID ${data.stationId} non trouvée`);
    }

    // Si le technicien a résolu l'incident et que la station était marquée "MAINTENANCE"
    // on peut remettre son statut à ONLINE par défaut, ou selon le statut de la fiche
    const newStatus = data.status === 'RESOLVED' ? 'ONLINE' : 'MAINTENANCE';

    const [maintenanceRecord] = await this.prisma.$transaction([
      this.prisma.maintenance.create({
        data: {
          stationId: data.stationId,
          technicianName: data.technicianName,
          description: data.description,
          action: data.action,
          result: data.result,
          status: data.status,
        },
      }),
      this.prisma.station.update({
        where: { id: data.stationId },
        data: { status: newStatus },
      }),
    ]);

    return maintenanceRecord;
  }
}

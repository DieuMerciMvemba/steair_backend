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

  async create(data: { stationId: string; technicianName?: string; description: string; action?: string; result?: string; status?: string; title?: string; priority?: string }) {
    const station = await this.prisma.station.findUnique({
      where: { id: data.stationId },
    });

    if (!station) {
      throw new NotFoundException(`Station avec l'ID ${data.stationId} non trouvée`);
    }

    const status = data.status || 'PENDING';
    const newStationStatus = status === 'RESOLVED' ? 'ONLINE' : 'MAINTENANCE';

    const technicianName = data.technicianName || 'Technicien SteAir';
    const description = data.title ? `${data.title} - ${data.description}` : data.description;
    const action = data.action || 'Intervention enregistrée';
    const result = data.result || (status === 'RESOLVED' ? 'Incident résolu' : 'En cours');

    const [maintenanceRecord] = await this.prisma.$transaction([
      this.prisma.maintenance.create({
        data: {
          stationId: data.stationId,
          technicianName,
          description,
          action,
          result,
          status,
        },
      }),
      this.prisma.station.update({
        where: { id: data.stationId },
        data: { status: newStationStatus },
      }),
    ]);

    return maintenanceRecord;
  }

  async updateStatus(id: string, status: string, result?: string) {
    const ticket = await this.prisma.maintenance.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket de maintenance avec l'ID ${id} non trouvé`);
    }

    const newStationStatus = status === 'RESOLVED' ? 'ONLINE' : 'MAINTENANCE';

    const [updatedTicket] = await this.prisma.$transaction([
      this.prisma.maintenance.update({
        where: { id },
        data: {
          status,
          result: result || (status === 'RESOLVED' ? 'Intervention terminée avec succès' : ticket.result),
        },
      }),
      this.prisma.station.update({
        where: { id: ticket.stationId },
        data: { status: newStationStatus },
      }),
    ]);

    return updatedTicket;
  }
}


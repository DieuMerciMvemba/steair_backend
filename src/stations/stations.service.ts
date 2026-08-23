import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as randomstring from 'crypto';

@Injectable()
export class StationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.station.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const station = await this.prisma.station.findUnique({
      where: { id },
      include: {
        measures: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
        alerts: {
          where: { active: true },
        },
      },
    });

    if (!station) {
      throw new NotFoundException(`Station avec l'ID ${id} non trouvée`);
    }

    return station;
  }

  async create(data: { code: string; name: string; location: string; latitude?: number; longitude?: number }) {
    const existing = await this.prisma.station.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictException(`Une station avec le code ${data.code} existe déjà`);
    }

    const apiKey = 'steair_station_' + randomstring.randomBytes(16).toString('hex');

    return this.prisma.station.create({
      data: {
        code: data.code,
        name: data.name,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        apiKey,
        status: 'OFFLINE',
      },
    });
  }

  async update(id: string, data: { name?: string; location?: string; latitude?: number; longitude?: number; status?: string; active?: boolean }) {
    const station = await this.prisma.station.findUnique({
      where: { id },
    });

    if (!station) {
      throw new NotFoundException(`Station avec l'ID ${id} non trouvée`);
    }

    return this.prisma.station.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const station = await this.prisma.station.findUnique({
      where: { id },
    });

    if (!station) {
      throw new NotFoundException(`Station avec l'ID ${id} non trouvée`);
    }

    return this.prisma.station.delete({
      where: { id },
    });
  }
}

import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StationsService } from './stations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';

@Controller('api/stations')
export class StationsController {
  constructor(
    private readonly stationsService: StationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll() {
    return this.stationsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.stationsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(
    @Body() body: { code: string; name: string; location: string; latitude?: number; longitude?: number },
    @Request() req: any,
  ) {
    const station = await this.stationsService.create(body);
    const email = req.user?.email || 'admin@steair.cd';
    await this.auditService.logAction(
      'CREATE_STATION',
      `Création de la station ${station.name} (${station.code})`,
      email,
    );
    return station;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'tech')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; location?: string; latitude?: number; longitude?: number; status?: string; active?: boolean },
    @Request() req: any,
  ) {
    const station = await this.stationsService.update(id, body);
    const email = req.user?.email || 'admin@steair.cd';
    await this.auditService.logAction(
      'UPDATE_STATION',
      `Modification de la station ${station.name} (${station.code}) : ${JSON.stringify(body)}`,
      email,
    );
    return station;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string, @Request() req: any) {
    const station = await this.stationsService.findOne(id);
    const result = await this.stationsService.remove(id);
    const email = req.user?.email || 'admin@steair.cd';
    await this.auditService.logAction(
      'DELETE_STATION',
      `Suppression de la station ${station.name} (${station.code})`,
      email,
    );
    return result;
  }
}

import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'tech')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  async findAll() {
    return this.maintenanceService.findAll();
  }

  @Post()
  async create(
    @Body() body: { stationId: string; technicianName?: string; description: string; action?: string; result?: string; status?: string; title?: string; priority?: string },
  ) {
    return this.maintenanceService.create(body);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; result?: string },
  ) {
    return this.maintenanceService.updateStatus(id, body.status, body.result);
  }
}


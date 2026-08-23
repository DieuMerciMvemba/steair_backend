import { Controller, Get, Put, Param, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'tech')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async findActive() {
    return this.alertsService.findActive();
  }

  @Put(':id/resolve')
  async resolve(@Param('id') id: string) {
    return this.alertsService.resolve(id);
  }
}

import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';

@Controller('api/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Roles('admin', 'tech')
  async getSettings() {
    return this.settingsService.getAll();
  }

  @Post()
  @Roles('admin')
  async updateSettings(@Body() body: Record<string, string>, @Request() req: any) {
    const prev = await this.settingsService.getAll();
    const updated = await this.settingsService.updateMany(body);
    
    // Log system action
    const email = req.user?.email || 'admin@steair.cd';
    await this.auditService.logAction(
      'UPDATE_SETTINGS',
      `Modification des seuils et paramètres : ${JSON.stringify(body)} (Anciens: ${JSON.stringify(prev)})`,
      email,
    );

    return updated;
  }
}

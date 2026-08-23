import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';

@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@Body() body: any, @Request() req: any) {
    const user = await this.usersService.create(body);
    
    // Audit Log
    const email = req.user?.email || 'admin@steair.cd';
    await this.auditService.logAction(
      'CREATE_USER',
      `Création de l'utilisateur ${user.email} avec le rôle ${user.role}`,
      email,
    );

    return user;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const user = await this.usersService.update(id, body);

    // Audit Log
    const email = req.user?.email || 'admin@steair.cd';
    await this.auditService.logAction(
      'UPDATE_USER',
      `Modification de l'utilisateur ${user.email} (nouveau rôle: ${user.role})`,
      email,
    );

    return user;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const result = await this.usersService.remove(id);

    // Audit Log
    const email = req.user?.email || 'admin@steair.cd';
    await this.auditService.logAction(
      'DELETE_USER',
      `Suppression de l'utilisateur avec l'ID ${id}`,
      email,
    );

    return result;
  }
}

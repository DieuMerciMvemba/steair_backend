import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MeasuresModule } from './measures/measures.module';
import { ExportModule } from './export/export.module';
import { StationsModule } from './stations/stations.module';
import { AlertsModule } from './alerts/alerts.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TelemetryModule,
    MeasuresModule,
    ExportModule,
    StationsModule,
    AlertsModule,
    MaintenanceModule,
    SettingsModule,
    AuditModule,
    UsersModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AlertsModule],
  controllers: [TelemetryController],
})
export class TelemetryModule {}

import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { MqttService } from './mqtt.service';

@Module({
  controllers: [TelemetryController],
  providers: [MqttService],
})
export class TelemetryModule {}

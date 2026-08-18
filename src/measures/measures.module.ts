import { Module } from '@nestjs/common';
import { MeasuresController } from './measures.controller';

@Module({
  controllers: [MeasuresController],
})
export class MeasuresModule {}

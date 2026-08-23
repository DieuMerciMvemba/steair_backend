import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly defaultSettings = {
    temp_threshold_critical_high: '40.0',
    battery_threshold_critical_low: '3.4',
    retention_days: '30',
  };

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    for (const [key, val] of Object.entries(this.defaultSettings)) {
      const existing = await this.prisma.setting.findUnique({
        where: { key },
      });
      if (!existing) {
        await this.prisma.setting.create({
          data: { key, value: val },
        });
      }
    }
  }

  async getAll() {
    const list = await this.prisma.setting.findMany();
    const settingsObj = {};
    list.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    return settingsObj;
  }

  async get(key: string, defaultValue: string): Promise<string> {
    const s = await this.prisma.setting.findUnique({
      where: { key },
    });
    return s ? s.value : defaultValue;
  }

  async updateMany(settings: Record<string, string>) {
    for (const [key, value] of Object.entries(settings)) {
      await this.prisma.setting.upsert({
        where: { key },
        update: { value: value.toString() },
        create: { key, value: value.toString() },
      });
    }
    return this.getAll();
  }
}

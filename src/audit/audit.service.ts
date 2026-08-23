import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logAction(action: string, details: string, userEmail?: string) {
    return this.prisma.auditLog.create({
      data: {
        action,
        details,
        userEmail,
      },
    });
  }

  async getLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200, // Limit to recent logs for performance
    });
  }
}

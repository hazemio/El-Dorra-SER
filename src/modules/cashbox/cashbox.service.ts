import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CashboxService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const cashboxes = await this.prisma.cashbox.findMany({ include: { branch: true } });
    return { success: true, data: cashboxes };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(accountId?: string) {
    const where = accountId ? { accountId } : {};
    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      include: {
        account: true,
        journalEntry: true,
      },
      orderBy: { entryDate: 'desc' },
    });
    return { success: true, data: entries };
  }
}

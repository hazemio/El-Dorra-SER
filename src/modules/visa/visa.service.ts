import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from '../journal/journal.service';

@Injectable()
export class VisaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async findAll() {
    const visas = await this.prisma.visa.findMany({
      include: { customer: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: visas };
  }

  async create(data: any, userId: string) {
    const costPrice = Number(data.costPrice);
    const sellingPrice = Number(data.sellingPrice);
    const profit = sellingPrice - costPrice;
    const visaNumber = data.visaNumber || `VSA-${Math.floor(100000 + Math.random() * 900000)}`;

    const visa = await this.prisma.visa.create({
      data: {
        visaNumber,
        passportNumber: data.passportNumber,
        applicantName: data.applicantName,
        country: data.country,
        visaType: data.visaType || 'Tourist',
        costPrice,
        sellingPrice,
        profit,
        currency: data.currency || 'EGP',
        customerId: data.customerId,
        supplierId: data.supplierId || null,
        branchId: data.branchId,
        createdById: userId,
      },
    });

    const cashAccount = await this.prisma.account.findFirst({ where: { code: '1010' } });
    const payableAccount = await this.prisma.account.findFirst({ where: { code: '2010' } });
    const revenueAccount = await this.prisma.account.findFirst({ where: { code: '4020' } });

    if (cashAccount && payableAccount && revenueAccount) {
      await this.journalService.postEntry({
        description: `Visa Issuance #${visa.visaNumber} for ${visa.applicantName} (${visa.country})`,
        reference: visa.visaNumber,
        branchId: visa.branchId,
        createdById: userId,
        lines: [
          { accountId: cashAccount.id, debit: sellingPrice, credit: 0, description: `Cash received for Visa #${visa.visaNumber}` },
          { accountId: payableAccount.id, debit: 0, credit: costPrice, description: `Supplier Cost for Visa #${visa.visaNumber}` },
          { accountId: revenueAccount.id, debit: 0, credit: profit, description: `Service Revenue for Visa #${visa.visaNumber}` },
        ],
      });
    }

    return { success: true, message: 'Visa created and accounting posted', data: visa };
  }
}

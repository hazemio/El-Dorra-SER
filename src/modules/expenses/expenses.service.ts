import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from '../journal/journal.service';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async findAll() {
    const expenses = await this.prisma.expense.findMany({
      include: { supplier: true, branch: true, createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: expenses };
  }

  async create(data: any, userId: string) {
    const amount = Number(data.amount);
    const expenseNumber = `EXP-${Math.floor(100000 + Math.random() * 900000)}`;

    const expense = await this.prisma.expense.create({
      data: {
        expenseNumber,
        category: data.category || 'General',
        description: data.description,
        amount,
        currency: data.currency || 'EGP',
        exchangeRate: data.exchangeRate || 1.0,
        baseAmount: amount * (data.exchangeRate || 1.0),
        supplierId: data.supplierId || null,
        branchId: data.branchId,
        createdById: userId,
      },
    });

    const expenseAccount = await this.prisma.account.findFirst({ where: { code: '5020' } });
    const cashAccount = await this.prisma.account.findFirst({ where: { code: '1010' } });

    if (expenseAccount && cashAccount) {
      await this.journalService.postEntry({
        description: `Expense #${expense.expenseNumber}: ${expense.description}`,
        reference: expense.expenseNumber,
        branchId: expense.branchId,
        createdById: userId,
        lines: [
          { accountId: expenseAccount.id, debit: amount, credit: 0, description: expense.description },
          { accountId: cashAccount.id, debit: 0, credit: amount, description: `Cash Outflow for Expense #${expense.expenseNumber}` },
        ],
      });
    }

    return { success: true, message: 'Expense recorded and journal entry posted', data: expense };
  }
}

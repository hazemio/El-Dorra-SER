import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalStatus } from '@prisma/client';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const entries = await this.prisma.journalEntry.findMany({
      include: {
        lines: { include: { account: true } },
        createdBy: { select: { fullName: true } },
        branch: { select: { nameEn: true } },
      },
      orderBy: { entryDate: 'desc' },
    });
    return { success: true, data: entries };
  }

  async findOne(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: { include: { account: true } },
        createdBy: { select: { fullName: true } },
        branch: { select: { nameEn: true } },
      },
    });

    if (!entry) throw new NotFoundException('Journal entry not found');
    return { success: true, data: entry };
  }

  async postEntry(data: {
    description: string;
    reference?: string;
    branchId?: string;
    createdById: string;
    lines: { accountId: string; debit: number; credit: number; description?: string }[];
  }) {
    const totalDebit = data.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(
        `Double-entry balance check failed: Total Debit (${totalDebit.toFixed(2)}) does not equal Total Credit (${totalCredit.toFixed(2)})`
      );
    }

    const entryNumber = `JV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const journalEntry = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          description: data.description,
          reference: data.reference,
          branchId: data.branchId,
          createdById: data.createdById,
          totalDebit,
          totalCredit,
          status: JournalStatus.POSTED,
          lines: {
            create: data.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description || data.description,
            })),
          },
        },
        include: { lines: true },
      });

      // Post to General Ledger and update account running balances
      for (const line of entry.lines) {
        const account = await tx.account.findUnique({ where: { id: line.accountId } });
        if (account) {
          const balanceChange = line.debit - line.credit;
          const newBalance = account.balance + balanceChange;

          await tx.account.update({
            where: { id: account.id },
            data: { balance: newBalance },
          });

          await tx.ledgerEntry.create({
            data: {
              accountId: account.id,
              journalEntryId: entry.id,
              entryDate: entry.entryDate,
              debit: line.debit,
              credit: line.credit,
              runningBalance: newBalance,
            },
          });
        }
      }

      return entry;
    });

    return { success: true, message: 'Journal Entry posted successfully', data: journalEntry };
  }

  async reverseEntry(id: string, userId: string) {
    const originalEntry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!originalEntry) throw new NotFoundException('Original journal entry not found');

    if (originalEntry.status === JournalStatus.REVERSED) {
      throw new BadRequestException('Journal entry has already been reversed');
    }

    const reversedLines = originalEntry.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,  // Reverse debit and credit
      credit: l.debit,
      description: `Reversal of ${originalEntry.entryNumber}: ${l.description || ''}`,
    }));

    const reversalResult = await this.postEntry({
      description: `Reversal of ${originalEntry.entryNumber}`,
      reference: `REV-${originalEntry.entryNumber}`,
      branchId: originalEntry.branchId || undefined,
      createdById: userId,
      lines: reversedLines,
    });

    await this.prisma.journalEntry.update({
      where: { id: originalEntry.id },
      data: { status: JournalStatus.REVERSED, reversedEntryId: reversalResult.data.id },
    });

    return {
      success: true,
      message: `Journal entry ${originalEntry.entryNumber} reversed successfully`,
      data: reversalResult.data,
    };
  }
}

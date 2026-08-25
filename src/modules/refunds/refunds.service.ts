import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { TicketStatus, RefundStatus } from '@prisma/client';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async findAll() {
    const refunds = await this.prisma.refund.findMany({
      include: { ticket: true, customer: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: refunds };
  }

  async create(data: any, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: data.ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const refundAmount = Number(data.refundAmount);
    const penaltyAmount = Number(data.penaltyAmount || 0);
    const netRefund = refundAmount - penaltyAmount;

    const refundNumber = `REF-${Math.floor(100000 + Math.random() * 900000)}`;

    const refund = await this.prisma.$transaction(async (tx) => {
      const createdRefund = await tx.refund.create({
        data: {
          refundNumber,
          ticketId: ticket.id,
          customerId: ticket.customerId,
          supplierId: ticket.supplierId,
          refundAmount,
          penaltyAmount,
          netRefund,
          status: RefundStatus.APPROVED,
          reason: data.reason || 'Customer Ticket Cancellation',
          requestedById: userId,
          approvedById: userId,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.REFUNDED },
      });

      return createdRefund;
    });

    // Create Accounting Journal Reversal Entry
    const cashAccount = await this.prisma.account.findFirst({ where: { code: '1010' } });
    const revenueAccount = await this.prisma.account.findFirst({ where: { code: '4010' } });

    if (cashAccount && revenueAccount) {
      await this.journalService.postEntry({
        description: `Ticket Refund #${refund.refundNumber} for Ticket #${ticket.ticketNumber}`,
        reference: refund.refundNumber,
        branchId: ticket.branchId,
        createdById: userId,
        lines: [
          { accountId: revenueAccount.id, debit: netRefund, credit: 0, description: `Revenue Debit for Refund #${refund.refundNumber}` },
          { accountId: cashAccount.id, debit: 0, credit: netRefund, description: `Cash Outflow for Refund #${refund.refundNumber}` },
        ],
      });
    }

    return { success: true, message: 'Refund processed and financial reversal posted', data: refund };
  }
}

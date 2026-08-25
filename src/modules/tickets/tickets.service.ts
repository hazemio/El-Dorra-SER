import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from '../journal/journal.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async findAll() {
    const tickets = await this.prisma.ticket.findMany({
      where: { deletedAt: null },
      include: {
        customer: true,
        supplier: true,
        flight: true,
        branch: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: tickets };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { customer: true, supplier: true, flight: true, branch: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return { success: true, data: ticket };
  }

  async create(data: any, userId: string) {
    const costPrice = Number(data.costPrice);
    const sellingPrice = Number(data.sellingPrice);
    const profit = sellingPrice - costPrice;

    const ticketNumber = data.ticketNumber || `TKT-${Math.floor(10000000 + Math.random() * 90000000)}`;

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        pnr: data.pnr,
        passengerName: data.passengerName,
        customerId: data.customerId,
        supplierId: data.supplierId,
        flightId: data.flightId || null,
        branchId: data.branchId,
        createdById: userId,
        travelDate: new Date(data.travelDate),
        costPrice,
        sellingPrice,
        profit,
        currency: data.currency || 'EGP',
        exchangeRate: data.exchangeRate || 1.0,
        baseCostPrice: costPrice * (data.exchangeRate || 1.0),
        baseSellingPrice: sellingPrice * (data.exchangeRate || 1.0),
        baseProfit: profit * (data.exchangeRate || 1.0),
      },
      include: { customer: true, supplier: true },
    });

    // Record Supplier Transaction (Airline Payable Ledger)
    if (data.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: data.supplierId } });
      if (supplier) {
        const newBalance = supplier.balance + costPrice;
        await this.prisma.supplier.update({
          where: { id: data.supplierId },
          data: { balance: newBalance },
        });
        await this.prisma.supplierTransaction.create({
          data: {
            supplierId: data.supplierId,
            type: 'PURCHASE',
            referenceType: 'TICKET',
            referenceId: ticket.id,
            description: `Ticket #${ticket.ticketNumber} PNR: ${ticket.pnr} (${ticket.passengerName})`,
            credit: costPrice,
            debit: 0.0,
            balanceAfter: newBalance,
            createdById: userId,
          },
        });
      }
    }

    // Post Double-Entry Accounting Journal Entry automatically
    // Fetch Cash, Payable, and Revenue accounts
    const cashAccount = await this.prisma.account.findFirst({ where: { code: '1010' } });
    const payableAccount = await this.prisma.account.findFirst({ where: { code: '2010' } });
    const revenueAccount = await this.prisma.account.findFirst({ where: { code: '4010' } });

    if (cashAccount && payableAccount && revenueAccount) {
      await this.journalService.postEntry({
        description: `Ticket Sale #${ticket.ticketNumber} - Passenger: ${ticket.passengerName}`,
        reference: ticket.ticketNumber,
        branchId: ticket.branchId,
        createdById: userId,
        lines: [
          { accountId: cashAccount.id, debit: sellingPrice, credit: 0, description: `Cash received for Ticket #${ticket.ticketNumber}` },
          { accountId: payableAccount.id, debit: 0, credit: costPrice, description: `Supplier Payable for Ticket #${ticket.ticketNumber}` },
          { accountId: revenueAccount.id, debit: 0, credit: profit, description: `Net Profit Revenue for Ticket #${ticket.ticketNumber}` },
        ],
      });
    }

    return { success: true, message: 'Ticket issued and financial entry posted successfully', data: ticket };
  }
}

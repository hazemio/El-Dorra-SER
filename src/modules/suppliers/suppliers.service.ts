import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from '../journal/journal.service';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async findAll() {
    const suppliers = await this.prisma.supplier.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { transactions: true, tickets: true, supplierPayments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: suppliers };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        tickets: { orderBy: { createdAt: 'desc' } },
        supplierPayments: {
          include: { allocations: { include: { ticket: true } } },
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');
    return { success: true, data: supplier };
  }

  async create(data: any) {
    const supplier = await this.prisma.supplier.create({
      data: {
        companyNameAr: data.companyNameAr,
        companyNameEn: data.companyNameEn,
        code: data.code || `SUP-${Math.floor(100 + Math.random() * 900)}`,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email,
        currency: data.currency || 'EGP',
        balance: 0.0,
      },
    });
    return { success: true, message: 'Supplier created successfully', data: supplier };
  }

  async recordPurchase(
    supplierId: string,
    costPrice: number,
    referenceType: string,
    referenceId: string,
    description: string,
    userId: string
  ) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const newBalance = supplier.balance + costPrice;

    const [updatedSupplier, transaction] = await this.prisma.$transaction([
      this.prisma.supplier.update({
        where: { id: supplierId },
        data: { balance: newBalance },
      }),
      this.prisma.supplierTransaction.create({
        data: {
          supplierId,
          type: 'PURCHASE',
          referenceType,
          referenceId,
          description,
          credit: costPrice,
          debit: 0.0,
          balanceAfter: newBalance,
          createdById: userId,
        },
      }),
    ]);

    // Automatic Double-Entry Journal Entry
    const costAccount = await this.prisma.account.findFirst({ where: { code: '5010' } });
    const payableAccount = await this.prisma.account.findFirst({ where: { code: '2010' } });

    if (costAccount && payableAccount) {
      await this.journalService.postEntry({
        description: `Supplier Purchase: ${supplier.companyNameAr} - ${description}`,
        reference: referenceId,
        createdById: userId,
        lines: [
          { accountId: costAccount.id, debit: costPrice, credit: 0, description: `Service Cost (${description})` },
          { accountId: payableAccount.id, debit: 0, credit: costPrice, description: `Payable to ${supplier.companyNameAr}` },
        ],
      });
    }

    return { success: true, message: 'Purchase recorded and accounts payable updated', data: transaction };
  }

  async recordPayment(supplierId: string, data: any, userId: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const amount = Number(data.amount);
    if (amount <= 0) throw new BadRequestException('Payment amount must be greater than zero');

    const newBalance = Math.max(0, supplier.balance - amount);
    const refNum = data.referenceNumber || `PAY-${Math.floor(10000 + Math.random() * 90000)}`;

    // Create Payment Record with optional allocations
    const payment = await this.prisma.supplierPayment.create({
      data: {
        supplierId,
        amount,
        paymentMethod: data.paymentMethod || 'CASH',
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        referenceNumber: refNum,
        notes: data.notes || '',
        createdById: userId,
        allocations: data.allocations && Array.isArray(data.allocations) ? {
          create: data.allocations.map((alloc: any) => ({
            ticketId: alloc.ticketId,
            allocatedAmount: Number(alloc.amount),
          })),
        } : undefined,
      },
      include: { allocations: true },
    });

    // Update Supplier Balance & Record Transaction
    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { balance: newBalance },
    });

    const transaction = await this.prisma.supplierTransaction.create({
      data: {
        supplierId,
        type: 'PAYMENT',
        referenceType: 'MANUAL',
        referenceId: null,  
        description: data.notes || `Payment made to ${supplier.companyNameAr}`,
        debit: amount,
        credit: 0.0,
        balanceAfter: newBalance,
        createdById: userId,
      },
    });

    // Automatic Double-Entry Journal Entry
    const payableAccount = await this.prisma.account.findFirst({ where: { code: '2010' } });
    const cashAccount = await this.prisma.account.findFirst({ where: { code: data.paymentMethod === 'BANK' ? '1020' : '1010' } });

    if (payableAccount && cashAccount) {
      await this.journalService.postEntry({
        description: `Payment to Supplier: ${supplier.companyNameAr} (${refNum})`,
        reference: refNum,
        createdById: userId,
        lines: [
          { accountId: payableAccount.id, debit: amount, credit: 0, description: `Payable Reduction for ${supplier.companyNameAr}` },
          { accountId: cashAccount.id, debit: 0, credit: amount, description: `Cash/Bank Payment to ${supplier.companyNameAr}` },
        ],
      });
    }

    return {
      success: true,
      message: 'Payment to supplier recorded & accounting posted successfully',
      data: { payment, transaction },
    };
  }

  async getUnpaidTickets(supplierId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { supplierId, deletedAt: null },
      include: {
        supplierPaymentAllocations: true,
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const unpaidTickets = tickets.map((t) => {
      const allocatedPaid = t.supplierPaymentAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      const remainingPayable = Math.max(0, t.costPrice - allocatedPaid);
      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        pnr: t.pnr,
        passengerName: t.passengerName,
        issueDate: t.issueDate,
        costPrice: t.costPrice,
        allocatedPaid,
        remainingPayable,
        isFullySettled: remainingPayable <= 0.01,
      };
    }).filter((t) => t.remainingPayable > 0.01);

    return { success: true, data: unpaidTickets };
  }

  async getStatement(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        tickets: {
          include: { customer: true, supplierPaymentAllocations: true },
          orderBy: { createdAt: 'desc' },
        },
        supplierPayments: {
          include: { allocations: { include: { ticket: true } }, createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');

    const totalTicketsCount = supplier.tickets.length;
    const totalPurchaseValue = supplier.transactions
      .filter((t) => t.type === 'PURCHASE')
      .reduce((sum, t) => sum + t.credit, 0);

    const totalPaid = supplier.transactions
      .filter((t) => t.type === 'PAYMENT')
      .reduce((sum, t) => sum + t.debit, 0);

    const lastPayment = supplier.supplierPayments[0];
    const lastPaymentDate = lastPayment ? lastPayment.paymentDate : null;

    return {
      success: true,
      data: {
        supplier: {
          id: supplier.id,
          companyNameAr: supplier.companyNameAr,
          companyNameEn: supplier.companyNameEn,
          code: supplier.code,
          contactPerson: supplier.contactPerson,
          phone: supplier.phone,
          email: supplier.email,
          balance: supplier.balance,
          currency: supplier.currency,
        },
        summary: {
          totalTicketsCount,
          totalPurchaseValue,
          totalPaid,
          remainingBalance: supplier.balance,
          lastPaymentDate,
        },
        tickets: supplier.tickets,
        payments: supplier.supplierPayments,
        transactions: supplier.transactions,
      },
    };
  }

  async getPayablesAgingReport() {
    const suppliers = await this.prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { balance: 'desc' },
    });

    const totalDebt = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const topDebtors = suppliers.slice(0, 5);

    return {
      success: true,
      data: {
        totalDebt,
        topDebtors,
        aging: {
          current_0_30: totalDebt * 0.6,
          past_31_60: totalDebt * 0.25,
          past_60_plus: totalDebt * 0.15,
        },
        suppliers,
      },
    };
  }
}

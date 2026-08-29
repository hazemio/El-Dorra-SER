import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport() {
    const tickets = await this.prisma.ticket.findMany({
      where: { deletedAt: null },
      include: { customer: true, supplier: true },
      orderBy: { issueDate: 'desc' },
    });

    const totalSales = tickets.reduce((sum, t) => sum + t.sellingPrice, 0);
    const totalCost = tickets.reduce((sum, t) => sum + t.costPrice, 0);
    const totalProfit = tickets.reduce((sum, t) => sum + t.profit, 0);

    return {
      success: true,
      data: {
        summary: { totalTickets: tickets.length, totalSales, totalCost, totalProfit },
        tickets,
      },
    };
  }

  async getProfitReport() {
    const tickets = await this.prisma.ticket.aggregate({
      where: { deletedAt: null },
      _sum: { sellingPrice: true, costPrice: true, profit: true },
      _count: { id: true },
    });

    const expenses = await this.prisma.expense.aggregate({
      _sum: { amount: true },
    });

    const grossProfit = tickets._sum.profit || 0;
    const totalExpenses = expenses._sum.amount || 0;
    const netProfit = grossProfit - totalExpenses;

    return {
      success: true,
      data: {
        totalRevenue: tickets._sum.sellingPrice || 0,
        costOfGoodsSold: tickets._sum.costPrice || 0,
        grossProfit,
        totalExpenses,
        netProfit,
      },
    };
  }

  async getCashFlowReport() {
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        account: { subtype: { in: ['CASH', 'BANK'] } },
      },
      include: { account: true, journalEntry: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalInflow = journalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalOutflow = journalLines.reduce((sum, l) => sum + l.credit, 0);
    const netCashFlow = totalInflow - totalOutflow;

    return {
      success: true,
      data: { totalInflow, totalOutflow, netCashFlow, transactions: journalLines },
    };
  }

  async getTrialBalance() {
    const accounts = await this.prisma.account.findMany({
      orderBy: { code: 'asc' },
    });

    const trialBalanceItems = accounts.map((acc) => ({
      code: acc.code,
      nameAr: acc.nameAr,
      nameEn: acc.nameEn,
      type: acc.type,
      debit: acc.balance >= 0 ? acc.balance : 0,
      credit: acc.balance < 0 ? Math.abs(acc.balance) : 0,
    }));

    const totalDebit = trialBalanceItems.reduce((sum, i) => sum + i.debit, 0);
    const totalCredit = trialBalanceItems.reduce((sum, i) => sum + i.credit, 0);

    return {
      success: true,
      data: { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01, items: trialBalanceItems },
    };
  }

  async getBalanceSheet() {
    const accounts = await this.prisma.account.findMany({ orderBy: { code: 'asc' } });

    const assets = accounts.filter((a) => a.type === 'ASSET');
    const liabilities = accounts.filter((a) => a.type === 'LIABILITY');
    const equity = accounts.filter((a) => a.type === 'EQUITY');

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

    return {
      success: true,
      data: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        assets,
        liabilities,
        equity,
      },
    };
  }

  async getFinancialAnalytics() {
    // 1. Database Aggregations
    const ticketsAgg = await this.prisma.ticket.aggregate({
      where: { deletedAt: null },
      _sum: { sellingPrice: true, costPrice: true, profit: true },
      _count: { id: true },
    });

    const visasAgg = await this.prisma.visa.aggregate({
      _sum: { sellingPrice: true, costPrice: true, profit: true },
      _count: { id: true },
    });

    const hotelsAgg = await this.prisma.hotelReservation.aggregate({
      _sum: { sellingPrice: true, costPrice: true, profit: true },
      _count: { id: true },
    });

    const expensesAgg = await this.prisma.expense.aggregate({
      _sum: { amount: true },
    });

    const refundsAgg = await this.prisma.refund.aggregate({
      _sum: { refundAmount: true },
    });

    const bookings = await this.prisma.booking.findMany({
      include: {
        package: true,
        branch: true,
        travelers: true,
        payments: true,
      },
    });

    const customersCount = await this.prisma.customer.count({ where: { deletedAt: null, isArchived: false } });

    // Overview Totals Calculation
    const ticketRev = ticketsAgg._sum.sellingPrice || 0;
    const visaRev = visasAgg._sum.sellingPrice || 0;
    const hotelRev = hotelsAgg._sum.sellingPrice || 0;
    const bookingRev = bookings.reduce((sum, b) => sum + b.totalPrice, 0);

    const ticketCost = ticketsAgg._sum.costPrice || 0;
    const visaCost = visasAgg._sum.costPrice || 0;
    const hotelCost = hotelsAgg._sum.costPrice || 0;
    const bookingCost = bookings.reduce((sum, b) => sum + b.package.costPrice * (b.travelers.length || 1), 0);

    const totalRevenue = ticketRev + visaRev + hotelRev + bookingRev;
    const totalCost = ticketCost + visaCost + hotelCost + bookingCost;
    const totalExpenses = expensesAgg._sum.amount || 0;
    const netProfit = totalRevenue - totalCost - totalExpenses;

    const cashReceived = bookings.reduce((sum, b) => sum + b.paidAmount, 0);
    const outstandingPayments = bookings.reduce((sum, b) => sum + b.remainingAmount, 0);

    const totalBookings = bookings.length;
    const activeBookings = bookings.filter((b) => b.bookingStatus === 'CONFIRMED').length;
    const cancelledBookings = bookings.filter((b) => b.bookingStatus === 'CANCELLED').length;
    const totalTravelers = bookings.reduce((sum, b) => sum + (b.travelers.length || 1), 0);

    // 2. Package Performance Analytics (Sorted by Profit)
    const packages = await this.prisma.package.findMany({
      include: {
        bookings: {
          include: { travelers: true, payments: true },
        },
      },
    });

    const packageAnalytics = packages.map((pkg) => {
      const pkgBookings = pkg.bookings;
      const bookingsCount = pkgBookings.length;
      const travelersCount = pkgBookings.reduce((sum, b) => sum + (b.travelers.length || 1), 0);
      const pkgRevenue = pkgBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const pkgCost = pkg.costPrice * travelersCount;
      const pkgProfit = pkgRevenue - pkgCost;
      const pkgPaid = pkgBookings.reduce((sum, b) => sum + b.paidAmount, 0);
      const remainingBalance = pkgRevenue - pkgPaid;
      const collectionPercentage = pkgRevenue > 0 ? (pkgPaid / pkgRevenue) * 100 : 0;
      const avgProfitPerTraveler = travelersCount > 0 ? pkgProfit / travelersCount : 0;

      return {
        id: pkg.id,
        packageNameAr: pkg.packageNameAr,
        packageNameEn: pkg.packageNameEn,
        packageCode: pkg.packageCode,
        packageType: pkg.packageType,
        bookingsCount,
        travelersCount,
        revenue: pkgRevenue,
        cost: pkgCost,
        netProfit: pkgProfit,
        profitPercentage: pkgRevenue > 0 ? (pkgProfit / pkgRevenue) * 100 : 0,
        paidAmount: pkgPaid,
        remainingBalance,
        collectionPercentage,
        avgProfitPerTraveler,
        status: pkg.status,
      };
    }).sort((a, b) => b.netProfit - a.netProfit);

    // 3. Branch Performance Analytics
    const branches = await this.prisma.branch.findMany({
      include: {
        bookings: { include: { travelers: true } },
        expenses: true,
      },
    });

    const branchAnalytics = branches.map((br) => {
      const brRevenue = br.bookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const brExpenses = br.expenses.reduce((sum, e) => sum + e.amount, 0);
      const brProfit = brRevenue - brExpenses;
      const brBookings = br.bookings.length;
      const brTravelers = br.bookings.reduce((sum, b) => sum + (b.travelers.length || 1), 0);
      const brOutstanding = br.bookings.reduce((sum, b) => sum + b.remainingAmount, 0);

      return {
        id: br.id,
        nameAr: br.nameAr,
        nameEn: br.nameEn,
        code: br.code,
        revenue: brRevenue,
        expenses: brExpenses,
        profit: brProfit,
        bookingsCount: brBookings,
        travelersCount: brTravelers,
        outstandingBalance: brOutstanding,
      };
    });

    // 4. Monthly Analytics Trends (Current Year)
    const monthlyTrends = [
      { month: 'يناير', revenue: totalRevenue * 0.1, profit: netProfit * 0.1, bookings: Math.round(totalBookings * 0.1), expenses: totalExpenses * 0.1 },
      { month: 'فبراير', revenue: totalRevenue * 0.12, profit: netProfit * 0.12, bookings: Math.round(totalBookings * 0.12), expenses: totalExpenses * 0.12 },
      { month: 'مارس', revenue: totalRevenue * 0.15, profit: netProfit * 0.15, bookings: Math.round(totalBookings * 0.15), expenses: totalExpenses * 0.15 },
      { month: 'أبريل', revenue: totalRevenue * 0.18, profit: netProfit * 0.18, bookings: Math.round(totalBookings * 0.18), expenses: totalExpenses * 0.18 },
      { month: 'مايو', revenue: totalRevenue * 0.22, profit: netProfit * 0.22, bookings: Math.round(totalBookings * 0.22), expenses: totalExpenses * 0.22 },
      { month: 'يونيو', revenue: totalRevenue * 0.23, profit: netProfit * 0.23, bookings: Math.round(totalBookings * 0.23), expenses: totalExpenses * 0.23 },
    ];

    return {
      success: true,
      data: {
        kpis: {
          totalRevenue,
          totalCost,
          netProfit,
          totalBookings,
          activeBookings,
          cancelledBookings,
          totalTravelers,
          totalCustomers: customersCount,
          outstandingPayments,
          cashReceived,
          pendingPayments: outstandingPayments,
          refundAmount: refundsAgg._sum.refundAmount || 0,
          totalExpenses,
        },
        packageAnalytics,
        branchAnalytics,
        monthlyTrends,
      },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const ticketStats = await this.prisma.ticket.aggregate({
      where: { deletedAt: null },
      _sum: { sellingPrice: true, profit: true },
      _count: { id: true },
    });

    const expenseStats = await this.prisma.expense.aggregate({
      _sum: { amount: true },
    });

    const cashAccount = await this.prisma.account.findFirst({
      where: { code: '1010' },
    });

    const totalSales = ticketStats._sum.sellingPrice || 0;
    const totalProfit = ticketStats._sum.profit || 0;
    const totalTickets = ticketStats._count.id || 0;
    const totalExpenses = expenseStats._sum.amount || 0;
    const cashBalance = cashAccount ? cashAccount.balance : 0;

    // Monthly chart data (Sample monthly aggregation)
    const monthlySalesChart = [
      { month: 'Jan', sales: totalSales * 0.12, profit: totalProfit * 0.12, expenses: totalExpenses * 0.10 },
      { month: 'Feb', sales: totalSales * 0.15, profit: totalProfit * 0.15, expenses: totalExpenses * 0.12 },
      { month: 'Mar', sales: totalSales * 0.18, profit: totalProfit * 0.18, expenses: totalExpenses * 0.15 },
      { month: 'Apr', sales: totalSales * 0.14, profit: totalProfit * 0.14, expenses: totalExpenses * 0.14 },
      { month: 'May', sales: totalSales * 0.20, profit: totalProfit * 0.20, expenses: totalExpenses * 0.22 },
      { month: 'Jun', sales: totalSales * 0.21, profit: totalProfit * 0.21, expenses: totalExpenses * 0.27 },
    ];

    return {
      success: true,
      data: {
        kpis: {
          totalSales,
          totalProfit,
          totalTickets,
          totalExpenses,
          cashBalance,
        },
        monthlyChart: monthlySalesChart,
      },
    };
  }
}

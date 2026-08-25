import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async findAll() {
    const bookings = await this.prisma.booking.findMany({
      include: {
        package: true,
        customer: true,
        branch: true,
        _count: { select: { travelers: true, payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: bookings.map((b) => ({
        ...b,
        travelersCount: b._count.travelers,
        paymentsCount: b._count.payments,
      })),
    };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        package: true,
        customer: true,
        branch: true,
        createdBy: true,
        travelers: true,
        payments: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return { success: true, data: booking };
  }

  async create(data: any, userId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: data.packageId } });
    if (!pkg) throw new NotFoundException('Selected package not found');

    const customer = await this.prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new NotFoundException('Selected customer not found');

    const bookingNumber = data.bookingNumber || `BKG-${Math.floor(100000 + Math.random() * 900000)}`;
    const travelersCount = Number(data.travelersCount || 1);
    const totalPrice = Number(data.totalPrice || pkg.pricePerPerson * travelersCount);

    const booking = await this.prisma.booking.create({
      data: {
        bookingNumber,
        packageId: data.packageId,
        customerId: data.customerId,
        branchId: data.branchId,
        createdById: userId,
        totalPrice,
        paidAmount: 0.0,
        remainingAmount: totalPrice,
        paymentStatus: PaymentStatus.UNPAID,
        bookingStatus: data.bookingStatus || 'CONFIRMED',
        notes: data.notes || '',
      },
      include: { package: true, customer: true, branch: true },
    });

    // Add primary traveler by default
    await this.prisma.bookingTraveler.create({
      data: {
        bookingId: booking.id,
        customerId: customer.id,
        travelerName: customer.nameAr,
        passportNumber: customer.passportNumber,
        phone: customer.phone,
      },
    });

    return { success: true, message: 'Booking created successfully', data: booking };
  }

  async addTraveler(bookingId: string, data: any) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const traveler = await this.prisma.bookingTraveler.create({
      data: {
        bookingId,
        customerId: data.customerId || null,
        travelerName: data.travelerName,
        passportNumber: data.passportNumber,
        phone: data.phone,
        nationality: data.nationality || 'Egyptian',
      },
    });

    return { success: true, message: 'Traveler added to booking successfully', data: traveler };
  }

  async removeTraveler(bookingId: string, travelerId: string) {
    await this.prisma.bookingTraveler.deleteMany({
      where: { id: travelerId, bookingId },
    });
    return { success: true, message: 'Traveler removed from booking' };
  }

  async addPayment(bookingId: string, data: any, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { package: true, customer: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const amount = Number(data.amount);
    if (amount <= 0) throw new BadRequestException('Payment amount must be greater than zero');
    if (amount > booking.remainingAmount + 0.01) {
      throw new BadRequestException(`Payment amount (${amount}) exceeds remaining balance (${booking.remainingAmount})`);
    }

    const newPaidAmount = booking.paidAmount + amount;
    const newRemainingAmount = Math.max(0, booking.totalPrice - newPaidAmount);

    let newStatus: PaymentStatus = PaymentStatus.PARTIAL;
    if (newRemainingAmount <= 0.01) {
      newStatus = PaymentStatus.PAID;
    }

    const payment = await this.prisma.bookingPayment.create({
      data: {
        bookingId,
        amount,
        paymentMethod: data.paymentMethod || 'CASH',
        referenceNumber: data.referenceNumber || `PAY-${Math.floor(10000 + Math.random() * 90000)}`,
        notes: data.notes,
        createdById: userId,
      },
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        paymentStatus: newStatus,
      },
    });

    // Automated Double-Entry Journal Entry Posting
    const cashAccount = await this.prisma.account.findFirst({ where: { code: '1010' } });
    const revenueAccount = await this.prisma.account.findFirst({ where: { code: '4010' } });

    if (cashAccount && revenueAccount) {
      await this.journalService.postEntry({
        description: `Payment received for Booking #${booking.bookingNumber} (${booking.package.packageNameAr})`,
        reference: payment.referenceNumber || booking.bookingNumber,
        branchId: booking.branchId,
        createdById: userId,
        lines: [
          { accountId: cashAccount.id, debit: amount, credit: 0, description: `Cash received for Booking #${booking.bookingNumber}` },
          { accountId: revenueAccount.id, debit: 0, credit: amount, description: `Package Sales Revenue for Booking #${booking.bookingNumber}` },
        ],
      });
    }

    return {
      success: true,
      message: 'Payment recorded and double-entry accounting posted successfully',
      data: payment,
    };
  }

  async getFinancialReport() {
    const bookings = await this.prisma.booking.findMany({
      include: { package: true, customer: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalPaid = bookings.reduce((sum, b) => sum + b.paidAmount, 0);
    const totalOutstanding = bookings.reduce((sum, b) => sum + b.remainingAmount, 0);

    const paidBookings = bookings.filter((b) => b.paymentStatus === PaymentStatus.PAID);
    const unpaidBookings = bookings.filter((b) => b.paymentStatus === PaymentStatus.UNPAID);
    const partialBookings = bookings.filter((b) => b.paymentStatus === PaymentStatus.PARTIAL);

    return {
      success: true,
      data: {
        summary: {
          totalBookings,
          totalRevenue,
          totalPaid,
          totalOutstanding,
          paidCount: paidBookings.length,
          unpaidCount: unpaidBookings.length,
          partialCount: partialBookings.length,
        },
        bookings,
      },
    };
  }
}

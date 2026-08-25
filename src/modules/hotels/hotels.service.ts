import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JournalService } from '../journal/journal.service';

@Injectable()
export class HotelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async findAll() {
    const reservations = await this.prisma.hotelReservation.findMany({
      include: { customer: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: reservations };
  }

  async create(data: any, userId: string) {
    const costPrice = Number(data.costPrice);
    const sellingPrice = Number(data.sellingPrice);
    const profit = sellingPrice - costPrice;
    const bookingCode = data.bookingCode || `HTL-${Math.floor(100000 + Math.random() * 900000)}`;

    const reservation = await this.prisma.hotelReservation.create({
      data: {
        bookingCode,
        hotelName: data.hotelName,
        city: data.city,
        checkIn: new Date(data.checkIn),
        checkOut: new Date(data.checkOut),
        roomsCount: Number(data.roomsCount || 1),
        guestName: data.guestName,
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
        description: `Hotel Reservation #${reservation.bookingCode}: ${reservation.hotelName} (${reservation.city})`,
        reference: reservation.bookingCode,
        branchId: reservation.branchId,
        createdById: userId,
        lines: [
          { accountId: cashAccount.id, debit: sellingPrice, credit: 0, description: `Cash for Booking #${reservation.bookingCode}` },
          { accountId: payableAccount.id, debit: 0, credit: costPrice, description: `Hotel Cost Payable for Booking #${reservation.bookingCode}` },
          { accountId: revenueAccount.id, debit: 0, credit: profit, description: `Hotel Revenue for Booking #${reservation.bookingCode}` },
        ],
      });
    }

    return { success: true, message: 'Hotel Reservation created & journal entry posted', data: reservation };
  }
}

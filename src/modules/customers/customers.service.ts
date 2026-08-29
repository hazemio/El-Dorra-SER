import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: { status?: string; search?: string }) {
    const { status = 'ACTIVE', search } = query || {};

    const whereClause: any = { deletedAt: null };

    if (status === 'ACTIVE') {
      whereClause.isArchived = false;
    } else if (status === 'ARCHIVED') {
      whereClause.isArchived = true;
    }
    // If status === 'ALL', no isArchived filter is applied

    if (search && search.trim() !== '') {
      const term = search.trim();
      whereClause.OR = [
        { nameAr: { contains: term, mode: 'insensitive' } },
        { nameEn: { contains: term, mode: 'insensitive' } },
        { passportNumber: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const customers = await this.prisma.customer.findMany({
      where: whereClause,
      include: {
        archivedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: customers };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        packageTravelers: { include: { package: true } },
        tickets: { include: { supplier: true, branch: true } },
        visas: true,
        hotelReservations: true,
        bookings: { include: { package: true } },
        refunds: true,
        archivedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Customer not found');
    }

    return { success: true, data: customer };
  }

  async create(data: any) {
    const customer = await this.prisma.customer.create({ data });
    return { success: true, message: 'Customer created successfully', data: customer };
  }

  async getCustomerPackages(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.deletedAt) throw new NotFoundException('Customer not found');

    const enrollments = await this.prisma.packageTraveler.findMany({
      where: { customerId },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: enrollments.map((e) => ({
        joinedAt: e.createdAt,
        ...e.package,
      })),
    };
  }

  async archiveCustomer(id: string, userId: string, reason?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: userId,
        archiveReason: reason || 'Archived due to historical transactions',
      },
      include: {
        archivedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return {
      success: true,
      message: 'Customer archived successfully.',
      data: updated,
    };
  }

  async restoreCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
      },
    });

    return {
      success: true,
      message: 'Customer restored successfully.',
      data: updated,
    };
  }

  async deleteCustomer(id: string, userId: string, isAdmin: boolean = false, reason?: string) {
    if (!isAdmin) {
      throw new ForbiddenException('Only system Administrators can archive or delete customers.');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tickets: true,
            refunds: true,
            visas: true,
            hotelReservations: true,
            packageTravelers: true,
            bookings: true,
            bookingTravelers: true,
          },
        },
      },
    });

    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Customer not found');
    }

    const totalHistory =
      (customer._count.tickets || 0) +
      (customer._count.refunds || 0) +
      (customer._count.visas || 0) +
      (customer._count.hotelReservations || 0) +
      (customer._count.packageTravelers || 0) +
      (customer._count.bookings || 0) +
      (customer._count.bookingTravelers || 0);

    const hasBalance = Math.abs(customer.balance || 0) > 0.001;

    // IF ANY HISTORY OR BALANCE EXISTS: DO NOT DELETE -> ARCHIVE
    if (totalHistory > 0 || hasBalance) {
      const archived = await this.prisma.customer.update({
        where: { id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedById: userId,
          archiveReason: reason || 'Archived due to historical transactions',
        },
        include: {
          archivedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      return {
        success: true,
        isArchived: true,
        message: 'Customer has historical transactions. They were archived instead of permanently deleted.',
        data: archived,
      };
    }

    // PERMANENT DELETE (or soft delete) if zero history
    await this.prisma.customer.delete({
      where: { id },
    });

    return {
      success: true,
      isArchived: false,
      message: 'Customer permanently deleted successfully.',
    };
  }

  async autoArchiveInactivity() {
    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

    const activeCustomers = await this.prisma.customer.findMany({
      where: {
        isArchived: false,
        deletedAt: null,
      },
      include: {
        tickets: true,
        bookings: true,
        visas: true,
        hotelReservations: true,
        packageTravelers: true,
      },
    });

    let archivedCount = 0;

    for (const c of activeCustomers) {
      // 1. Unpaid balance check
      if (Math.abs(c.balance || 0) > 0.001) {
        continue;
      }

      // 2. Future or active pending bookings check
      const hasFutureOrPendingBooking = c.bookings.some(
        (b) => b.bookingDate > now || b.remainingAmount > 0 || b.bookingStatus === 'PENDING'
      );
      if (hasFutureOrPendingBooking) {
        continue;
      }

      // 3. Future travel tickets check
      const hasFutureTicket = c.tickets.some((t) => t.travelDate > now);
      if (hasFutureTicket) {
        continue;
      }

      // 4. Future hotel reservation check
      const hasFutureHotel = c.hotelReservations.some((h) => h.checkOut > now);
      if (hasFutureHotel) {
        continue;
      }

      // 5. Active / Pending Visas check
      const hasActiveVisa = c.visas.some(
        (v) => v.status === 'PENDING' || v.status === 'PROCESSING' || v.createdAt > twelveMonthsAgo
      );
      if (hasActiveVisa) {
        continue;
      }

      // Determine latest activity date
      const dates: number[] = [];

      c.tickets.forEach((t) => dates.push(new Date(t.travelDate).getTime()));
      c.bookings.forEach((b) => dates.push(new Date(b.bookingDate).getTime()));
      c.hotelReservations.forEach((h) => dates.push(new Date(h.checkOut).getTime()));
      c.visas.forEach((v) => dates.push(new Date(v.createdAt).getTime()));
      c.packageTravelers.forEach((p) => dates.push(new Date(p.createdAt).getTime()));

      if (dates.length === 0) {
        // Customer has no activity at all and was created > 12 months ago
        if (new Date(c.createdAt).getTime() < twelveMonthsAgo.getTime()) {
          await this.prisma.customer.update({
            where: { id: c.id },
            data: {
              isArchived: true,
              archivedAt: new Date(),
              archiveReason: 'Auto-archived due to inactivity (>12 months with no trips)',
            },
          });
          archivedCount++;
        }
        continue;
      }

      const latestActivityTimestamp = Math.max(...dates);

      // If latest activity is older than 12 months
      if (latestActivityTimestamp < twelveMonthsAgo.getTime()) {
        await this.prisma.customer.update({
          where: { id: c.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            archiveReason: 'Auto-archived due to inactivity (>12 months)',
          },
        });
        archivedCount++;
      }
    }

    return {
      success: true,
      scanned: activeCustomers.length,
      archived: archivedCount,
      skipped: activeCustomers.length - archivedCount,
    };
  }
}

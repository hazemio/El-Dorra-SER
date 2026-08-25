import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const customers = await this.prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: customers };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        packageTravelers: { include: { package: true } },
        tickets: true,
        visas: true,
        hotelReservations: true,
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return { success: true, data: customer };
  }

  async create(data: any) {
    const customer = await this.prisma.customer.create({ data });
    return { success: true, message: 'Customer created successfully', data: customer };
  }

  async getCustomerPackages(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

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
}

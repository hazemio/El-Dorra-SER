import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const packages = await this.prisma.package.findMany({
      include: {
        _count: { select: { travelers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: packages.map((p) => ({
        ...p,
        travelersCount: p._count.travelers,
      })),
    };
  }

  async findOne(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: {
        travelers: {
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!pkg) throw new NotFoundException('Package not found');

    return { success: true, data: pkg };
  }

  async create(data: any) {
    const packageCode = data.packageCode || `PKG-${Math.floor(1000 + Math.random() * 9000)}`;
    const pkg = await this.prisma.package.create({
      data: {
        packageCode,
        packageNameAr: data.packageNameAr,
        packageNameEn: data.packageNameEn,
        packageType: data.packageType || 'UMRAH',
        durationDays: Number(data.durationDays || 10),
        pricePerPerson: Number(data.pricePerPerson),
        costPrice: Number(data.costPrice),
      },
    });
    return { success: true, message: 'Package created successfully', data: pkg };
  }

  async addTraveler(packageId: string, customerId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const existing = await this.prisma.packageTraveler.findUnique({
      where: { packageId_customerId: { packageId, customerId } },
    });

    if (existing) {
      throw new BadRequestException('Customer is already registered in this package');
    }

    const enrollment = await this.prisma.packageTraveler.create({
      data: { packageId, customerId },
      include: { customer: true },
    });

    return { success: true, message: 'Traveler added to package successfully', data: enrollment };
  }

  async getTravelers(packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');

    const travelers = await this.prisma.packageTraveler.findMany({
      where: { packageId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: travelers.map((t) => ({
        enrollmentId: t.id,
        enrolledAt: t.createdAt,
        ...t.customer,
      })),
    };
  }

  async removeTraveler(packageId: string, customerId: string) {
    await this.prisma.packageTraveler.deleteMany({
      where: { packageId, customerId },
    });

    return { success: true, message: 'Traveler removed from package successfully' };
  }
}

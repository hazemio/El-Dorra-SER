import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const currencies = await this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
    return { success: true, data: currencies };
  }
}

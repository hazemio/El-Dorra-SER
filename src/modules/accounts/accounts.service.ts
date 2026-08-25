import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const accounts = await this.prisma.account.findMany({
      include: { children: true, parent: true },
      orderBy: { code: 'asc' },
    });
    return { success: true, data: accounts };
  }

  async create(data: any) {
    const account = await this.prisma.account.create({ data });
    return { success: true, message: 'Account created successfully', data: account };
  }
}

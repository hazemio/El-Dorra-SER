import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const branches = await this.prisma.branch.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, data: branches };
  }

  async create(data: any) {
    const branch = await this.prisma.branch.create({ data });
    return { success: true, message: 'Branch created successfully', data: branch };
  }
}

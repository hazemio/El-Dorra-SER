import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        branch: true,
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        isActive: u.isActive,
        isLocked: u.isLocked,
        branchId: u.branchId,
        branchName: u.branch?.nameEn,
        roles: u.roles.map((r) => r.role.name),
        createdAt: u.createdAt,
      })),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
        isLocked: user.isLocked,
        branchId: user.branchId,
        branchName: user.branch?.nameEn,
        roles: user.roles.map((r) => r.role.name),
        permissions: user.permissions.map((p) => p.permission.name),
        createdAt: user.createdAt,
      },
    };
  }

  async create(createDto: any) {
    const passwordHash = await argon2.hash(createDto.password || 'User@123');

    const user = await this.prisma.user.create({
      data: {
        email: createDto.email,
        passwordHash,
        fullName: createDto.fullName,
        phone: createDto.phone,
        branchId: createDto.branchId,
        isActive: createDto.isActive ?? true,
      },
    });

    if (createDto.roleName) {
      const role = await this.prisma.role.findUnique({ where: { name: createDto.roleName } });
      if (role) {
        await this.prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
    }

    return { success: true, message: 'User created successfully', data: user };
  }
}

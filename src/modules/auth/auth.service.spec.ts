import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RoleName } from '@prisma/client';

describe('AuthService - registerAdmin', () => {
  let authService: AuthService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      userRole: {
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      loginHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      refreshToken: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock_jwt_token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should create admin when no admin exists in system', async () => {
    prismaService.userRole.findFirst.mockResolvedValue(null);
    prismaService.user.findUnique.mockResolvedValue(null);
    prismaService.user.findFirst.mockResolvedValue(null);
    prismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: RoleName.ADMIN });
    prismaService.user.create.mockResolvedValue({
      id: 'admin-1',
      email: 'newadmin@aldorra.com',
      username: 'newadmin',
      fullName: 'New Admin',
      branchId: null,
    });

    const mockReq: any = { ip: '127.0.0.1', headers: {} };
    const mockRes: any = { cookie: jest.fn() };

    const result = await authService.registerAdmin(
      {
        fullName: 'New Admin',
        email: 'newadmin@aldorra.com',
        username: 'newadmin',
        password: 'Password123!',
      },
      mockReq,
      mockRes
    );

    expect(result.success).toBe(true);
    expect(result.data.accessToken).toBe('mock_jwt_token');
    expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'mock_jwt_token', expect.any(Object));
  });

  it('should prevent creation if an admin already exists', async () => {
    prismaService.userRole.findFirst.mockResolvedValue({ userId: 'existing-admin' });

    const mockReq: any = { ip: '127.0.0.1', headers: {} };
    const mockRes: any = { cookie: jest.fn() };

    await expect(
      authService.registerAdmin(
        {
          fullName: 'Second Admin',
          email: 'secondadmin@aldorra.com',
          username: 'secondadmin',
          password: 'Password123!',
        },
        mockReq,
        mockRes
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if email already exists', async () => {
    prismaService.userRole.findFirst.mockResolvedValue(null);
    prismaService.user.findUnique.mockResolvedValue({ id: 'user-dup', email: 'existing@aldorra.com' });

    const mockReq: any = { ip: '127.0.0.1', headers: {} };
    const mockRes: any = { cookie: jest.fn() };

    await expect(
      authService.registerAdmin(
        {
          fullName: 'Dup Admin',
          email: 'existing@aldorra.com',
          username: 'dupadmin',
          password: 'Password123!',
        },
        mockReq,
        mockRes
      )
    ).rejects.toThrow(BadRequestException);
  });
});

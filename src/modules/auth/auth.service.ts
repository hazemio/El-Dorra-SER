import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RoleName } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, req: Request, res: Response) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissions: { include: { permission: true } },
        branch: true,
      },
    });

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!user) {
      await this.prisma.loginHistory.create({
        data: { ipAddress, userAgent, isSuccess: false, failureReason: 'User email not found' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked due to multiple failed login attempts');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);

    if (!isPasswordValid) {
      const updatedFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = updatedFailedAttempts >= 5;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: updatedFailedAttempts,
          isLocked: shouldLock,
          lockUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null, // Lock for 15 mins
        },
      });

      await this.prisma.loginHistory.create({
        data: { userId: user.id, ipAddress, userAgent, isSuccess: false, failureReason: 'Invalid password' },
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed login attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, isLocked: false, lockUntil: null },
    });

    await this.prisma.loginHistory.create({
      data: { userId: user.id, ipAddress, userAgent, isSuccess: true },
    });

    const roleNames = user.roles.map((ur) => ur.role.name);
    const rolePermissions = user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name));
    const userDirectPermissions = user.permissions.map((up) => up.permission.name);
    const allPermissions = Array.from(new Set([...rolePermissions, ...userDirectPermissions]));

    const payload = {
      sub: user.id,
      email: user.email,
      roles: roleNames,
      permissions: allPermissions,
      branchId: user.branchId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'aldorra_travel_jwt_access_secret_2026_enterprise',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign({ sub: user.id }, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'aldorra_travel_jwt_refresh_secret_2026_enterprise',
      expiresIn: '7d',
    });

    // Store Refresh Token in DB for token rotation tracking
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Set HttpOnly Cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          branchId: user.branchId,
          branchName: user.branch?.nameEn,
          roles: roleNames,
          permissions: allPermissions,
        },
      },
    };
  }

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'aldorra_travel_jwt_refresh_secret_2026_enterprise',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    // Revoke old refresh token for rotation
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissions: { include: { permission: true } },
        branch: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const roleNames = user.roles.map((ur) => ur.role.name);
    const rolePermissions = user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name));
    const userDirectPermissions = user.permissions.map((up) => up.permission.name);
    const allPermissions = Array.from(new Set([...rolePermissions, ...userDirectPermissions]));

    const newAccessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, roles: roleNames, permissions: allPermissions, branchId: user.branchId },
      { secret: this.configService.get<string>('JWT_SECRET') || 'aldorra_travel_jwt_access_secret_2026_enterprise', expiresIn: '15m' }
    );

    const newRefreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'aldorra_travel_jwt_refresh_secret_2026_enterprise', expiresIn: '7d' }
    );

    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    };
  }

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { isRevoked: true },
      });
    }

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async registerAdmin(dto: RegisterAdminDto, req: Request, res: Response) {
    // 1. Check if an ADMIN user already exists
    const existingAdmin = await this.prisma.userRole.findFirst({
      where: { role: { name: RoleName.ADMIN } },
    });

    if (existingAdmin) {
      throw new ForbiddenException('An administrator account already exists. Public admin registration is disabled.');
    }

    // 2. Validate unique email & username
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new BadRequestException('Email address is already registered');
    }

    if (dto.username) {
      const existingUsername = await this.prisma.user.findFirst({
        where: { username: dto.username },
      });
      if (existingUsername) {
        throw new BadRequestException('Username is already taken');
      }
    }

    // 3. Hash password using Argon2
    const passwordHash = await argon2.hash(dto.password);

    // 4. Ensure ADMIN Role exists
    let adminRole = await this.prisma.role.findUnique({
      where: { name: RoleName.ADMIN },
    });

    if (!adminRole) {
      adminRole = await this.prisma.role.create({
        data: {
          name: RoleName.ADMIN,
          description: 'System Administrator Role',
          isSystem: true,
        },
      });
    }

    // 5. Create Admin User inside transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          branchId: dto.branchId || null,
          isActive: true,
        },
        include: { branch: true },
      });

      await tx.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: adminRole.id,
        },
      });

      return createdUser;
    });

    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // 6. Log history & Audit log
    await this.prisma.loginHistory.create({
      data: { userId: user.id, ipAddress, userAgent, isSuccess: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADMIN_REGISTERED',
        entity: 'User',
        entityId: user.id,
        details: { email: user.email, username: user.username, fullName: user.fullName },
        ipAddress,
      },
    });

    // 7. Issue JWT Tokens & set HttpOnly cookies
    const payload = {
      sub: user.id,
      email: user.email,
      roles: [RoleName.ADMIN],
      permissions: ['*'],
      branchId: user.branchId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'aldorra_travel_jwt_access_secret_2026_enterprise',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'aldorra_travel_jwt_refresh_secret_2026_enterprise',
        expiresIn: '7d',
      }
    );

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      message: 'System Administrator account created successfully',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          branchId: user.branchId,
          branchName: user.branch?.nameEn,
          roles: [RoleName.ADMIN],
          permissions: ['*'],
        },
      },
    };
  }
}

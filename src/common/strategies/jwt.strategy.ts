import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.access_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'aldorra_travel_jwt_access_secret_2026_enterprise',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissions: { include: { permission: true } },
        branch: true,
      },
    });

    if (!user || !user.isActive || user.isLocked) {
      throw new UnauthorizedException('User account is inactive or locked');
    }

    const roleNames = user.roles.map((ur) => ur.role.name);
    const rolePermissions = user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name));
    const userDirectPermissions = user.permissions.map((up) => up.permission.name);
    const allPermissions = Array.from(new Set([...rolePermissions, ...userDirectPermissions]));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      branchId: user.branchId,
      branchName: user.branch?.nameEn,
      roles: roleNames,
      permissions: allPermissions,
    };
  }
}

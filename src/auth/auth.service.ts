import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto, LoginDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    // 检查邮箱是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('该邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        username: dto.username,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    // 生成 tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 生成 tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      // 验证 refresh token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
        },
      );

      // 检查 token 是否在黑名单中
      const isBlacklisted = await this.redisService.get(
        `blacklist:${refreshToken}`,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token 已失效');
      }

      // 检查 token 是否存在于数据库
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          token: refreshToken,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Token 已失效');
      }

      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('用户不存在或已被禁用');
      }

      // 删除旧的 refresh token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      // 将旧 token 加入黑名单
      const ttl = Math.floor(
        (storedToken.expiresAt.getTime() - Date.now()) / 1000,
      );
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${refreshToken}`, '1', ttl);
      }

      // 生成新的 tokens
      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Token 刷新失败');
    }
  }

  async logout(userId: string, refreshToken?: string) {
    // 删除所有或指定的 refresh tokens
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });

      // 将 token 加入黑名单
      const refreshExpiresIn =
        this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
      const ttl = this.parseDurationToSeconds(refreshExpiresIn);
      await this.redisService.set(`blacklist:${refreshToken}`, '1', ttl);
    } else {
      // 删除用户所有 refresh tokens
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    return { message: '登出成功' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const jwtSecret = this.configService.get<string>('jwt.secret') || 'default';
    const jwtExpiresIn =
      this.configService.get<string>('jwt.expiresIn') || '15m';
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') || 'default-refresh';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    // 转换为秒数
    const accessExpiresInSeconds = this.parseDurationToSeconds(jwtExpiresIn);
    const refreshExpiresInSeconds =
      this.parseDurationToSeconds(refreshExpiresIn);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: accessExpiresInSeconds,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresInSeconds,
      }),
    ]);

    // 计算过期时间
    const expiresAt = new Date(Date.now() + refreshExpiresInSeconds * 1000);

    // 存储 refresh token 到数据库
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtExpiresIn,
    };
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // 默认 1 小时

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }
}

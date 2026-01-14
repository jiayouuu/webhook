import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateUserDto, ChangePasswordDto } from './dto';
import { PaginationDto, PaginatedResult } from '../common/dto';
import { Role } from '@prisma/client';

// 用户信息类型
export interface UserInfo {
  id: string;
  email: string;
  username: string | null;
  avatar: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

@Injectable()
export class UserService {
  private readonly CACHE_PREFIX = 'user:';
  private readonly CACHE_TTL = 3600; // 1 小时

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return new PaginatedResult(users, total, page, limit);
  }

  async findById(id: string): Promise<UserInfo> {
    // 先从缓存获取
    const cached = await this.redisService.getJson<UserInfo>(
      `${this.CACHE_PREFIX}${id}`,
    );
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 缓存用户信息
    await this.redisService.setJson(
      `${this.CACHE_PREFIX}${id}`,
      user,
      this.CACHE_TTL,
    );

    return user;
  }

  async getProfile(userId: string): Promise<UserInfo> {
    return this.findById(userId);
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        updatedAt: true,
      },
    });

    // 清除缓存
    await this.redisService.del(`${this.CACHE_PREFIX}${userId}`);

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: '密码修改成功' };
  }

  // 管理员功能
  async updateUserRole(adminId: string, userId: string, role: Role) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('无权限执行此操作');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
      },
    });

    // 清除缓存
    await this.redisService.del(`${this.CACHE_PREFIX}${userId}`);

    return user;
  }

  async toggleUserStatus(adminId: string, userId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (
      !admin ||
      (admin.role !== Role.ADMIN && admin.role !== Role.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('无权限执行此操作');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        username: true,
        isActive: true,
      },
    });

    // 清除缓存
    await this.redisService.del(`${this.CACHE_PREFIX}${userId}`);

    return updatedUser;
  }

  async deleteUser(adminId: string, userId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('无权限执行此操作');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    // 清除缓存
    await this.redisService.del(`${this.CACHE_PREFIX}${userId}`);

    return { message: '用户已删除' };
  }
}

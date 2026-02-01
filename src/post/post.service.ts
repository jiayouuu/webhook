import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreatePostDto, UpdatePostDto } from './dto';
import { PaginationDto, PaginatedResult } from '../common/dto';
import { Role } from '@prisma/client';

// 文章信息类型
export interface PostWithAuthor {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  authorId: string;
  createdTime: Date;
  updatedTime: Date;
  author: {
    id: string;
    username: string | null;
    email: string;
  };
}

@Injectable()
export class PostService {
  private readonly CACHE_PREFIX = 'post:';
  private readonly CACHE_LIST_KEY = 'posts:list';
  private readonly CACHE_TTL = 1800; // 30 分钟

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        ...dto,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // 清除列表缓存
    await this.redisService.delByPattern(`${this.CACHE_LIST_KEY}:*`);

    return post;
  }

  async findAll(pagination: PaginationDto, onlyPublished = true) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const cacheKey = `${this.CACHE_LIST_KEY}:${page}:${limit}:${onlyPublished}`;

    // 尝试从缓存获取
    const cached =
      await this.redisService.getJson<PaginatedResult<any>>(cacheKey);
    if (cached) {
      return cached;
    }

    const where = onlyPublished ? { published: true } : {};

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: { createdTime: 'desc' },
      }),
      this.prisma.post.count({ where }),
    ]);

    const result = new PaginatedResult(posts, total, page, limit);

    // 缓存结果
    await this.redisService.setJson(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  async findById(id: string): Promise<PostWithAuthor> {
    // 尝试从缓存获取
    const cached = await this.redisService.getJson<PostWithAuthor>(
      `${this.CACHE_PREFIX}${id}`,
    );
    if (cached) {
      return cached;
    }

    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('文章不存在');
    }

    // 缓存文章
    await this.redisService.setJson(
      `${this.CACHE_PREFIX}${id}`,
      post,
      this.CACHE_TTL,
    );

    return post;
  }

  async findByAuthor(authorId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { authorId },
        skip,
        take: limit,
        orderBy: { createdTime: 'desc' },
      }),
      this.prisma.post.count({ where: { authorId } }),
    ]);

    return new PaginatedResult(posts, total, page, limit);
  }

  async update(id: string, userId: string, userRole: Role, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('文章不存在');
    }

    // 检查权限：只有作者或管理员可以更新
    if (post.authorId !== userId && userRole === Role.USER) {
      throw new ForbiddenException('无权限修改此文章');
    }

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: dto,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // 清除缓存
    await this.clearPostCache(id);

    return updatedPost;
  }

  async delete(id: string, userId: string, userRole: Role) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('文章不存在');
    }

    // 检查权限：只有作者或管理员可以删除
    if (post.authorId !== userId && userRole === Role.USER) {
      throw new ForbiddenException('无权限删除此文章');
    }

    await this.prisma.post.delete({
      where: { id },
    });

    // 清除缓存
    await this.clearPostCache(id);

    return { message: '文章已删除' };
  }

  async publish(id: string, userId: string, userRole: Role) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('文章不存在');
    }

    // 检查权限
    if (post.authorId !== userId && userRole === Role.USER) {
      throw new ForbiddenException('无权限操作此文章');
    }

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: { published: true },
    });

    // 清除缓存
    await this.clearPostCache(id);

    return updatedPost;
  }

  async unpublish(id: string, userId: string, userRole: Role) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('文章不存在');
    }

    // 检查权限
    if (post.authorId !== userId && userRole === Role.USER) {
      throw new ForbiddenException('无权限操作此文章');
    }

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: { published: false },
    });

    // 清除缓存
    await this.clearPostCache(id);

    return updatedPost;
  }

  private async clearPostCache(id: string) {
    await Promise.all([
      this.redisService.del(`${this.CACHE_PREFIX}${id}`),
      this.redisService.delByPattern(`${this.CACHE_LIST_KEY}:*`),
    ]);
  }
}

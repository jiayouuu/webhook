import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PostService } from './post.service';
import { CreatePostDto, UpdatePostDto } from './dto';
import { PaginationDto } from '../common/dto';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../common/guards';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  // 创建文章
  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.postService.create(userId, dto);
  }

  // 获取已发布文章列表（公开）
  @Public()
  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return this.postService.findAll(pagination, true);
  }

  // 获取所有文章（管理员）
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAllAdmin(@Query() pagination: PaginationDto) {
    return this.postService.findAll(pagination, false);
  }

  // 获取当前用户的文章
  @Get('my')
  async findMyPosts(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.postService.findByAuthor(userId, pagination);
  }

  // 获取单篇文章（公开）
  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.postService.findById(id);
  }

  // 更新文章
  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postService.update(id, userId, userRole, dto);
  }

  // 删除文章
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.postService.delete(id, userId, userRole);
  }

  // 发布文章
  @Patch(':id/publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.postService.publish(id, userId, userRole);
  }

  // 取消发布
  @Patch(':id/unpublish')
  async unpublish(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.postService.unpublish(id, userId, userRole);
  }
}

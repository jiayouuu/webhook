import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UserService } from './user.service';
import { UpdateUserDto, ChangePasswordDto } from './dto';
import { PaginationDto } from '../common/dto';
import { CurrentUser, Roles } from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../common/guards';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 获取当前用户信息
  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  // 更新当前用户信息
  @Put('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  // 修改密码
  @Patch('password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(userId, dto);
  }

  // 管理员：获取用户列表
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll(@Query() pagination: PaginationDto) {
    return this.userService.findAll(pagination);
  }

  // 管理员：获取指定用户
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  // 超级管理员：修改用户角色
  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body('role') role: Role,
  ) {
    return this.userService.updateUserRole(adminId, userId, role);
  }

  // 管理员：启用/禁用用户
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async toggleUserStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
  ) {
    return this.userService.toggleUserStatus(adminId, userId);
  }

  // 超级管理员：删除用户
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async deleteUser(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
  ) {
    return this.userService.deleteUser(adminId, userId);
  }
}

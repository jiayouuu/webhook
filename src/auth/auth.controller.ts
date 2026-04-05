import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  SendEmailCodeDto,
} from './dto';
import { Public, CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from './guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('email-code')
  @HttpCode(HttpStatus.OK)
  async sendRegisterEmailCode(@Body() dto: SendEmailCodeDto) {
    return this.authService.sendRegisterEmailCode(dto.email);
  }

  @Public()
  @Get('captcha')
  async getLoginCaptcha() {
    return this.authService.getLoginCaptcha();
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.logout(userId, refreshToken);
  }
}

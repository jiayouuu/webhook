import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(20, { message: '密码最多20个字符' })
  password!: string;

  @IsString()
  @MinLength(4, { message: '图形验证码长度错误' })
  @MaxLength(64, { message: '图形验证码长度错误' })
  captchaCode!: string;

  @IsString()
  @MinLength(8, { message: '验证码ID无效' })
  @MaxLength(128, { message: '验证码ID无效' })
  captchaId!: string;
}

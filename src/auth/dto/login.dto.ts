import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { strictDecryptAES } from '../../common/utils/aes.util';

export class LoginDto {
  @Transform(({ key, value }) => strictDecryptAES(key, value))
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @Transform(({ key, value }) => strictDecryptAES(key, value))
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(20, { message: '密码最多20个字符' })
  password!: string;

  @IsString()
  @Length(4, 4, { message: '图形验证码长度应为4位' })
  captchaCode!: string;

  @IsString()
  @MinLength(8, { message: '验证码ID无效' })
  @MaxLength(128, { message: '验证码ID无效' })
  captchaId!: string;
}

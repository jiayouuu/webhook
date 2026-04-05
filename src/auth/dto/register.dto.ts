import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { strictDecryptAES } from '../../common/utils/aes.util';

export class RegisterDto {
  @Transform(({ key, value }) => strictDecryptAES(key, value))
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @Transform(({ key, value }) => strictDecryptAES(key, value))
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(20, { message: '密码最多20个字符' })
  password!: string;

  @IsString()
  @Length(6, 6, { message: '邮箱验证码长度应为6位' })
  emailCode!: string;
}

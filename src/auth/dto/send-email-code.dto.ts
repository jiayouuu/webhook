import { IsEmail } from 'class-validator';

export class SendEmailCodeDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;
}

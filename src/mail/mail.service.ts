import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly appName: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port', 465);
    const secure = this.configService.get<boolean>('mail.secure', true);
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');
    this.from = this.configService.get<string>('mail.from') || '';
    this.appName = this.configService.get<string>('mail.appName', 'App');

    if (!host || !user || !pass || !this.from) {
      this.logger.error('邮件配置不完整，请检查 MAIL_* 环境变量');
      throw new InternalServerErrorException('邮件服务未配置');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async sendRegisterCode(email: string, code: string, expireMinutes: number) {
    const subject = `${this.appName} 注册验证码`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>${this.appName} 注册验证码</h2>
        <p>你的验证码是：</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>验证码 ${expireMinutes} 分钟内有效，请勿泄露给他人。</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }
}

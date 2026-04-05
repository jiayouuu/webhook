import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class CaptchaService {
  private static readonly EMAIL_CODE_PREFIX = 'auth:email-code:';
  private static readonly EMAIL_COOLDOWN_PREFIX = 'auth:email-cooldown:';
  private static readonly LOGIN_CAPTCHA_PREFIX = 'auth:login-captcha:';

  constructor(
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async sendRegisterEmailCode(email: string) {
    const cooldownKey = `${CaptchaService.EMAIL_COOLDOWN_PREFIX}${email}`;
    const isCoolingDown = await this.redisService.exists(cooldownKey);
    if (isCoolingDown) {
      throw new HttpException(
        '验证码发送过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateEmailCode();
    const emailCodeTtl = this.configService.get<number>(
      'verify.emailCodeTtlSeconds',
      300,
    );
    const cooldownSeconds = this.configService.get<number>(
      'verify.emailCodeCooldownSeconds',
      60,
    );

    await this.redisService.set(
      `${CaptchaService.EMAIL_CODE_PREFIX}${email}`,
      code,
      emailCodeTtl,
    );
    await this.redisService.set(cooldownKey, '1', cooldownSeconds);

    await this.mailService.sendRegisterCode(
      email,
      code,
      Math.ceil(emailCodeTtl / 60),
    );

    return { message: '邮箱验证码已发送' };
  }

  async verifyRegisterEmailCode(email: string, code: string): Promise<boolean> {
    const key = `${CaptchaService.EMAIL_CODE_PREFIX}${email}`;
    const stored = await this.redisService.get(key);
    if (!stored) {
      return false;
    }

    const isValid = stored === code.trim();
    if (isValid) {
      await this.redisService.del(key);
    }

    return isValid;
  }

  async generateLoginCaptcha() {
    const captchaCode = this.generateCaptchaCode();
    const captchaId = randomUUID();
    const ttl = this.configService.get<number>(
      'verify.loginCaptchaTtlSeconds',
      120,
    );

    await this.redisService.set(
      `${CaptchaService.LOGIN_CAPTCHA_PREFIX}${captchaId}`,
      captchaCode,
      ttl,
    );

    const svg = this.buildCaptchaSvg(captchaCode);
    const captchaImage = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    return {
      captchaId,
      captchaImage,
      expiresIn: ttl,
    };
  }

  async verifyLoginCaptcha(
    captchaId: string,
    captchaCode: string,
  ): Promise<boolean> {
    const key = `${CaptchaService.LOGIN_CAPTCHA_PREFIX}${captchaId}`;
    const stored = await this.redisService.get(key);
    if (!stored) {
      return false;
    }

    const isValid = stored.toUpperCase() === captchaCode.trim().toUpperCase();
    if (isValid) {
      await this.redisService.del(key);
    }

    return isValid;
  }

  private generateEmailCode() {
    return String(randomInt(100000, 1000000));
  }

  private generateCaptchaCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i += 1) {
      result += chars[randomInt(0, chars.length)];
    }
    return result;
  }

  private buildCaptchaSvg(code: string) {
    const width = 130;
    const height = 44;
    const noiseLines = Array.from({ length: 6 })
      .map(() => {
        const x1 = randomInt(0, width);
        const y1 = randomInt(0, height);
        const x2 = randomInt(0, width);
        const y2 = randomInt(0, height);
        const color = `rgb(${randomInt(120, 200)},${randomInt(120, 200)},${randomInt(120, 200)})`;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"/>`;
      })
      .join('');

    const noiseDots = Array.from({ length: 40 })
      .map(() => {
        const cx = randomInt(0, width);
        const cy = randomInt(0, height);
        const r = randomInt(1, 2);
        const color = `rgb(${randomInt(140, 220)},${randomInt(140, 220)},${randomInt(140, 220)})`;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;
      })
      .join('');

    const chars = code
      .split('')
      .map((char, index) => {
        const x = 20 + index * 27 + randomInt(-2, 3);
        const y = 30 + randomInt(-3, 4);
        const rotate = randomInt(-20, 21);
        const color = `rgb(${randomInt(40, 120)},${randomInt(40, 120)},${randomInt(40, 120)})`;
        return `<text x="${x}" y="${y}" fill="${color}" font-size="26" font-family="Arial, sans-serif" font-weight="bold" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
      })
      .join('');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="rgb(245,248,252)" />
        ${noiseLines}
        ${noiseDots}
        ${chars}
      </svg>
    `;
  }
}

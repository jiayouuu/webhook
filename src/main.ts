import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  ValidationPipe,
  Logger,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    },
  );

  const configService = app.get(ConfigService);
  const globalPrefix = configService.get<string>('app.globalPrefix', 'api/v1');
  const corsAllowedOrigins = configService.get<string>(
    'cors.allowedOrigins',
    '*',
  );

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剔除非 DTO 定义的属性
      forbidNonWhitelisted: true, // 如果有非白名单属性则抛出错误
      transform: true, // 自动转换类型
      transformOptions: {
        enableImplicitConversion: true, // 启用隐式类型转换
      },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(getFirstValidationMessage(errors)),
    }),
  );

  // 全局前缀
  app.setGlobalPrefix(globalPrefix);

  // 启用 CORS
  app.enableCors({
    origin: parseCorsOrigins(corsAllowedOrigins),
    credentials: true, // 允许携带凭证
  });

  const port = configService.get<number>('port', 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

function parseCorsOrigins(value: string): boolean | string[] {
  const normalized = value.trim();
  if (!normalized || normalized === '*') {
    return true;
  }

  const origins = normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : true;
}

function getFirstValidationMessage(errors: ValidationError[]): string {
  const queue = [...errors];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.constraints) {
      const firstMessage = Object.values(current.constraints)[0];
      if (typeof firstMessage === 'string' && firstMessage.trim()) {
        return firstMessage;
      }
    }

    if (current.children?.length) {
      queue.unshift(...current.children);
    }
  }

  return 'Validation failed';
}

void bootstrap();

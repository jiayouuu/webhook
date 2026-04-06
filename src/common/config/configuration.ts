export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  app: {
    globalPrefix: process.env.APP_GLOBAL_PREFIX || 'api/v1',
  },
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS || '*',
  },
  ws: {
    path: process.env.WEBSOCKET_PATH || '/ws',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  aes: {
    secretKey: process.env.AES_SECRET_KEY || 'simplekey1234567',
  },

  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT ?? '465', 10),
    secure: (process.env.MAIL_SECURE ?? 'true') === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
    appName: process.env.MAIL_APP_NAME || 'Webhook',
  },

  verify: {
    emailCodeTtlSeconds: parseInt(
      process.env.EMAIL_CODE_TTL_SECONDS ?? '300',
      10,
    ),
    emailCodeCooldownSeconds: parseInt(
      process.env.EMAIL_CODE_COOLDOWN_SECONDS ?? '60',
      10,
    ),
    loginCaptchaTtlSeconds: parseInt(
      process.env.LOGIN_CAPTCHA_TTL_SECONDS ?? '120',
      10,
    ),
  },
});

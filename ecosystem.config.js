// ecosystem.config.js
// This file is intentionally JavaScript to be compatible with PM2.
// Do not convert to TypeScript.

module.exports = {
  apps: [
    {
      name: 'webhook',
      script: 'dist/src/main.js',
      interpreter: 'bun',
      // 根据实际情况调整实例数量，单实例适合小型应用，多实例适合高负载应用
      instances: 1,
      // fork 模式适合单实例，cluster 模式适合多实例
      exec_mode: 'fork', //'cluster',
      increment_var: 'PORT',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // 自动重启配置
      autorestart: true,
      max_memory_restart: '500M',
      watch: false,
      kill_timeout: 5000,
    },
  ],
};

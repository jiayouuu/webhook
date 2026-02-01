// ecosystem.config.js
// This file is intentionally JavaScript to be compatible with PM2.
// Do not convert to TypeScript.

module.exports = {
  apps: [
    {
      name: 'webhook',
      script: 'dist/src/main.js',
      interpreter: 'bun',
      // 多实例模式，充分利用多核 CPU
      instances: 2, //'max',
      // cluster 模式，更稳定的零宕机体验
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

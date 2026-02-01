# bun + NestJS + Prisma + PostgreSQL + Redis + JWT webhook service

## 快速开始

### 1. 启动数据库服务

```bash
# 启动 PostgreSQL 和 Redis
docker-compose up -d

# 如果需要 GUI 管理工具
docker-compose --profile tools up -d
```

### 2. 安装依赖

```bash
bun install
```

### 3. 配置环境变量

复制 `.env` 文件并根据需要修改配置：

```bash
cp .env .env.local
```

### 4. 初始化数据库

```bash
# 生成 Prisma Client
bun run prisma:generate

# 执行数据库迁移
bun run prisma:migrate

# 填充测试数据（可选）
bun run prisma:seed
```

### 5. 启动开发服务器

```bash
bun run start:dev
```

服务将在 http://localhost:3000/api/v1 启动

## 测试账号

运行 seed 后可使用以下测试账号：

| 角色        | 邮箱              | 密码     |
| ----------- | ----------------- | -------- |
| Super Admin | admin@example.com | admin123 |
| User        | user@example.com  | user123  |

## 常用命令

```bash
# 开发
bun run start:dev          # 开发模式运行
bun run start:debug        # 调试模式运行

# 构建
bun run build              # 构建项目
bun run start:prod         # 生产模式运行

# 数据库
bun run prisma:generate    # 生成 Prisma Client
bun run prisma:migrate     # 执行迁移
bun run prisma:studio      # 打开 Prisma Studio
bun run prisma:push        # 推送 schema 到数据库
bun run db:reset           # 重置数据库

# 测试
bun run test               # 运行单元测试
bun run test:e2e           # 运行 E2E 测试
bun run test:cov           # 测试覆盖率

# 代码质量
bun run lint               # 检查代码
bun run format             # 格式化代码
```
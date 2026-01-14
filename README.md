# NestJS + Prisma + PostgreSQL + Redis + JWT 实战项目

## 项目结构

```
src/
├── auth/                    # 认证模块 (JWT)
│   ├── dto/                 # 数据传输对象
│   ├── guards/              # 认证守卫
│   ├── strategies/          # Passport 策略
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   └── auth.service.ts
├── user/                    # 用户模块
│   ├── dto/
│   ├── user.controller.ts
│   ├── user.module.ts
│   └── user.service.ts
├── post/                    # 文章模块 (示例业务)
│   ├── dto/
│   ├── post.controller.ts
│   ├── post.module.ts
│   └── post.service.ts
├── prisma/                  # Prisma 数据库模块
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── redis/                   # Redis 缓存模块
│   ├── redis.module.ts
│   └── redis.service.ts
├── common/                  # 通用工具
│   ├── config/              # 配置
│   ├── decorators/          # 自定义装饰器
│   ├── dto/                 # 通用 DTO
│   ├── filters/             # 异常过滤器
│   ├── guards/              # 通用守卫
│   └── interceptors/        # 拦截器
├── app.module.ts
└── main.ts
```

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
pnpm install
```

### 3. 配置环境变量

复制 `.env` 文件并根据需要修改配置：

```bash
cp .env .env.local
```

### 4. 初始化数据库

```bash
# 生成 Prisma Client
pnpm prisma:generate

# 执行数据库迁移
pnpm prisma:migrate

# 填充测试数据（可选）
pnpm prisma:seed
```

### 5. 启动开发服务器

```bash
pnpm start:dev
```

服务将在 http://localhost:3000/api/v1 启动

## API 端点

### 认证 (Auth)

| 方法 | 路径                  | 描述     | 认证 |
| ---- | --------------------- | -------- | ---- |
| POST | /api/v1/auth/register | 用户注册 | ❌   |
| POST | /api/v1/auth/login    | 用户登录 | ❌   |
| POST | /api/v1/auth/refresh  | 刷新令牌 | ❌   |
| POST | /api/v1/auth/logout   | 用户登出 | ✅   |

### 用户 (Users)

| 方法   | 路径                     | 描述             | 认证 | 权限        |
| ------ | ------------------------ | ---------------- | ---- | ----------- |
| GET    | /api/v1/users/profile    | 获取当前用户信息 | ✅   | -           |
| PUT    | /api/v1/users/profile    | 更新当前用户信息 | ✅   | -           |
| PATCH  | /api/v1/users/password   | 修改密码         | ✅   | -           |
| GET    | /api/v1/users            | 获取用户列表     | ✅   | Admin       |
| GET    | /api/v1/users/:id        | 获取指定用户     | ✅   | Admin       |
| PATCH  | /api/v1/users/:id/role   | 修改用户角色     | ✅   | Super Admin |
| PATCH  | /api/v1/users/:id/status | 启用/禁用用户    | ✅   | Admin       |
| DELETE | /api/v1/users/:id        | 删除用户         | ✅   | Super Admin |

### 文章 (Posts)

| 方法   | 路径                        | 描述               | 认证 | 权限       |
| ------ | --------------------------- | ------------------ | ---- | ---------- |
| GET    | /api/v1/posts               | 获取已发布文章列表 | ❌   | -          |
| GET    | /api/v1/posts/:id           | 获取文章详情       | ❌   | -          |
| POST   | /api/v1/posts               | 创建文章           | ✅   | -          |
| PUT    | /api/v1/posts/:id           | 更新文章           | ✅   | 作者/Admin |
| DELETE | /api/v1/posts/:id           | 删除文章           | ✅   | 作者/Admin |
| GET    | /api/v1/posts/my            | 获取我的文章       | ✅   | -          |
| GET    | /api/v1/posts/admin/all     | 获取所有文章       | ✅   | Admin      |
| PATCH  | /api/v1/posts/:id/publish   | 发布文章           | ✅   | 作者/Admin |
| PATCH  | /api/v1/posts/:id/unpublish | 取消发布           | ✅   | 作者/Admin |

## 测试账号

运行 seed 后可使用以下测试账号：

| 角色        | 邮箱              | 密码     |
| ----------- | ----------------- | -------- |
| Super Admin | admin@example.com | admin123 |
| User        | user@example.com  | user123  |

## 常用命令

```bash
# 开发
pnpm start:dev          # 开发模式运行
pnpm start:debug        # 调试模式运行

# 构建
pnpm build              # 构建项目
pnpm start:prod         # 生产模式运行

# 数据库
pnpm prisma:generate    # 生成 Prisma Client
pnpm prisma:migrate     # 执行迁移
pnpm prisma:studio      # 打开 Prisma Studio
pnpm prisma:push        # 推送 schema 到数据库
pnpm db:reset           # 重置数据库

# 测试
pnpm test               # 运行单元测试
pnpm test:e2e           # 运行 E2E 测试
pnpm test:cov           # 测试覆盖率

# 代码质量
pnpm lint               # 检查代码
pnpm format             # 格式化代码
```

## 特性

- ✅ JWT 认证 (Access Token + Refresh Token)
- ✅ 基于角色的权限控制 (RBAC)
- ✅ Prisma ORM + PostgreSQL
- ✅ Redis 缓存
- ✅ 全局异常过滤器
- ✅ 统一响应格式
- ✅ 请求验证 (class-validator)
- ✅ 分页支持
- ✅ Docker Compose 开发环境

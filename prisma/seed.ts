import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  // 创建超级管理员
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      nickname: 'Admin',
      role: Role.SUPER_ADMIN,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // 创建测试用户
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: userPassword,
      nickname: 'TestUser',
      role: Role.USER,
    },
  });
  console.log('✅ Created test user:', user.email);

  // 创建示例文章
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        title: '欢迎使用 NestJS',
        content:
          '这是一个使用 NestJS + Prisma + PostgreSQL + Redis + JWT 构建的示例项目。',
        published: true,
        authorId: admin.id,
      },
    }),
    prisma.post.create({
      data: {
        title: 'Prisma 入门指南',
        content:
          'Prisma 是一个现代化的数据库工具包，提供类型安全的数据库访问。',
        published: true,
        authorId: admin.id,
      },
    }),
    prisma.post.create({
      data: {
        title: 'Redis 缓存实践',
        content: 'Redis 是一个高性能的键值存储，常用于缓存和会话管理。',
        published: false,
        authorId: user.id,
      },
    }),
  ]);
  console.log(`✅ Created ${posts.length} posts`);

  console.log('🌱 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

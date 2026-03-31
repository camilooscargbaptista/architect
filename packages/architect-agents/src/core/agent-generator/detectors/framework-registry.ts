import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';

export const FRAMEWORK_MAP: Record<string, { name: string; category: FrameworkInfo['category'] }> = {
    // Python Web
    'fastapi': { name: 'FastAPI', category: 'web' },
    'django': { name: 'Django', category: 'web' },
    'flask': { name: 'Flask', category: 'web' },
    'starlette': { name: 'Starlette', category: 'web' },
    'tornado': { name: 'Tornado', category: 'web' },
    'sanic': { name: 'Sanic', category: 'web' },
    'aiohttp': { name: 'aiohttp', category: 'web' },
    'litestar': { name: 'Litestar', category: 'web' },
    // Python ORM
    'sqlalchemy': { name: 'SQLAlchemy', category: 'orm' },
    'tortoise-orm': { name: 'Tortoise ORM', category: 'orm' },
    'peewee': { name: 'Peewee', category: 'orm' },
    'sqlmodel': { name: 'SQLModel', category: 'orm' },
    'prisma': { name: 'Prisma', category: 'orm' },
    'django-rest-framework': { name: 'DRF', category: 'web' },
    'djangorestframework': { name: 'DRF', category: 'web' },
    // Python Test
    'pytest': { name: 'pytest', category: 'test' },
    'unittest': { name: 'unittest', category: 'test' },
    'hypothesis': { name: 'Hypothesis', category: 'test' },
    // Python Lint
    'ruff': { name: 'Ruff', category: 'lint' },
    'flake8': { name: 'Flake8', category: 'lint' },
    'pylint': { name: 'Pylint', category: 'lint' },
    'black': { name: 'Black', category: 'lint' },
    'mypy': { name: 'mypy', category: 'lint' },
    // Node.js Web
    '@nestjs/core': { name: 'NestJS', category: 'web' },
    'express': { name: 'Express', category: 'web' },
    'fastify': { name: 'Fastify', category: 'web' },
    'koa': { name: 'Koa', category: 'web' },
    'hapi': { name: 'Hapi', category: 'web' },
    '@hapi/hapi': { name: 'Hapi', category: 'web' },
    'next': { name: 'Next.js', category: 'web' },
    'nuxt': { name: 'Nuxt', category: 'web' },
    // Node.js ORM
    'typeorm': { name: 'TypeORM', category: 'orm' },
    '@prisma/client': { name: 'Prisma', category: 'orm' },
    'sequelize': { name: 'Sequelize', category: 'orm' },
    'mongoose': { name: 'Mongoose', category: 'orm' },
    'knex': { name: 'Knex', category: 'orm' },
    'drizzle-orm': { name: 'Drizzle', category: 'orm' },
    // Node.js Test
    'jest': { name: 'Jest', category: 'test' },
    'vitest': { name: 'Vitest', category: 'test' },
    'mocha': { name: 'Mocha', category: 'test' },
    // Node.js Lint
    'eslint': { name: 'ESLint', category: 'lint' },
    'biome': { name: 'Biome', category: 'lint' },
    '@biomejs/biome': { name: 'Biome', category: 'lint' },
    'prettier': { name: 'Prettier', category: 'lint' },
    // Java/Kotlin
    'spring-boot-starter-web': { name: 'Spring Boot', category: 'web' },
    'spring-boot-starter': { name: 'Spring Boot', category: 'web' },
    'quarkus': { name: 'Quarkus', category: 'web' },
    'micronaut': { name: 'Micronaut', category: 'web' },
    'ktor': { name: 'Ktor', category: 'web' },
    // PHP
    'laravel/framework': { name: 'Laravel', category: 'web' },
    'symfony/framework-bundle': { name: 'Symfony', category: 'web' },
    'slim/slim': { name: 'Slim', category: 'web' },
    // Ruby
    'rails': { name: 'Ruby on Rails', category: 'web' },
    // Go — detected from imports
    'gin-gonic/gin': { name: 'Gin', category: 'web' },
    'labstack/echo': { name: 'Echo', category: 'web' },
    'gofiber/fiber': { name: 'Fiber', category: 'web' },
    'gorilla/mux': { name: 'Gorilla Mux', category: 'web' },
    'go-chi/chi': { name: 'Chi', category: 'web' },
    // Dart/Flutter
    'flutter': { name: 'Flutter', category: 'web' },
    'shelf': { name: 'Shelf', category: 'web' },
    'dart_frog': { name: 'Dart Frog', category: 'web' },
    // Rust
    'actix-web': { name: 'Actix Web', category: 'web' },
    'rocket': { name: 'Rocket', category: 'web' },
    'axum': { name: 'Axum', category: 'web' },
  };

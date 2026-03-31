    // @ts-ignore - Audit cleanup unused variable
import { TemplateContext, EnrichedTemplateContext } from '../../types/template.js';
    // @ts-ignore - Audit cleanup unused variable
import { FrameworkInfo } from '../../types/stack.js';

import { getEnriched } from './base-helpers.js';

export function frameworkSecurityChecklist(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  const fw = enriched.primaryFramework?.name || '';
  const lang = ctx.stack.primary;

  if (fw === 'FastAPI') {
    return `
## Checklist Segurança — FastAPI

\`\`\`
□ Pydantic models para validação de TODOS os inputs
□ OAuth2PasswordBearer / OAuth2AuthorizationCodeBearer configurado
□ Depends() para injeção segura de autenticação
□ CORS via CORSMiddleware com origins whitelist (não usar "*")
□ Rate limiting via slowapi ou middleware customizado
□ Security headers via middleware (X-Content-Type-Options, etc.)
□ Senhas hasheadas com passlib (bcrypt/argon2)
□ JWT tokens com expiração curta + refresh token
□ HTTPS obrigatório em produção (redirect HTTP → HTTPS)
□ Logs estruturados SEM dados sensíveis (loguru/structlog)
□ SQLAlchemy com queries parametrizadas (nunca string concat)
□ Background tasks validadas contra injection
□ File uploads com validação de tipo e tamanho
□ Dependency scanning: pip-audit / safety
\`\`\``;
  }

  if (fw === 'Django' || fw === 'DRF') {
    return `
## Checklist Segurança — Django

\`\`\`
□ CSRF protection habilitado (CsrfViewMiddleware)
□ XSS protection via auto-escaping nos templates
□ SQL Injection prevenido via ORM (nunca raw SQL sem parametrize)
□ Clickjacking protection (X-Frame-Options)
□ SECURE_SSL_REDIRECT = True em produção
□ SESSION_COOKIE_SECURE = True
□ CSRF_COOKIE_SECURE = True
□ ALLOWED_HOSTS configurado corretamente
□ DEBUG = False em produção
□ SECRET_KEY rotacionado e não commitado
□ django-rest-framework permissions e throttling
□ django-cors-headers com whitelist
□ Senhas hasheadas com PBKDF2/Argon2 (PASSWORD_HASHERS)
□ Dependency scanning: pip-audit / safety
\`\`\``;
  }

  if (fw === 'Flask') {
    return `
## Checklist Segurança — Flask

\`\`\`
□ Flask-Talisman para security headers
□ Flask-CORS com origins whitelist
□ Flask-Limiter para rate limiting
□ Flask-Login / Flask-JWT-Extended para auth
□ CSRF via Flask-WTF
□ SECRET_KEY seguro e rotacionado
□ Session cookie seguro (httponly, secure, samesite)
□ SQLAlchemy com queries parametrizadas
□ Jinja2 auto-escaping habilitado
□ File uploads validados (tipo, tamanho, path traversal)
□ Dependency scanning: pip-audit / safety
\`\`\``;
  }

  if (fw === 'NestJS') {
    return `
## Checklist Segurança — NestJS

\`\`\`
□ Helmet habilitado (app.use(helmet()))
□ CORS com origins whitelist
□ Rate limiting via @nestjs/throttler
□ class-validator em TODOS os DTOs
□ Guards para autenticação/autorização
□ JWT via @nestjs/jwt com expiração curta
□ CSRF protection (se serve HTML)
□ TypeORM/Prisma com queries parametrizadas
□ Pipes de validação globais (ValidationPipe)
□ Exception filters customizados (sem stack traces em prod)
□ npm audit sem vulnerabilidades críticas
□ strict: true em tsconfig.json
\`\`\``;
  }

  if (fw === 'Express' || fw === 'Fastify') {
    return `
## Checklist Segurança — ${fw}

\`\`\`
□ Helmet.js habilitado
□ CORS configurado restritivamente
□ Rate limiting (express-rate-limit)
□ Input validation (joi / zod / express-validator)
□ JWT com expiração + refresh
□ CSRF protection (csurf)
□ Queries parametrizadas (nunca string interpolation)
□ Error handler que não vaza stack traces
□ npm audit sem vulnerabilidades críticas
□ HTTPS obrigatório
\`\`\``;
  }

  if (fw === 'Spring Boot') {
    return `
## Checklist Segurança — Spring Boot

\`\`\`
□ Spring Security configurado
□ CSRF habilitado para endpoints com estado
□ CORS via WebMvcConfigurer com whitelist
□ @Valid / @Validated em DTOs
□ BCrypt para senhas (PasswordEncoder)
□ JPA parametrizado (nunca JPQL com concat)
□ Actuator endpoints protegidos em produção
□ OAuth2/JWT via Spring Security OAuth
□ Content-Security-Policy configurado
□ Dependências: OWASP Dependency-Check
\`\`\``;
  }

  if (fw === 'Laravel') {
    return `
## Checklist Segurança — Laravel

\`\`\`
□ CSRF token em todos os forms (@csrf)
□ Eloquent parametrizado (nunca DB::raw sem bind)
□ Form Requests para validação
□ Sanctum/Passport para API auth
□ Gate/Policy para autorização
□ Encryption via Crypt facade
□ Rate limiting via RateLimiter
□ APP_DEBUG=false em produção
□ CORS via config/cors.php com whitelist
□ Composer audit sem vulnerabilidades
\`\`\``;
  }

  // Fallback by language
  if (lang === 'Python') {
    return `
## Checklist Segurança — Python

\`\`\`
□ Inputs validados (pydantic / marshmallow / WTForms)
□ Queries parametrizadas (SQLAlchemy / Django ORM)
□ CORS configurado com whitelist
□ Rate limiting implementado
□ Security headers configurados
□ Senhas hasheadas com bcrypt/argon2
□ Sem pickle para dados untrusted
□ HTTPS obrigatório em produção
□ pip-audit / safety para vulnerabilidades
□ Logging sem dados sensíveis
\`\`\``;
  }

  if (lang === 'Go') {
    return `
## Checklist Segurança — Go

\`\`\`
□ Inputs validados via validator package
□ Prepared statements para SQL
□ TLS/mTLS para comunicação inter-serviços
□ CORS headers explícitos
□ Rate limiting implementado
□ Logging de ações críticas (sem PII)
□ go vet / staticcheck no CI
□ govulncheck para vulnerabilidades
\`\`\``;
  }

  return `
## Checklist Segurança — ${lang}

\`\`\`
□ Inputs sanitizados e validados
□ Queries parametrizadas obrigatoriamente
□ CSRF tokens em formulários
□ Rate limiting em APIs
□ Secrets em variáveis de ambiente
□ HTTPS obrigatório em produção
□ Dependency scanning no CI
\`\`\``;
}


import { TemplateContext } from '../../types.js';

/**
 * Generates 02-security.md — OWASP rules, input validation, secrets management,
 * auth/authz patterns, and security anti-patterns.
 */
export function generateSecurityRules(ctx: TemplateContext): string {
  const { stack, projectName, report, config } = ctx;
  const validationPatterns = buildValidationPatterns(ctx);
  const authPatterns = buildAuthPatterns(ctx);
  const secretsRules = buildSecretsRules(ctx);

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras de segurança para ${projectName}'
  priority: CRITICAL
---

# 🛡️ Regras de Segurança — ${projectName}

> **Segurança NÃO é feature — é requisito. Toda linha de código é superfície de ataque.**

---

## ⚠️ REGRA ZERO DE SEGURANÇA

\`\`\`
╔══════════════════════════════════════════════════════════════╗
║  NUNCA confiar em input do usuário.                         ║
║  NUNCA expor detalhes internos em respostas de erro.        ║
║  NUNCA armazenar secrets em código.                         ║
║  NUNCA desabilitar validação "temporariamente".             ║
║  NUNCA commitar com security warnings ignorados.            ║
╚══════════════════════════════════════════════════════════════╝
\`\`\`

---

## 🔐 OWASP Top 10 — Checklist Obrigatório

### A01: Broken Access Control
\`\`\`
❌ PROIBIDO: Endpoint sem verificação de autorização
❌ PROIBIDO: IDOR (Insecure Direct Object Reference) — acessar recurso de outro usuário via ID
✅ CORRETO: RBAC (Role-Based Access Control) em TODOS os endpoints
✅ CORRETO: Verificar ownership do recurso antes de retornar

Padrão:
1. Autenticar (quem é?)
2. Autorizar (pode fazer isso?)
3. Verificar ownership (esse recurso é dele?)
4. Executar ação
\`\`\`

### A02: Cryptographic Failures
\`\`\`
❌ PROIBIDO: Senhas em plain text
❌ PROIBIDO: HTTP para dados sensíveis
❌ PROIBIDO: Algoritmos fracos (MD5, SHA1 para passwords)
✅ CORRETO: bcrypt/argon2 para passwords (cost ≥ 12)
✅ CORRETO: HTTPS everywhere (HSTS)
✅ CORRETO: AES-256-GCM para dados em repouso
✅ CORRETO: TLS 1.2+ para dados em trânsito
\`\`\`

### A03: Injection
\`\`\`
❌ PROIBIDO: Concatenação de strings em queries SQL
❌ PROIBIDO: Template strings com input de usuário
❌ PROIBIDO: eval(), exec(), Function() com input externo
✅ CORRETO: Queries parametrizadas SEMPRE
✅ CORRETO: ORM com bindings
✅ CORRETO: Input sanitization na borda (controller/pipe)

Exemplos:
  ❌ \`SELECT * FROM users WHERE id = '\${userId}'\`
  ✅ \`SELECT * FROM users WHERE id = $1\` + [userId]
  ❌ \`db.query(\`...WHERE name = '\${name}'\`)\`
  ✅ \`db.query('...WHERE name = ?', [name])\`
\`\`\`

### A04: Insecure Design
\`\`\`
❌ PROIBIDO: Endpoints sem rate limiting
❌ PROIBIDO: Reset de senha via link sem expiração
❌ PROIBIDO: Lógica de negócio sem threat model
✅ CORRETO: STRIDE analysis antes de implementar features sensíveis
✅ CORRETO: Rate limiting em auth endpoints (≤ 5 tentativas/minuto)
✅ CORRETO: Tokens com expiração curta (15min access, 7d refresh)
\`\`\`

### A05: Security Misconfiguration
\`\`\`
❌ PROIBIDO: CORS com origin: '*' em produção
❌ PROIBIDO: Debug mode em produção
❌ PROIBIDO: Default credentials
❌ PROIBIDO: Stack traces em respostas de erro
✅ CORRETO: CORS restritivo (origins explícitos)
✅ CORRETO: Headers de segurança (X-Frame-Options, CSP, X-Content-Type-Options)
✅ CORRETO: Error handling que retorna apenas mensagem genérica ao usuário

Headers obrigatórios:
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 0 (CSP substitui)
  Content-Security-Policy: default-src 'self'
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Referrer-Policy: strict-origin-when-cross-origin
\`\`\`

### A06: Vulnerable and Outdated Components
\`\`\`
❌ PROIBIDO: Dependências com vulnerabilidades conhecidas
❌ PROIBIDO: Ignorar security advisories
✅ CORRETO: Audit regular (npm audit / pip audit / safety check)
✅ CORRETO: Renovate/Dependabot configurado
✅ CORRETO: Lock files commitados (package-lock.json, poetry.lock)

Comandos de verificação:
${stack.primary === 'Python'
    ? '  $ pip audit\n  $ safety check\n  $ bandit -r src/'
    : stack.primary === 'Dart'
    ? '  $ flutter pub outdated\n  $ dart analyze --fatal-warnings'
    : '  $ npm audit\n  $ npx audit-ci --critical\n  $ npx snyk test'}
\`\`\`

### A07: Identification and Authentication Failures
\`\`\`
❌ PROIBIDO: Sessions sem expiração
❌ PROIBIDO: Tokens previsíveis
❌ PROIBIDO: Brute force sem proteção
✅ CORRETO: JWT com algoritmo explícito (RS256 ou ES256)
✅ CORRETO: Refresh token rotation
✅ CORRETO: Account lockout após N tentativas
✅ CORRETO: MFA para operações sensíveis

JWT Checklist:
  □ Algoritmo explícito (nunca 'none')
  □ Audience (aud) verificado
  □ Issuer (iss) verificado
  □ Expiração (exp) curta
  □ Secret key ≥ 256 bits
  □ Stored em httpOnly cookie (não localStorage)
\`\`\`

### A08: Software and Data Integrity Failures
\`\`\`
❌ PROIBIDO: CI/CD sem verificação de integridade
❌ PROIBIDO: Deserialização de dados não confiáveis
✅ CORRETO: Subresource Integrity (SRI) para CDN scripts
✅ CORRETO: Signed commits
✅ CORRETO: Pipeline protegido (branch protection rules)
\`\`\`

### A09: Security Logging and Monitoring Failures
\`\`\`
❌ PROIBIDO: Ações sensíveis sem log
❌ PROIBIDO: Logs com dados sensíveis (passwords, tokens, PII)
✅ CORRETO: Audit log para: login, logout, password change, permission change
✅ CORRETO: Log level adequado (WARN/ERROR para falhas de auth)
✅ CORRETO: Alertas para atividades anômalas

O que logar:
  ✅ Quem (user ID)
  ✅ O quê (ação)
  ✅ Quando (timestamp UTC)
  ✅ Onde (IP, user-agent)
  ✅ Resultado (sucesso/falha)

O que NUNCA logar:
  ❌ Passwords (nem em debug)
  ❌ Tokens de autenticação
  ❌ Dados de cartão de crédito
  ❌ PII sem necessidade
\`\`\`

### A10: Server-Side Request Forgery (SSRF)
\`\`\`
❌ PROIBIDO: Fetch de URL fornecida pelo usuário sem validação
❌ PROIBIDO: Acesso a metadata endpoints (169.254.169.254)
✅ CORRETO: Allowlist de domínios para requests externos
✅ CORRETO: Validação de schema (https only)
✅ CORRETO: Block de IPs internos/privados
\`\`\`

---

## 🔑 Validação de Input

${validationPatterns}

---

## 🔒 Autenticação & Autorização

${authPatterns}

---

## 🗝️ Gestão de Secrets

${secretsRules}

---

## 🚨 Security Anti-Patterns Detectados

${report.antiPatterns.filter(a =>
    a.name.toLowerCase().includes('security') ||
    a.name.toLowerCase().includes('secret') ||
    a.name.toLowerCase().includes('hardcoded') ||
    a.name.toLowerCase().includes('injection') ||
    a.name.toLowerCase().includes('validation')
  ).length > 0
    ? report.antiPatterns
        .filter(a =>
          a.name.toLowerCase().includes('security') ||
          a.name.toLowerCase().includes('secret') ||
          a.name.toLowerCase().includes('hardcoded') ||
          a.name.toLowerCase().includes('injection') ||
          a.name.toLowerCase().includes('validation')
        )
        .map(a => `- **${a.name}** (${a.severity}) em \`${a.location}\` — ${a.suggestion}`)
        .join('\\n')
    : '✅ Nenhum anti-pattern de segurança detectado no scan automático.\\n> ⚠️ Isso NÃO significa que o projeto está seguro. Análise manual é necessária.'}

---

## ✅ Checklist de Segurança por Camada

### Controller / API Layer
\`\`\`
□ Input validado com DTO/Schema
□ Rate limiting configurado
□ Auth guard aplicado
□ CORS configurado corretamente
□ Response não expõe dados internos
□ Error handling sem stack trace
\`\`\`

### Service / Business Layer
\`\`\`
□ Autorização verificada (ownership)
□ Dados sensíveis criptografados
□ Lógica de negócio com audit log
□ Sem eval/exec com input externo
□ Timeout em operações externas
\`\`\`

### Data / Repository Layer
\`\`\`
□ Queries parametrizadas (NUNCA concatenação)
□ Connection pooling com limits
□ Migrations reversíveis
□ Dados sensíveis com encryption at rest
□ Backup policy definida
\`\`\`

### Frontend / Mobile Layer
\`\`\`
□ XSS prevenido (sanitization)
□ CSRF token em formulários
□ Tokens em httpOnly cookies (não localStorage)
□ Content Security Policy
□ Sem secrets no bundle (NUNCA)
□ Validação client-side + server-side
\`\`\`

---

## 🛡️ Threat Model (STRIDE)

Antes de implementar features sensíveis, usar template STRIDE:

\`\`\`
| Ameaça              | Descrição                          | Mitigação |
|---------------------|------------------------------------|-----------|
| Spoofing            | Alguém se passando por outro       | Auth forte, MFA |
| Tampering           | Dados alterados em trânsito        | TLS, HMAC, checksums |
| Repudiation         | Negar ação realizada               | Audit logs |
| Info Disclosure     | Vazamento de dados                 | Encryption, access control |
| Denial of Service   | Indisponibilidade                  | Rate limiting, CDN, autoscaling |
| Elevation of Priv.  | Escalar permissões                 | Least privilege, RBAC |
\`\`\`

> Template completo disponível em: \`templates/THREAT-MODEL.md\`

---

## 📊 Verificação Automatizada

\`\`\`bash
# Scan de vulnerabilidades em dependências
${stack.primary === 'Python'
    ? 'pip audit\nsafety check\nbandit -r src/'
    : stack.primary === 'Dart'
    ? 'dart analyze --fatal-warnings'
    : 'npm audit\nnpx audit-ci --critical'}

# Scan de secrets no código
# (configure pre-commit hook)
git secrets --scan
gitleaks detect

# Score de arquitetura (inclui métricas de segurança)
architect score ./src
architect anti-patterns ./src
\`\`\`

---

**Gerado por Architect v3.1 · Score: ${report.score.overall}/100**
`;
}

function buildValidationPatterns(ctx: TemplateContext): string {
  const { stack } = ctx;

  if (stack.frameworks.includes('NestJS')) {
    return `### NestJS — class-validator + class-transformer

\`\`\`typescript
// ✅ CORRETO: DTO com validação
import { IsString, IsEmail, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

// Controller com ValidationPipe
@Post()
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
async create(@Body() dto: CreateUserDto) { ... }
\`\`\`

**Regras:**
- \`whitelist: true\` — remove campos não declarados no DTO
- \`forbidNonWhitelisted: true\` — retorna 400 se campo extra enviado
- \`transform: true\` — converte tipos automaticamente
- NUNCA usar \`@Body()\` sem DTO validado`;
  }

  if (stack.primary === 'Python') {
    return `### Python — Pydantic / marshmallow

\`\`\`python
# ✅ CORRETO: Schema com validação
from pydantic import BaseModel, EmailStr, Field, validator

class CreateUserSchema(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @validator('name')
    def name_must_be_alphanumeric(cls, v):
        if not v.replace(' ', '').isalnum():
            raise ValueError('Name must be alphanumeric')
        return v.strip()
\`\`\`

**Regras:**
- Pydantic \`BaseModel\` ou marshmallow \`Schema\` para TODOS os inputs
- \`Field()\` com min/max constraints
- Custom validators para regras de negócio
- NUNCA usar \`request.json\` diretamente sem validação`;
  }

  // Generic
  return `### Validação de Input — Padrão Geral

\`\`\`
Regras de validação:
1. TODOS os inputs passam por schema validation
2. Tipos verificados (string, number, email, etc.)
3. Limites definidos (min/max length, ranges)
4. Whitelist de campos aceitos
5. Sanitização de caracteres especiais
6. Encoding correto (UTF-8)

Pipeline:
  Request → Schema Validation → Sanitization → Business Logic

NUNCA:
  ❌ request.body direto na lógica
  ❌ Confiar em validação client-side apenas
  ❌ Aceitar campos não declarados
\`\`\``;
}

function buildAuthPatterns(ctx: TemplateContext): string {
  const { stack } = ctx;

  if (stack.frameworks.includes('NestJS')) {
    return `### NestJS Auth Pattern

\`\`\`
Implementação padrão:
1. AuthGuard global para rotas protegidas
2. @Public() decorator para rotas abertas
3. RolesGuard para autorização
4. CurrentUser decorator para extrair user do token

Hierarquia:
  @Public()           → Sem autenticação
  @UseGuards(AuthGuard) → Autenticado
  @Roles('admin')     → Autenticado + Role específica
  @OwnerGuard()       → Autenticado + Dono do recurso

Fluxo de token:
  Login → Access Token (15min) + Refresh Token (7d, httpOnly cookie)
  Request → AuthGuard verifica Access Token
  Expired → Refresh endpoint gera novo par
  Logout → Invalidar Refresh Token no banco
\`\`\``;
  }

  // Generic
  return `### Padrão de Autenticação/Autorização

\`\`\`
Fluxo obrigatório:
1. Autenticar: Verificar identidade (JWT/session)
2. Autorizar: Verificar permissões (roles/policies)
3. Ownership: Verificar se recurso pertence ao usuário
4. Executar: Somente após passos 1-3

Token management:
  - Access Token: curta duração (15min)
  - Refresh Token: longa duração (7d), httpOnly, secure
  - Rotation: novo refresh token a cada uso
  - Blacklist: invalidar tokens no logout

RBAC mínimo:
  - admin: tudo
  - user: próprios recursos
  - public: endpoints marcados explicitamente
\`\`\``;
}

function buildSecretsRules(ctx: TemplateContext): string {
  const { stack } = ctx;

  return `### Regras de Secrets

\`\`\`
╔══════════════════════════════════════════════════════════════╗
║  SECRETS NUNCA NO CÓDIGO. NUNCA. SEM EXCEÇÃO.               ║
╚══════════════════════════════════════════════════════════════╝

❌ PROIBIDO:
  - API keys hardcoded
  - Passwords em arquivos de config
  - Tokens em constantes
  - Connection strings com credenciais no código
  - .env commitado no repositório

✅ CORRETO:
  - Environment variables
  - Secret manager (AWS SSM, Vault, GCP Secret Manager)
  - .env.example com placeholders (sem valores reais)
  - .gitignore com: .env, .env.local, .env.*.local
\`\`\`

### .gitignore obrigatório

\`\`\`
# Secrets — NUNCA commitar
.env
.env.local
.env.*.local
*.pem
*.key
*.p12
credentials.json
service-account.json
\`\`\`

### Detecção de secrets no CI

\`\`\`bash
# Pre-commit hook (recomendado)
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

# Ou manualmente:
gitleaks detect --source . --verbose
git secrets --scan
\`\`\`

### Padrão de configuração

\`\`\`${stack.primary === 'Python' ? 'python' : 'typescript'}
${stack.primary === 'Python'
    ? `# ✅ CORRETO
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    redis_url: str = "redis://localhost:6379"

    class Config:
        env_file = ".env"

settings = Settings()  # Carrega de environment variables`
    : `// ✅ CORRETO
const config = {
  database: {
    url: process.env.DATABASE_URL,     // De environment variable
    ssl: process.env.DB_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET,     // NUNCA hardcoded
    expiresIn: '15m',
  },
};

// Validação no startup — falha rápido se falta secret
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(\\\`Missing env: \\\${key}\\\`);
}`}
\`\`\``;
}

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { DomainInsights, BusinessEntity, ComplianceRequirement, ExternalIntegration } from './types/domain.js';

/**
 * DomainInferrer — Analyzes project metadata, file names, module structure,
 * README content, and keywords to infer the business domain and context.
 *
 * This enables context-aware agent generation that understands WHAT the
 * project does, not just HOW it's built.
 */
export class DomainInferrer {
  // Domain keyword mappings - patterns that indicate specific domains
  private static readonly DOMAIN_PATTERNS: Record<string, { keywords: string[]; subDomains: Record<string, string[]> }> = {
    fintech: {
      keywords: ['payment', 'transaction', 'invoice', 'billing', 'ledger', 'account', 'transfer', 'wallet', 'bank', 'loan', 'credit', 'debit', 'finance', 'fiscal', 'tax', 'irpf', 'imposto', 'receita', 'declaracao', 'contribuinte', 'pix', 'boleto', 'nfe', 'nota-fiscal'],
      subDomains: {
        'tax-processing': ['irpf', 'tax', 'imposto', 'fiscal', 'receita', 'declaracao', 'contribuinte', 'deducao', 'rendimento'],
        'payment-gateway': ['payment', 'pix', 'boleto', 'stripe', 'checkout', 'charge'],
        'banking': ['bank', 'account', 'transfer', 'balance', 'statement', 'ledger'],
        'invoicing': ['invoice', 'billing', 'nfe', 'nota-fiscal', 'fatura'],
        'lending': ['loan', 'credit', 'installment', 'interest', 'amortization'],
      },
    },
    healthtech: {
      keywords: ['patient', 'medical', 'health', 'diagnosis', 'prescription', 'clinical', 'hospital', 'doctor', 'appointment', 'ehr', 'fhir', 'dicom', 'sus', 'prontuario', 'consulta', 'exame'],
      subDomains: {
        'ehr': ['patient', 'record', 'prontuario', 'clinical', 'ehr'],
        'telemedicine': ['appointment', 'consulta', 'video', 'teleconsulta'],
        'diagnostics': ['diagnosis', 'exame', 'lab', 'result'],
      },
    },
    'e-commerce': {
      keywords: ['product', 'cart', 'order', 'catalog', 'shipping', 'checkout', 'inventory', 'price', 'discount', 'coupon', 'store', 'shop', 'marketplace', 'seller', 'buyer', 'carrinho', 'pedido', 'estoque', 'frete'],
      subDomains: {
        'marketplace': ['seller', 'buyer', 'marketplace', 'commission'],
        'retail': ['product', 'catalog', 'inventory', 'store', 'shop'],
        'logistics': ['shipping', 'delivery', 'frete', 'tracking', 'warehouse'],
      },
    },
    edtech: {
      keywords: ['student', 'course', 'lesson', 'quiz', 'grade', 'enrollment', 'teacher', 'classroom', 'curriculum', 'lms', 'aluno', 'aula', 'nota', 'matricula', 'professor'],
      subDomains: {
        'lms': ['course', 'lesson', 'enrollment', 'lms', 'aula'],
        'assessment': ['quiz', 'grade', 'exam', 'prova', 'nota'],
      },
    },
    devtools: {
      keywords: ['analyzer', 'analysis', 'architect', 'lint', 'linter', 'ast', 'parser', 'scanner', 'refactor', 'mcp', 'cli', 'plugin', 'extension', 'sdk', 'compiler', 'transpiler', 'bundler', 'formatter', 'debugger', 'profiler', 'intelligence', 'code-review', 'anti-pattern', 'score', 'metric', 'dependency-graph'],
      subDomains: {
        'code-intelligence': ['analyzer', 'analysis', 'architect', 'anti-pattern', 'score', 'metric', 'intelligence', 'refactor'],
        'mcp-server': ['mcp', 'perception', 'reasoning', 'validation', 'tool-calling'],
        'cli-tool': ['cli', 'command', 'terminal', 'argv', 'yargs', 'commander'],
        'ide-extension': ['extension', 'plugin', 'language-server', 'lsp', 'vscode'],
        'build-tool': ['bundler', 'compiler', 'transpiler', 'webpack', 'esbuild', 'vite'],
      },
    },
    saas: {
      keywords: ['tenant', 'subscription', 'plan', 'workspace', 'organization', 'team', 'member', 'role', 'permission', 'billing', 'api-key', 'webhook', 'dashboard'],
      subDomains: {
        'multi-tenant': ['tenant', 'workspace', 'organization'],
        'subscription': ['subscription', 'plan', 'billing', 'trial'],
      },
    },
    iot: {
      keywords: ['device', 'sensor', 'telemetry', 'mqtt', 'gateway', 'firmware', 'signal', 'measurement', 'monitoring', 'alert', 'threshold'],
      subDomains: {
        'monitoring': ['sensor', 'telemetry', 'monitoring', 'measurement'],
        'device-management': ['device', 'firmware', 'gateway', 'provision'],
      },
    },
    'content-management': {
      keywords: ['article', 'post', 'blog', 'page', 'cms', 'content', 'media', 'publish', 'author', 'category', 'tag', 'comment'],
      subDomains: {
        'cms': ['article', 'post', 'publish', 'cms', 'content'],
        'media': ['media', 'image', 'video', 'upload', 'gallery'],
      },
    },
    'real-estate': {
      keywords: ['property', 'listing', 'tenant', 'landlord', 'rent', 'lease', 'imovel', 'aluguel', 'inquilino', 'condominio'],
      subDomains: {
        'property-management': ['property', 'tenant', 'rent', 'lease', 'condominio'],
        'listings': ['listing', 'search', 'filter', 'imovel'],
      },
    },
    logistics: {
      keywords: ['shipment', 'route', 'delivery', 'warehouse', 'fleet', 'driver', 'tracking', 'dispatch', 'load', 'cargo', 'entrega', 'rastreamento', 'frota', 'motorista'],
      subDomains: {
        'fleet-management': ['fleet', 'driver', 'vehicle', 'frota', 'motorista'],
        'delivery': ['delivery', 'shipment', 'tracking', 'entrega', 'rastreamento'],
        'warehouse': ['warehouse', 'inventory', 'stock', 'storage'],
      },
    },
    'hr-management': {
      keywords: ['employee', 'payroll', 'leave', 'attendance', 'hiring', 'candidate', 'department', 'salary', 'benefit', 'funcionario', 'folha', 'ferias', 'ponto', 'contratacao'],
      subDomains: {
        'payroll': ['payroll', 'salary', 'folha', 'benefit', 'compensation'],
        'recruitment': ['hiring', 'candidate', 'interview', 'contratacao'],
        'time-tracking': ['attendance', 'leave', 'ponto', 'ferias'],
      },
    },
  };

  // Compliance mappings based on domain and geography
  private static readonly COMPLIANCE_MAP: Record<string, ComplianceRequirement[]> = {
    fintech: [
      {
        name: 'PCI-DSS',
        reason: 'Handles financial/payment data',
        mandatoryChecks: [
          'Credit card data never stored in plaintext',
          'Payment tokens used instead of raw card numbers',
          'Audit trail for all financial transactions',
          'Encryption at rest for financial data',
          'Access controls with principle of least privilege',
        ],
      },
    ],
    'tax-processing': [
      {
        name: 'LGPD',
        reason: 'Processes Brazilian taxpayer personal data (CPF, income, assets)',
        mandatoryChecks: [
          'CPF/CNPJ data encrypted at rest and in transit',
          'Consent management for data processing',
          'Right to deletion (direito ao esquecimento)',
          'Data minimization — only collect necessary fields',
          'Data breach notification procedures',
          'DPO (Data Protection Officer) contact documented',
          'Cross-border data transfer restrictions',
        ],
      },
      {
        name: 'RFB-Compliance',
        reason: 'Integrates with Receita Federal do Brasil systems',
        mandatoryChecks: [
          'Digital certificate (e-CPF/e-CNPJ) handling',
          'XML schema validation against RFB specifications',
          'Audit log for all tax calculation modifications',
          'Retention period compliance (5 years minimum)',
          'Hash validation for submitted declarations',
        ],
      },
    ],
    healthtech: [
      {
        name: 'HIPAA',
        reason: 'Handles protected health information (PHI)',
        mandatoryChecks: [
          'PHI encryption at rest and in transit',
          'Access audit logging for all PHI access',
          'Minimum necessary access principle',
          'Business Associate Agreements (BAA) tracking',
          'Breach notification within 60 days',
        ],
      },
      {
        name: 'LGPD-Health',
        reason: 'Processes sensitive health data under Brazilian law',
        mandatoryChecks: [
          'Explicit consent for health data processing',
          'Data anonymization where possible',
          'Restricted access to health records',
          'CFM/CRM compliance for medical data',
        ],
      },
    ],
    'e-commerce': [
      {
        name: 'CDC',
        reason: 'Consumer Defense Code (Código de Defesa do Consumidor)',
        mandatoryChecks: [
          'Clear pricing display (no hidden fees)',
          'Right of withdrawal (7 days for online purchases)',
          'Order tracking transparency',
          'Invoice generation for all transactions',
        ],
      },
    ],
    'hr-management': [
      {
        name: 'LGPD-Employment',
        reason: 'Processes employee personal and financial data',
        mandatoryChecks: [
          'Employee data encrypted at rest',
          'Salary data access restricted to HR and payroll',
          'Data retention aligned with labor law (5 years after termination)',
          'Consent for data processing beyond employment',
        ],
      },
    ],
  };

  /**
   * Infer domain insights from the analysis report.
   */
  infer(report: AnalysisReport, projectPath: string): DomainInsights {
    const allKeywords = this.extractAllKeywords(report);

    // Boost keywords from project files (pyproject.toml, README, package.json)
    const fileKeywords = this.extractKeywordsFromProjectFiles(projectPath);
    for (const kw of fileKeywords) {
      if (!allKeywords.includes(kw)) allKeywords.push(kw);
    }

    const { domain, subDomain, confidence } = this.classifyDomain(allKeywords);
    const businessEntities = this.extractBusinessEntities(report);
    const compliance = this.inferCompliance(domain, subDomain, allKeywords);
    const integrations = this.detectIntegrations(report, allKeywords);
    const description = this.buildDescription(report, domain, subDomain);

    return {
      domain,
      subDomain,
      description,
      businessEntities,
      compliance,
      integrations,
      keywords: allKeywords,
      confidence,
    };
  }

  /**
   * Extract all relevant keywords from the project.
   */
  private extractAllKeywords(report: AnalysisReport): string[] {
    const keywords = new Set<string>();

    // From ProjectSummary keywords
    if (report.projectSummary?.keywords) {
      for (const kw of report.projectSummary.keywords) {
        keywords.add(kw.toLowerCase());
      }
    }

    // From module names
    if (report.projectSummary?.modules) {
      for (const mod of report.projectSummary.modules) {
        keywords.add(mod.name.toLowerCase());
        // Split camelCase/snake_case module names
        for (const part of this.splitIdentifier(mod.name)) {
          keywords.add(part.toLowerCase());
        }
      }
    }

    // From file paths — extract meaningful segments
    for (const node of report.dependencyGraph.nodes) {
      const segments = node.split('/').filter(s =>
        !['src', 'lib', 'app', 'core', 'common', 'shared', 'utils', 'helpers',
          'index', 'main', '__init__', 'test', 'tests', 'spec', '__tests__',
          'node_modules', 'dist', 'build', '.git'].includes(s.toLowerCase())
      );
      for (const seg of segments) {
        const name = seg.replace(/\.[^.]+$/, ''); // remove extension
        for (const part of this.splitIdentifier(name)) {
          if (part.length > 2) {
            keywords.add(part.toLowerCase());
          }
        }
      }
    }

    // From project name
    if (report.projectInfo.name) {
      for (const part of this.splitIdentifier(report.projectInfo.name)) {
        keywords.add(part.toLowerCase());
      }
    }

    // From description/purpose
    if (report.projectSummary?.description) {
      const words = report.projectSummary.description.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (w.length > 3) keywords.add(w.replace(/[^a-z0-9]/g, ''));
      }
    }

    return [...keywords].filter(k => k.length > 0);
  }

  /**
   * Classify project domain based on keyword matching.
   */
  private classifyDomain(keywords: string[]): { domain: string; subDomain: string; confidence: number } {
    let bestDomain = 'general';
    let bestSubDomain = 'general';
    let bestScore = 0;
    let bestMaxPossible = 1;

    for (const [domain, config] of Object.entries(DomainInferrer.DOMAIN_PATTERNS)) {
      const matchedKeywords = config.keywords.filter(kw =>
        keywords.some(k => k.includes(kw) || kw.includes(k))
      );
      const score = matchedKeywords.length;

      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
        bestMaxPossible = config.keywords.length;

        // Find best sub-domain
        let bestSubScore = 0;
        for (const [subDomain, subKeywords] of Object.entries(config.subDomains)) {
          const subMatched = subKeywords.filter(kw =>
            keywords.some(k => k.includes(kw) || kw.includes(k))
          ).length;
          if (subMatched > bestSubScore) {
            bestSubScore = subMatched;
            bestSubDomain = subDomain;
          }
        }
      }
    }

    // Confidence formula:
    // - Base: matched keywords / min(total possible, 8) (lower denominator = easier to reach high confidence)
    // - Boost: +0.1 if sub-domain also matched (cross-validation)
    // - Boost: +0.1 if multiple entities or integrations hint at the same domain
    // - Cap at 0.95 (never 100% without manual confirmation)
    let confidence = bestScore > 0 ? Math.min(1, bestScore / Math.min(bestMaxPossible, 8)) : 0;

    // Sub-domain match boost
    if (bestSubDomain !== 'general' && bestSubDomain !== bestDomain) {
      confidence = Math.min(1, confidence + 0.1);
    }

    // Second-best domain gap boost (high gap = more certain)
    let secondBestScore = 0;
    for (const [domain, config] of Object.entries(DomainInferrer.DOMAIN_PATTERNS)) {
      if (domain === bestDomain) continue;
      const matchedKeywords = config.keywords.filter(kw =>
        keywords.some(k => k.includes(kw) || kw.includes(k))
      );
      if (matchedKeywords.length > secondBestScore) {
        secondBestScore = matchedKeywords.length;
      }
    }
    if (bestScore > 0 && bestScore >= secondBestScore * 2) {
      confidence = Math.min(1, confidence + 0.1);
    }

    // Cap at 0.95
    confidence = Math.min(0.95, confidence);

    return { domain: bestDomain, subDomain: bestSubDomain, confidence };
  }

  /**
   * Extract business entities from model/entity/schema file names.
   */
  private extractBusinessEntities(report: AnalysisReport): BusinessEntity[] {
    const entities: BusinessEntity[] = [];
    const entityPatterns = [
      /(?:models?|entities|entity|schemas?)\/([^/]+)\./i,
      /([^/]+)\.(model|entity|schema)\./i,
      /([^/]+)\.models?\./i,
    ];

    for (const filePath of report.dependencyGraph.nodes) {
      for (const pattern of entityPatterns) {
        const match = filePath.match(pattern);
        if (match) {
          const name = match[1].replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
          if (name && name !== 'Index' && name !== 'Base' && name !== 'Init') {
            const layer = this.inferEntityLayer(filePath);
            entities.push({
              name,
              source: filePath,
              fields: [], // Would need AST parsing for fields
              relationships: [],
              layer,
            });
          }
        }
      }
    }

    // Deduplicate by name
    const seen = new Set<string>();
    return entities.filter(e => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private inferEntityLayer(filePath: string): BusinessEntity['layer'] {
    const lower = filePath.toLowerCase();
    if (lower.includes('/model')) return 'model';
    if (lower.includes('/entity') || lower.includes('/entities')) return 'entity';
    if (lower.includes('/schema')) return 'schema';
    if (lower.includes('/dto')) return 'dto';
    return 'unknown';
  }

  /**
   * Infer compliance requirements from domain and keywords.
   */
  private inferCompliance(domain: string, subDomain: string, keywords: string[]): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];

    // Domain-level compliance
    const domainCompliance = DomainInferrer.COMPLIANCE_MAP[domain];
    if (domainCompliance) {
      requirements.push(...domainCompliance);
    }

    // Sub-domain specific compliance
    const subCompliance = DomainInferrer.COMPLIANCE_MAP[subDomain];
    if (subCompliance) {
      requirements.push(...subCompliance);
    }

    // Generic LGPD if Brazilian indicators found
    const brIndicators = ['cpf', 'cnpj', 'cep', 'lgpd', 'brasil', 'brazil', 'pt-br', 'ptbr', 'receita'];
    const hasBrazilianContext = keywords.some(k => brIndicators.some(br => k.includes(br)));
    if (hasBrazilianContext && !requirements.some(r => r.name.includes('LGPD'))) {
      requirements.push({
        name: 'LGPD',
        reason: 'Brazilian context detected — personal data processing requires LGPD compliance',
        mandatoryChecks: [
          'Personal data encrypted at rest and in transit',
          'Consent management for data processing',
          'Right to deletion implementation',
          'Data breach notification procedures',
        ],
      });
    }

    // PII detection regardless of domain
    const piiIndicators = ['email', 'password', 'phone', 'address', 'ssn', 'cpf', 'passport', 'birth'];
    const hasPII = keywords.some(k => piiIndicators.some(p => k.includes(p)));
    if (hasPII && !requirements.some(r => r.name === 'LGPD' || r.name === 'GDPR')) {
      requirements.push({
        name: 'PII-Protection',
        reason: 'Personal Identifiable Information (PII) detected in project entities',
        mandatoryChecks: [
          'PII fields encrypted at rest',
          'Access logging for PII data',
          'Data masking in logs and error messages',
          'Secure deletion procedures',
        ],
      });
    }

    return requirements;
  }

  /**
   * Detect external integrations from file names, imports, and keywords.
   */
  private detectIntegrations(report: AnalysisReport, keywords: string[]): ExternalIntegration[] {
    const integrations: ExternalIntegration[] = [];
    const allFiles = report.dependencyGraph.nodes.join(' ').toLowerCase();

    const integrationPatterns: { name: string; type: ExternalIntegration['type']; signals: string[] }[] = [
      // Payment
      { name: 'Stripe', type: 'payment', signals: ['stripe'] },
      { name: 'PagSeguro', type: 'payment', signals: ['pagseguro'] },
      { name: 'Mercado Pago', type: 'payment', signals: ['mercadopago', 'mercado-pago'] },
      { name: 'PIX', type: 'payment', signals: ['pix'] },
      // Auth
      { name: 'OAuth2/OIDC', type: 'auth', signals: ['oauth', 'oidc', 'openid'] },
      { name: 'JWT', type: 'auth', signals: ['jwt', 'jsonwebtoken'] },
      { name: 'Keycloak', type: 'auth', signals: ['keycloak'] },
      { name: 'Auth0', type: 'auth', signals: ['auth0'] },
      // Database
      { name: 'PostgreSQL', type: 'database', signals: ['postgres', 'postgresql', 'pg'] },
      { name: 'MongoDB', type: 'database', signals: ['mongo', 'mongodb', 'mongoose'] },
      { name: 'Redis', type: 'database', signals: ['redis', 'ioredis'] },
      { name: 'MySQL', type: 'database', signals: ['mysql', 'mysql2'] },
      { name: 'SQLite', type: 'database', signals: ['sqlite'] },
      // Queue/Messaging
      { name: 'RabbitMQ', type: 'queue', signals: ['rabbitmq', 'amqp'] },
      { name: 'Kafka', type: 'queue', signals: ['kafka'] },
      { name: 'AWS SQS', type: 'queue', signals: ['sqs'] },
      { name: 'BullMQ', type: 'queue', signals: ['bull', 'bullmq'] },
      // Storage
      { name: 'AWS S3', type: 'storage', signals: ['s3', 'aws-sdk'] },
      { name: 'MinIO', type: 'storage', signals: ['minio'] },
      // Government APIs
      { name: 'Receita Federal', type: 'government', signals: ['receita', 'rfb', 'ecac', 'sefaz'] },
      { name: 'SERPRO', type: 'government', signals: ['serpro'] },
      { name: 'eSocial', type: 'government', signals: ['esocial'] },
      // Other
      { name: 'Email (SMTP)', type: 'other', signals: ['smtp', 'nodemailer', 'sendgrid', 'ses'] },
      { name: 'ElasticSearch', type: 'other', signals: ['elastic', 'elasticsearch'] },
      { name: 'Sentry', type: 'other', signals: ['sentry'] },
    ];

    for (const pattern of integrationPatterns) {
      const matched = pattern.signals.find(s =>
        allFiles.includes(s) || keywords.some(k => k.includes(s))
      );
      if (matched) {
        integrations.push({
          name: pattern.name,
          type: pattern.type,
          detectedFrom: matched,
        });
      }
    }

    return integrations;
  }

  /**
   * Build a human-readable description of the project.
   */
  private buildDescription(report: AnalysisReport, domain: string, subDomain: string): string {
    const summary = report.projectSummary;
    if (summary?.description && summary.description.length > 20) {
      return summary.description;
    }

    const name = report.projectInfo.name || 'Project';
    const langs = report.projectInfo.primaryLanguages.join('/');
    const files = report.projectInfo.totalFiles;
    const lines = report.projectInfo.totalLines.toLocaleString();

    if (domain !== 'general') {
      return `${name} — ${domain}/${subDomain} application built with ${langs}. ${files} files, ${lines} lines.`;
    }

    return `${name} — ${langs} application with ${files} files and ${lines} lines.`;
  }

  /**
   * Split camelCase, PascalCase, snake_case, kebab-case identifiers into parts.
   */
  /**
   * Extract keywords from project files on disk (pyproject.toml, README.md, package.json).
   * These provide high-value domain signals that the scanner may miss.
   */
  private extractKeywordsFromProjectFiles(projectPath: string): string[] {
    const keywords: string[] = [];

    // pyproject.toml — description, classifiers, project name
    const pyprojectPath = join(projectPath, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
      try {
        const content = readFileSync(pyprojectPath, 'utf-8');

        // Extract description
        const descMatch = content.match(/description\s*=\s*"([^"]+)"/);
        if (descMatch) {
          const words = descMatch[1].toLowerCase().split(/\s+/);
          for (const w of words) {
            if (w.length > 3) keywords.push(w.replace(/[^a-z0-9]/g, ''));
          }
        }

        // Extract classifiers (e.g., "Topic :: Office/Business :: Financial")
        const classifiers = content.match(/classifiers\s*=\s*\[([\s\S]*?)\]/);
        if (classifiers) {
          const topics = classifiers[1].match(/"Topic\s*::\s*([^"]+)"/g);
          if (topics) {
            for (const topic of topics) {
              const parts = topic.replace(/"/g, '').split('::').map(p => p.trim().toLowerCase());
              for (const p of parts) {
                if (p.length > 3 && p !== 'topic') keywords.push(p.replace(/[^a-z0-9]/g, ''));
              }
            }
          }
        }

        // Extract project name
        const nameMatch = content.match(/\[project\]\s*\n(?:[\s\S]*?)name\s*=\s*"([^"]+)"/);
        if (nameMatch) {
          for (const part of this.splitIdentifier(nameMatch[1])) {
            keywords.push(part.toLowerCase());
          }
        }
      } catch { /* ignore read errors */ }
    }

    // README.md — first 500 chars for domain keywords
    const readmePaths = ['README.md', 'readme.md', 'README.rst'];
    for (const readmeName of readmePaths) {
      const readmePath = join(projectPath, readmeName);
      if (existsSync(readmePath)) {
        try {
          const content = readFileSync(readmePath, 'utf-8').slice(0, 1500);
          // Extract heading and first paragraph
          const lines = content.split('\n').filter(l => l.trim().length > 0).slice(0, 10);
          for (const line of lines) {
            const words = line.replace(/[#*_`\[\]()]/g, '').toLowerCase().split(/\s+/);
            for (const w of words) {
              if (w.length > 3) keywords.push(w.replace(/[^a-z0-9]/g, ''));
            }
          }
        } catch { /* ignore */ }
        break;
      }
    }

    // package.json — description and keywords
    const pkgPath = join(projectPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.description) {
          const words = pkg.description.toLowerCase().split(/\s+/);
          for (const w of words) {
            if (w.length > 3) keywords.push(w.replace(/[^a-z0-9]/g, ''));
          }
        }
        if (Array.isArray(pkg.keywords)) {
          for (const kw of pkg.keywords) {
            keywords.push(kw.toLowerCase());
          }
        }
      } catch { /* ignore */ }
    }

    return keywords.filter(k => k.length > 0);
  }

  private splitIdentifier(name: string): string[] {
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_./\\]/g, ' ')
      .split(/\s+/)
      .filter(p => p.length > 0);
  }
}

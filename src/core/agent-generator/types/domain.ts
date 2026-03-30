/**
 * Detailed module information extracted from project analysis.
 */
export interface ModuleDetail {
  name: string;
  path: string;
  files: string[];
  fileCount: number;
  lineCount: number;
  description: string;
  hasTests: boolean;
  testFiles: string[];
  entities: string[];
  controllers: string[];
  services: string[];
  layer: string;
}

/**
 * API endpoint detected from route/controller files.
 */
export interface DetectedEndpoint {
  method: string;
  path: string;
  file: string;
  handler: string;
  hasAuth: boolean;
  hasValidation: boolean;
}

export interface BusinessEntity {
  name: string;
  source: string;
  fields: string[];
  relationships: string[];
  layer: 'model' | 'entity' | 'schema' | 'dto' | 'unknown';
}

export interface ComplianceRequirement {
  name: string;
  reason: string;
  mandatoryChecks: string[];
}

export interface ExternalIntegration {
  name: string;
  type: 'api' | 'database' | 'queue' | 'storage' | 'payment' | 'auth' | 'government' | 'other';
  detectedFrom: string;
}

/**
 * Domain classification inferred from project analysis.
 */
export interface DomainInsights {
  domain: string;
  subDomain: string;
  description: string;
  businessEntities: BusinessEntity[];
  compliance: ComplianceRequirement[];
  integrations: ExternalIntegration[];
  keywords: string[];
  confidence: number;
}

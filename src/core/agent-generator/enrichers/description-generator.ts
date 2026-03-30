import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AnalysisReport } from '../../types/core.js';
import { ModuleDetail, DetectedEndpoint } from '../types/domain.js';
import { EnrichedTemplateContext } from '../types/template.js';

export class DescriptionGenerator {
public generateSmartDescription(mod: ModuleDetail): string {
    const name = mod.name.toLowerCase();
    const parts: string[] = [];

    // Pattern-based descriptions
    const descriptionPatterns: Record<string, string> = {
      'extractors': 'Extração e parsing de dados de documentos',
      'ocr': 'Reconhecimento óptico de caracteres (OCR)',
      'guards': 'Validação e proteção de fluxos de dados',
      'confidence': 'Cálculo de confiança e scoring de dados extraídos',
      'routes': 'Definição de rotas e endpoints da API',
      'workers': 'Processamento assíncrono e workers de background',
      'persistence': 'Camada de persistência e acesso a dados',
      'storage': 'Gerenciamento de armazenamento de arquivos',
      'agents': 'Agentes de processamento e automação',
      'auth': 'Autenticação e gerenciamento de sessão',
      'users': 'Gerenciamento de usuários e perfis',
      'notifications': 'Sistema de notificações e alertas',
      'payments': 'Processamento de pagamentos e transações',
      'reports': 'Geração de relatórios e dashboards',
      'search': 'Motor de busca e indexação',
      'cache': 'Camada de cache e otimização de performance',
      'queue': 'Filas de mensagens e processamento assíncrono',
      'email': 'Envio e gerenciamento de e-mails',
      'upload': 'Upload e processamento de arquivos',
      'migration': 'Migrações de banco de dados',
      'seed': 'Dados iniciais e seed do banco',
      'fixtures': 'Fixtures e dados de teste',
      'middleware': 'Middleware de requisição/resposta',
      'dependencies': 'Injeção de dependências e configuração',
      'exceptions': 'Tratamento de erros e exceções customizadas',
      'enums': 'Enumerações e constantes de domínio',
      'events': 'Sistema de eventos e event handlers',
      'value_objects': 'Value Objects do domínio (imutáveis)',
      'entities': 'Entidades de domínio com identidade',
      'services': 'Serviços de domínio e lógica de negócio',
      'interfaces': 'Contratos e interfaces de abstração',
      'repositories': 'Repositórios de acesso a dados',
      'mappers': 'Mapeamento entre camadas (DTO ↔ Entity)',
      'validators': 'Validação de dados e regras de negócio',
      'serializers': 'Serialização/deserialização de dados',
      'schemas': 'Schemas de validação e contratos',
    };

    // Try exact match first
    for (const [pattern, desc] of Object.entries(descriptionPatterns)) {
      if (name === pattern || name.endsWith(`/${pattern}`)) {
        parts.push(desc);
        break;
      }
    }

    // Try partial match
    if (parts.length === 0) {
      for (const [pattern, desc] of Object.entries(descriptionPatterns)) {
        if (name.includes(pattern)) {
          parts.push(desc);
          break;
        }
      }
    }

    // Add composition info
    const composition: string[] = [];
    if (mod.controllers.length > 0) composition.push(`${mod.controllers.length} endpoint(s)`);
    if (mod.services.length > 0) composition.push(`${mod.services.length} service(s)`);
    if (mod.entities.length > 0) composition.push(`entities: ${mod.entities.join(', ')}`);

    if (composition.length > 0) {
      parts.push(composition.join(' · '));
    }

    // Fallback: file count + line count
    if (parts.length === 0) {
      parts.push(`${mod.fileCount} arquivo(s)`);
    }
    if (mod.lineCount > 0) {
      parts.push(`${mod.lineCount.toLocaleString()} linhas`);
    }

    return parts.join(' — ');
  }

}

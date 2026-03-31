/**
 * 🏢 Architect Enterprise Framework - Custom Plugin SDK Example
 * 
 * Este arquivo demonstra como construir regras arquiteturais customizadas
 * para sua empresa.
 * 
 * Para ativar este plugin, adicione ao seu .architect.json:
 * {
 *   "plugins": ["./examples/my-enterprise-rule.mjs"]
 * }
 */

export default {
  name: 'AcmeCorp Domain Rule',
  version: '1.0.0',
  
  /**
   * Função principal chamada pelo Architect na 'Fase 4: Anti-Patterns'.
   * 
   * @param {Object} fileTree - A árvore de arquivos completa do projeto analisado (FileNode).
   * @param {Map} dependencies - O Grafo bidirecional mapeando quem importa quem `Map<string, Set<string>>`.
   * @param {Object} context - Contexto contendo config e projectPath.
   * @returns {Array|Promise<Array>} Lista de AntiPatterns detectados.
   */
  detectAntiPatterns: async (fileTree, dependencies, context) => {
    const patterns = [];
    const DOMAIN_DIR = 'src/domain';
    const INFRA_DIR = 'src/infrastructure';

    // Para cada arquivo no grafo de dependências
    for (const [filePath, imports] of dependencies.entries()) {
      
      // REGRA EMPRESARIAL 1: Clean Architecture Strict Rule
      // Nenhum código de Domínio puro pode importar infraestrutura.
      if (filePath.includes(DOMAIN_DIR)) {
        for (const importedFile of imports) {
          if (importedFile.includes(INFRA_DIR)) {
            patterns.push({
              name: 'Violação AcmeCorp - Vandalismo de Domínio',
              severity: 'CRITICAL',
              location: `${filePath} -> ${importedFile}`,
              description: `A camada de domínio puro está acoplada à infraestrutura! Módulos em ${DOMAIN_DIR} não podem conhecer Detalhes Técnicos de ${INFRA_DIR}.`,
              suggestion: 'Inverta a dependência. Crie uma Interface no Domínio e implemente-a na Infraestrutura.',
            });
          }
        }
      }
      
      // REGRA EMPRESARIAL 2: API Gateway Layer
      // Controllers não podem importar outros controllers.
      if (filePath.includes('controller') || filePath.includes('handler')) {
        for (const importedFile of imports) {
          if (importedFile !== filePath && (importedFile.includes('controller') || importedFile.includes('handler'))) {
            patterns.push({
              name: 'Violação AcmeCorp - Acoplamento de Controllers',
              severity: 'MEDIUM',
              location: `${filePath} -> ${importedFile}`,
              description: 'Um Controller está importando e invocando diretamente outro Controller. Isso causa fluxos HTTP confusos e spaghettização.',
              suggestion: 'Extraia a lógica em comum para um Application Service ou UseCase que ambos os controllers possam usar.',
            });
          }
        }
      }
      
    }

    return patterns;
  }
};

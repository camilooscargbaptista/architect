import { TemplateContext, EnrichedTemplateContext } from '../../types.js';

/**
 * Domain templates — C4, BDD, TDD, ADR, Threat Model.
 * Reutilizable templates referenced by workflows and agents.
 */

/**
 * Helper to safely extract enriched context
 */
function getEnriched(ctx?: TemplateContext): Partial<EnrichedTemplateContext> {
  if (ctx && 'domain' in ctx) {
    return ctx as EnrichedTemplateContext;
  }
  return {};
}

/**
 * Generate C4 Architecture template with optional pre-filled examples
 */
export function generateC4Template(ctx?: EnrichedTemplateContext | TemplateContext): string {
  const enriched = getEnriched(ctx);
  const domain = enriched.domain;
  const modules = enriched.modules || [];
  const endpoints = enriched.endpoints || [];
  const integrations = domain?.integrations || [];

  // Build Level 1 content
  let level1Content = `Atores:
- [ator 1]: [descrição do papel]
- [ator 2]: [descrição do papel]`;

  if (domain?.businessEntities && domain.businessEntities.length > 0) {
    const actorsFromEntities = domain.businessEntities.slice(0, 2).map((e) => `- ${e.name}: Entidade de negócio`).join('\n');
    level1Content = `Atores:\n${actorsFromEntities}`;
  }

  let externalSystems = `- [sistema 1]: [como interage]
- [sistema 2]: [como interage]`;

  if (integrations.length > 0) {
    externalSystems = integrations
      .map((i) => `- ${i.name} (${i.type}): Integração de negócio`)
      .join('\n');
  }

  // Build Level 2 content
  let containerDiagram = `┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Backend    │───▶│   Database   │
│   (Web/App)  │    │   (API)      │    │   (PostgreSQL)│
└──────────────┘    └──────────────┘    └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │  External    │
                    │  Service     │
                    └──────────────┘`;

  if (ctx && 'stack' in ctx && ctx.stack) {
    const stack = ctx.stack;
    let frontendLabel = stack.hasFrontend ? `${stack.frameworks[0] || 'Frontend'}` : '[Frontend]';
    let backendLabel = stack.frameworks[1] || 'Backend';
    let dbLabel = '[Database]';
    if (stack.hasDatabase) {
      dbLabel = stack.frameworks.includes('PostgreSQL') ? 'PostgreSQL' : 'Database';
    }

    containerDiagram = `┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   ${frontendLabel.padEnd(11)}│───▶│   ${backendLabel.padEnd(11)}│───▶│   ${dbLabel.padEnd(11)}│
└──────────────┘    └──────────────┘    └──────────────┘`;
  }

  // Build Level 3 content
  let componentContent = `Módulo: [nome]
├── Controller: [nome] — [responsabilidade]
├── Service: [nome] — [responsabilidade]
├── Entity: [nome] — [campos principais]
├── DTO: [nome] — [campos de request/response]
└── Tests: [lista de testes]`;

  if (modules.length > 0) {
    const firstModule = modules[0];
    const controllers = firstModule.controllers.slice(0, 2).join(', ') || '[Controllers]';
    const services = firstModule.services.slice(0, 2).join(', ') || '[Services]';
    const entities = firstModule.entities.slice(0, 1).join(', ') || '[Entities]';

    componentContent = `Módulo: ${firstModule.name}
├── Controller: ${controllers} — Expõe endpoints REST
├── Service: ${services} — Lógica de negócio
├── Entity: ${entities} — Persistência de dados
├── DTO: [Request/Response]
└── Tests: ${firstModule.testFiles.length > 0 ? 'Implementados' : 'Pendentes'}`;
  }

  // Build Level 4 content — framework-aware code example
  const stack = ctx && 'stack' in ctx ? ctx.stack : undefined;
  const langs = stack ? stack.languages.map((l) => l.toLowerCase()) : [];
  const isPython = langs.includes('python');
  const isDart = langs.includes('dart');
  const isJava = langs.includes('java') || langs.includes('kotlin');
  const isGo = langs.includes('go');
  const isRust = langs.includes('rust');

  let level4Lang = 'typescript';
  let level4Content = `interface IExemploService {
  metodo(param: Tipo): Promise<Retorno>;
}`;

  if (isPython) {
    level4Lang = 'python';
    level4Content = `class IExemploService(ABC):
    @abstractmethod
    async def metodo(self, param: Tipo) -> Retorno:
        ...`;
  } else if (isDart) {
    level4Lang = 'dart';
    level4Content = `abstract class IExemploService {
  Future<Retorno> metodo(Tipo param);
}`;
  } else if (isJava) {
    level4Lang = 'java';
    level4Content = `public interface IExemploService {
    Retorno metodo(Tipo param);
}`;
  } else if (isGo) {
    level4Lang = 'go';
    level4Content = `type ExemploService interface {
    Metodo(param Tipo) (Retorno, error)
}`;
  } else if (isRust) {
    level4Lang = 'rust';
    level4Content = `trait ExemploService {
    fn metodo(&self, param: Tipo) -> Result<Retorno, Error>;
}`;
  }

  if (endpoints.length > 0) {
    const firstEndpoint = endpoints[0];
    if (isPython) {
      level4Content = `class I${firstEndpoint.handler}Service(ABC):
    # ${firstEndpoint.method} ${firstEndpoint.path}
    @abstractmethod
    async def handle_${firstEndpoint.handler.toLowerCase()}(self, req: Request) -> Response:
        ...`;
    } else if (isDart) {
      level4Content = `abstract class I${firstEndpoint.handler}Service {
  // ${firstEndpoint.method} ${firstEndpoint.path}
  Future<Response> handle${firstEndpoint.handler}(Request req);
}`;
    } else if (isJava) {
      level4Content = `public interface I${firstEndpoint.handler}Service {
    // ${firstEndpoint.method} ${firstEndpoint.path}
    Response handle${firstEndpoint.handler}(Request req);
}`;
    } else if (isGo) {
      level4Content = `type ${firstEndpoint.handler}Service interface {
    // ${firstEndpoint.method} ${firstEndpoint.path}
    Handle${firstEndpoint.handler}(req *Request) (*Response, error)
}`;
    } else {
      level4Content = `interface I${firstEndpoint.handler}Service {
  // ${firstEndpoint.method} ${firstEndpoint.path}
  handle${firstEndpoint.handler}(req: Request): Promise<Response>;
}`;
    }
  }

  return `# 🏗️ Template: Arquitetura C4

> Preencher os 4 níveis relevantes para a feature/mudança.

---

## Nível 1 — Contexto

> Visão de pássaro: quem são os atores e sistemas envolvidos?

\`\`\`
${level1Content}

Sistemas Externos:
${externalSystems}

Fluxo de dados:
[ator] → [sistema] → [nosso sistema] → [resposta]
\`\`\`

---

## Nível 2 — Container

> Quais serviços, apps, bancos de dados são tocados?

\`\`\`
${containerDiagram}
\`\`\`

---

## Nível 3 — Componente

> Quais módulos, classes, serviços são criados ou modificados?

\`\`\`
${componentContent}
\`\`\`

---

## Nível 4 — Código (se complexo)

> Interfaces, tipos, contratos. Apenas para decisões complexas.

\`\`\`${level4Lang}
${level4Content}
\`\`\`

---

## Decisões Arquiteturais

Se a decisão é significativa → criar ADR separado (ver template ADR).
`;
}

/**
 * Generate BDD template with optional pre-filled examples from project domain
 */
export function generateBddTemplate(ctx?: EnrichedTemplateContext | TemplateContext): string {
  const enriched = getEnriched(ctx);
  const domain = enriched.domain;
  const businessEntities = domain?.businessEntities || [];
  const compliance = domain?.compliance || [];

  let featureName = '[Nome da Feature]';
  let exampleScenario = `  Scenario: [cenário principal - sucesso]
    Given [contexto / pré-condição]
    And [contexto adicional, se necessário]
    When [ação do usuário]
    Then [resultado esperado]
    And [efeito colateral, se houver]`;

  // Generate example scenario from first business entity
  if (businessEntities.length > 0) {
    const entity = businessEntities[0];
    featureName = `Criar e Validar ${entity.name}`;
    exampleScenario = `  Scenario: Criar ${entity.name} com sucesso
    Given o usuário está no formulário de criação de ${entity.name}
    And todos os campos obrigatórios estão vazios
    When o usuário preenche os campos corretamente
    Then a entidade é persistida no banco de dados
    And uma mensagem de sucesso é exibida ao usuário`;
  }

  let complianceScenario = `  Scenario: [cenário de acesso negado]
    Given [usuário sem permissão]
    When [tenta acessar recurso]
    Then [resposta 403 / redirect]`;

  // Add compliance-specific scenario if applicable
  if (compliance.length > 0) {
    const comp = compliance[0];
    if (comp.name === 'LGPD') {
      complianceScenario = `  Scenario: Usuário solicita exclusão de dados sob LGPD
    Given um usuário autenticado no sistema
    When o usuário solicita a exclusão de seus dados pessoais
    Then todos os seus registros são anonimizados ou removidos
    And a solicitação é registrada em audit log`;
    } else if (comp.name === 'HIPAA') {
      complianceScenario = `  Scenario: Acesso a dados sensíveis de paciente
    Given um profissional de saúde autenticado
    When o profissional acessa registros de paciente
    Then o acesso é registrado com timestamp e usuário
    And a ação é auditada para compliance`;
    }
  }

  let domainSpecificSection = '';
  if (domain?.domain === 'fintech' || domain?.domain === 'payment') {
    domainSpecificSection = `

  # ── Cenários de Fintech ──

  Scenario: Transação com saldo insuficiente
    Given a conta do usuário tem saldo de R$ 50
    When o usuário tenta transferir R$ 100
    Then a transação é rejeitada
    And a mensagem "Saldo insuficiente" é exibida

  Scenario: Taxa de câmbio atualizada
    Given uma transação internacional está pendente
    When a taxa de câmbio muda de 5.0 para 5.2
    Then o valor em reais é recalculado
    And o usuário é notificado da mudança`;
  } else if (domain?.domain === 'tax' || domain?.subDomain === 'tax-processing') {
    domainSpecificSection = `

  # ── Cenários de Impostos ──

  Scenario: Calcular imposto sobre renda
    Given um contribuinte com rendimento mensal de R$ 5000
    When o sistema calcula o imposto devido
    Then o valor segue a tabela progressiva do IRPF
    And o resultado é salvo no banco de dados

  Scenario: Gerar DARF automático
    Given uma obrigação de imposto vencendo amanhã
    When o sistema processa as obrigações pendentes
    Then um DARF é gerado automaticamente
    And uma notificação é enviada ao contribuinte`;
  }

  return `# 🧪 Template: BDD — Behavior-Driven Development

> Um cenário para cada critério de aceite + cenários de erro + edge cases.

---

## Feature: ${featureName}

\`\`\`gherkin
Feature: ${featureName}
  Como usuário,
  Quero interagir com ${businessEntities[0]?.name || 'o sistema'},
  Para alcançar meu objetivo de negócio.

  # ── Happy Path ──

${exampleScenario}

  # ── Validações ──

  Scenario: Validação de dados obrigatórios
    Given um formulário de criação
    When o usuário tenta enviar sem preencher campos obrigatórios
    Then mensagens de erro são exibidas para cada campo

  # ── Edge Cases ──

  Scenario: Lidar com valores boundary
    Given o sistema aceita valores de 0 a 999999.99
    When o usuário tenta inserir um valor fora do range
    Then um erro de validação é retornado

  # ── Permissões ──

${complianceScenario}${domainSpecificSection}
\`\`\`

---

## Checklist

\`\`\`
□ Cada critério de aceite tem ≥ 1 cenário
□ Happy path coberto
□ Error paths cobertos
□ Edge cases cobertos
□ Permissões/autenticação cobertos
□ Cenários são independentes entre si
\`\`\`
`;
}

/**
 * Generate TDD template with optional pre-filled examples
 */
export function generateTddTemplate(ctx?: EnrichedTemplateContext | TemplateContext): string {
  const enriched = getEnriched(ctx);
  const modules = enriched.modules || [];
  const endpoints = enriched.endpoints || [];
  const stack = ctx && 'stack' in ctx ? ctx.stack : undefined;

  let testFramework = 'jest';
  let exampleTest = `    it('should [resultado esperado] when [condição]', () => {
      // Arrange
      const input = ...;

      // Act
      const result = metodo(input);

      // Assert
      expect(result).toEqual(expected);
    });`;

  // Detect test framework from stack (case-insensitive comparison)
  if (stack) {
    const langs = stack.languages.map((l) => l.toLowerCase());
    if (langs.includes('python')) {
      testFramework = 'pytest';
    } else if (langs.includes('dart')) {
      testFramework = 'flutter_test';
    } else if (langs.includes('java') || langs.includes('kotlin')) {
      testFramework = 'junit';
    } else if (langs.includes('go')) {
      testFramework = 'go_test';
    } else if (langs.includes('rust')) {
      testFramework = 'cargo_test';
    }
  }

  let moduleName = '[Nome do Módulo/Classe]';
  let methodName = '[método/função]';
  let exampleModule = modules[0];

  if (exampleModule) {
    moduleName = exampleModule.name;
    const service = exampleModule.services[0] || 'Service';
    methodName = `create${service.replace('Service', '')}`;

    if (testFramework === 'pytest') {
      exampleTest = `    def test_should_create_entity_successfully():
        # Arrange
        input_data = {"name": "Test Entity"}

        # Act
        result = service.${methodName}(input_data)

        # Assert
        assert result is not None
        assert result.name == "Test Entity"`;
    } else if (testFramework === 'flutter_test') {
      exampleTest = `    test('should create entity successfully', () async {
      // Arrange
      final input = CreateRequest(name: 'Test');

      // Act
      final result = await service.${methodName}(input);

      // Assert
      expect(result, isNotNull);
      expect(result.name, equals('Test'));
    });`;
    } else if (testFramework === 'go_test') {
      exampleTest = `func TestShould_Create${moduleName}_Successfully(t *testing.T) {
    // Arrange
    input := ${moduleName}Input{Name: "Test Entity"}

    // Act
    result, err := service.${methodName}(input)

    // Assert
    assert.NoError(t, err)
    assert.NotNil(t, result)
    assert.Equal(t, "Test Entity", result.Name)
}`;
    } else if (testFramework === 'cargo_test') {
      exampleTest = `#[test]
fn test_should_create_${moduleName.toLowerCase()}_successfully() {
    // Arrange
    let input = ${moduleName}Input { name: "Test Entity".to_string() };

    // Act
    let result = service.${methodName}(&input);

    // Assert
    assert!(result.is_ok());
    assert_eq!(result.unwrap().name, "Test Entity");
}`;
    } else if (testFramework === 'junit') {
      exampleTest = `    @Test
    void shouldCreate${moduleName}Successfully() {
        // Arrange
        var input = new ${moduleName}Input("Test Entity");

        // Act
        var result = service.${methodName}(input);

        // Assert
        assertNotNull(result);
        assertEquals("Test Entity", result.getName());
    }`;
    } else {
      exampleTest = `    it('should create ${moduleName} successfully', () => {
      // Arrange
      const input = { name: 'Test Entity' };

      // Act
      const result = service.${methodName}(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Entity');
    });`;
    }
  }

  let endpointTest = '';
  if (endpoints.length > 0) {
    const endpoint = endpoints[0];
    if (testFramework === 'pytest') {
      endpointTest = `

  def test_${endpoint.method.toLowerCase()}_${endpoint.path.replace(/\//g, '_')}():
    """Test ${endpoint.method} ${endpoint.path}"""
    # Arrange
    client = TestClient(app)

    # Act
    response = client.${endpoint.method.toLowerCase()}("${endpoint.path}")

    # Assert
    assert response.status_code == 200`;
    } else if (testFramework === 'flutter_test') {
      endpointTest = `

  testWidgets('should ${endpoint.method.toLowerCase()} ${endpoint.path} correctly', (WidgetTester tester) async {
    // Arrange
    when(mockClient.${endpoint.method.toLowerCase()}(endpoint)).thenAnswer((_) async => Response('{}', 200));

    // Act
    final result = await client.${endpoint.method.toLowerCase()}(endpoint);

    // Assert
    expect(result.statusCode, equals(200));
  });`;
    } else if (testFramework === 'go_test') {
      endpointTest = `

func Test_${endpoint.method}_${endpoint.path.replace(/\//g, '_')}(t *testing.T) {
    // Arrange
    req := httptest.NewRequest("${endpoint.method}", "${endpoint.path}", nil)
    w := httptest.NewRecorder()

    // Act
    handler.ServeHTTP(w, req)

    // Assert
    assert.Equal(t, http.StatusOK, w.Code)
}`;
    } else if (testFramework === 'cargo_test') {
      endpointTest = `

#[actix_web::test]
async fn test_${endpoint.method.toLowerCase()}_${endpoint.path.replace(/\//g, '_')}() {
    // Arrange
    let app = test::init_service(App::new().configure(routes)).await;
    let req = test::TestRequest::${endpoint.method.toLowerCase()}().uri("${endpoint.path}").to_request();

    // Act
    let resp = test::call_service(&app, req).await;

    // Assert
    assert!(resp.status().is_success());
}`;
    } else if (testFramework === 'junit') {
      endpointTest = `

    @Test
    void should${endpoint.method}${endpoint.handler}Correctly() throws Exception {
        // Act & Assert
        mockMvc.perform(${endpoint.method.toLowerCase()}("${endpoint.path}"))
            .andExpect(status().isOk());
    }`;
    } else {
      endpointTest = `

  it('should ${endpoint.method.toLowerCase()} ${endpoint.path} correctly', async () => {
    // Arrange
    const endpoint = '${endpoint.path}';

    // Act
    const response = await request(app).${endpoint.method.toLowerCase()}(endpoint);

    // Assert
    expect(response.status).toBe(200);
  });`;
    }
  }

  const structureLabel = testFramework === 'pytest' ? 'def test_' : testFramework === 'flutter_test' ? 'test(' : 'describe(';
  const openingBracket = testFramework === 'pytest' ? ':' : testFramework === 'flutter_test' ? ', () async {' : ", () => {";

  return `# 🔬 Template: TDD — Test-Driven Development

> RED → GREEN → REFACTOR. Nesta ordem. Sempre.

---

## Estrutura de Testes (${testFramework})

\`\`\`${testFramework === 'pytest' ? 'python' : testFramework === 'flutter_test' ? 'dart' : testFramework === 'go_test' ? 'go' : testFramework === 'cargo_test' ? 'rust' : testFramework === 'junit' ? 'java' : 'typescript'}
${
  testFramework === 'pytest'
    ? `import pytest
from app.services.${moduleName.toLowerCase()} import ${moduleName}Service

class Test${moduleName}:
  """Testes para ${moduleName}"""

${exampleTest}

  def test_should_throw_error_when_invalid_input():
    # Arrange
    invalid_input = None

    # Act & Assert
    with pytest.raises(ValueError):
      service.${methodName}(invalid_input)`
    : testFramework === 'flutter_test'
      ? `import 'package:flutter_test/flutter_test.dart';
import 'package:${moduleName.toLowerCase()}/services/${moduleName.toLowerCase()}_service.dart';

void main() {
  group('${moduleName}Service', () {

${exampleTest}

    test('should throw exception when input is invalid', () {
      // Arrange
      final invalid = null;

      // Act & Assert
      expect(() => service.${methodName}(invalid), throwsException);
    });${endpointTest}
  });
}`
    : testFramework === 'go_test'
      ? `package ${moduleName.toLowerCase()}_test

import (
    "testing"
    "net/http"
    "net/http/httptest"
    "github.com/stretchr/testify/assert"
)

// ── Happy Path ──
${exampleTest}

// ── Error Path ──
func TestShould_Return_Error_When_InvalidInput(t *testing.T) {
    // Arrange
    input := ${moduleName}Input{}

    // Act
    _, err := service.${methodName}(input)

    // Assert
    assert.Error(t, err)
}${endpointTest}`
    : testFramework === 'cargo_test'
      ? `#[cfg(test)]
mod tests {
    use super::*;

    // ── Happy Path ──
${exampleTest}

    // ── Error Path ──
    #[test]
    fn test_should_return_error_when_invalid_input() {
        // Arrange
        let input = ${moduleName}Input { name: "".to_string() };

        // Act
        let result = service.${methodName}(&input);

        // Assert
        assert!(result.is_err());
    }${endpointTest}
}`
    : testFramework === 'junit'
      ? `import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ${moduleName}Test {

    // ── Happy Path ──
${exampleTest}

    // ── Error Path ──
    @Test
    void shouldThrowWhenInvalidInput() {
        // Arrange
        var invalidInput = new ${moduleName}Input(null);

        // Act & Assert
        assertThrows(IllegalArgumentException.class,
            () -> service.${methodName}(invalidInput));
    }${endpointTest}
}`
      : `describe('${moduleName}', () => {

  describe('${methodName}', () => {

    // ── Happy Path ──
${exampleTest}

    // ── Error Path ──
    it('should throw [erro] when [condição inválida]', () => {
      // Arrange
      const invalidInput = undefined;

      // Act & Assert
      expect(() => service.${methodName}(invalidInput)).toThrow(Error);
    });

    // ── Boundary ──
    it('should handle empty input', () => {
      // Arrange
      const boundaryInput = {};

      // Act
      const result = service.${methodName}(boundaryInput);

      // Assert
      expect(result).toBeDefined();
    });${endpointTest}
  });
});`
}
\`\`\`

---

## Ciclo TDD

\`\`\`
1. RED:    Escrever teste que FALHA
2. GREEN:  Escrever código MÍNIMO para passar
3. REFACTOR: Melhorar sem quebrar testes
4. REPEAT
\`\`\`

---

## Checklist

\`\`\`
□ Teste escrito ANTES do código
□ Teste falha antes da implementação (RED)
□ Implementação mínima para passar (GREEN)
□ Refatoração sem quebrar testes (REFACTOR)
□ Happy path coberto
□ Error path coberto
□ Boundary cases cobertos
□ Cobertura atinge o mínimo do projeto
\`\`\`
`;
}

/**
 * Generate ADR template with optional pre-filled examples from tech stack
 */
export function generateAdrTemplate(ctx?: EnrichedTemplateContext | TemplateContext): string {
  const enriched = getEnriched(ctx);
  const stack = ctx && 'stack' in ctx ? ctx.stack : undefined;
  const domain = enriched.domain;

  let exampleDecision = '[Título da Decisão]';
  let contextDescription = '[descrever o contexto de negócio e técnico]';
  let decisionDescription = '[descrever a decisão claramente]';
  let alternativeOne = '[alternativa 1]';
  let alternativeTwo = '[alternativa 2]';

  // Generate tech stack specific examples (framework-aware)
  if (stack) {
    const framework = stack.frameworks[0] || 'Backend Framework';
    const database = stack.frameworks.find((f) => ['PostgreSQL', 'MongoDB', 'MySQL', 'SQLite', 'Redis'].includes(f)) || 'PostgreSQL';
    const adrLangs = stack.languages.map((l) => l.toLowerCase());
    const adrIsPython = adrLangs.includes('python');
    const adrIsDart = adrLangs.includes('dart');
    const adrIsGo = adrLangs.includes('go');
    const adrIsJava = adrLangs.includes('java') || adrLangs.includes('kotlin');

    exampleDecision = `Uso de ${framework} para Backend`;

    if (adrIsPython) {
      contextDescription = `O projeto requer uma API REST escalável com Python. Precisamos escolher um framework que:
- Suporte async/await nativo
- Tenha tipagem com Pydantic e validação automática
- Tenha comunidade ativa e documentação excelente`;
      decisionDescription = `Decidimos usar ${framework} como framework backend principal. ${framework} oferece:
- Async/await nativo com alto desempenho
- Validação automática via Pydantic
- Documentação OpenAPI/Swagger automática
- Suporte a bancos de dados (SQLAlchemy, Tortoise ORM, etc.)`;
      alternativeOne = 'Django REST Framework';
      alternativeTwo = 'Flask + extensões';
    } else if (adrIsDart) {
      contextDescription = `O projeto requer um aplicativo mobile multiplataforma. Precisamos escolher um framework que:
- Suporte iOS e Android com um único codebase
- Tenha hot-reload e boa experiência de desenvolvimento
- Tenha widgets nativos e alta performance`;
      decisionDescription = `Decidimos usar ${framework} como framework principal. ${framework} oferece:
- UI declarativa com widgets nativos
- Hot-reload para desenvolvimento rápido
- Compilação nativa para iOS e Android
- Ecossistema de pacotes via pub.dev`;
      alternativeOne = 'React Native';
      alternativeTwo = 'Kotlin Multiplatform';
    } else if (adrIsGo) {
      contextDescription = `O projeto requer um serviço backend de alta performance. Precisamos escolher uma stack que:
- Tenha concorrência nativa eficiente
- Suporte compilação estática e deploy simplificado
- Tenha forte tipagem e performance previsível`;
      decisionDescription = `Decidimos usar ${framework} como framework principal. ${framework} oferece:
- Goroutines para concorrência eficiente
- Binário estático único para deploy
- Performance previsível e baixo footprint
- Ecossistema robusto de middleware`;
      alternativeOne = 'net/http padrão + chi router';
      alternativeTwo = 'Fiber (Express-like para Go)';
    } else if (adrIsJava) {
      contextDescription = `O projeto requer uma API REST enterprise-grade. Precisamos escolher um framework que:
- Suporte injeção de dependência nativa
- Tenha ecossistema maduro e produção comprovada
- Tenha integração com bancos de dados (JPA/Hibernate)`;
      decisionDescription = `Decidimos usar ${framework} como framework backend principal. ${framework} oferece:
- Injeção de dependência nativa
- Ecossistema maduro com milhares de extensões
- Suporte a JPA/Hibernate para persistência
- Segurança via Spring Security / equivalente`;
      alternativeOne = 'Quarkus (nativo GraalVM)';
      alternativeTwo = 'Micronaut';
    } else {
      contextDescription = `O projeto requer uma API REST escalável com TypeScript. Precisamos escolher um framework que:
- Suporte TypeScript nativo
- Tenha decorators e dependency injection
- Tenha comunidade ativa e documentação excelente`;
      decisionDescription = `Decidimos usar ${framework} como framework backend principal. ${framework} oferece:
- Arquitetura modular built-in
- Decorators para roteamento e middleware
- Injeção de dependência nativa
- Suporte a bancos de dados (TypeORM, Prisma, etc.)`;
      alternativeOne = 'Express.js + middleware customizado';
      alternativeTwo = 'Fastify';
    }

    // Add database-specific ADR if applicable
    let dbDecision = '';
    if (database) {
      dbDecision = `

---

## ADR-002: Banco de Dados ${database}

**Status:** accepted
**Data:** 2024-01-15
**Autores:** [equipe técnica]

### Contexto

Precisamos escolher um banco de dados relacional que:
- Suporte transações ACID
- Tenha integração com ${framework}
- Permita escalabilidade horizontal

### Decisão

Escolhemos ${database} como banco de dados principal por:
- Suporte a JSON nativo
- Excelente performance em leitura/escrita
- Integração com ${adrIsPython ? 'SQLAlchemy/Alembic' : adrIsJava ? 'JPA/Hibernate' : adrIsGo ? 'GORM/sqlx' : 'TypeORM/Prisma'} é padrão

### Alternativas Consideradas

| # | Alternativa | Prós | Contras |
|---|-----------|------|---------|
| 1 | MySQL | Popular, estável | Menos recursos avançados |
| 2 | MongoDB | Escalável | Sem ACID nativo, schema dinâmico |`;
      return `# 📋 Template: ADR — Architecture Decision Record

> Use quando uma decisão técnica é significativa ou controversa.

---

## ADR-001: ${exampleDecision}

**Status:** proposed | accepted | deprecated | superseded by ADR-YYY
**Data:** YYYY-MM-DD
**Autores:** [quem participou da decisão]

---

### Contexto

> Qual é o problema ou necessidade que levou a esta decisão?

${contextDescription}

---

### Decisão

> O que foi decidido?

${decisionDescription}

---

### Alternativas Consideradas

| # | Alternativa | Prós | Contras | Por que descartada |
|---|-----------|------|---------|-------------------|
| 1 | ${alternativeOne} | [prós] | [contras] | [motivo] |
| 2 | ${alternativeTwo} | [prós] | [contras] | [motivo] |

---

### Consequências

**Positivas:**
- Arquitetura clara e escalável
- Código mais organizado e testável
- Comunidade ativa para suporte

**Negativas:**
- Curva de aprendizado para novos desenvolvedores
- Overhead de dependências

**Riscos:**
- Atualização de versões major — probabilidade: média

---

### Notas

- Revisar em 6 meses se a decisão continua válida
${dbDecision}`;
    }
  }

  // Add domain-specific ADR section
  let domainAdrs = '';
  if (domain?.domain === 'fintech') {
    domainAdrs = `

---

## ADR-XXX: Criptografia de CPF e Dados Sensíveis

**Status:** proposed
**Data:** YYYY-MM-DD
**Autores:** [equipe de segurança]

### Contexto

Dados de clientes (CPF, CNPJ, dados bancários) são críticos para fintech.
Precisamos de criptografia de dados sensíveis at-rest.

### Decisão

Usar AES-256 para criptografia de dados sensíveis com chaves armazenadas no vault.

### Alternativas Consideradas

| # | Alternativa | Segurança | Complexidade |
|---|-----------|----------|--------------|
| 1 | AES-256 | Alta | Média |
| 2 | RSA | Muito Alta | Alta |
| 3 | Nenhuma | Baixa | Baixa |`;
  } else if (domain?.domain === 'healthtech') {
    domainAdrs = `

---

## ADR-XXX: Conformidade HIPAA em Armazenamento

**Status:** proposed
**Data:** YYYY-MM-DD
**Autores:** [equipe de compliance]

### Contexto

Dados de saúde devem estar em conformidade com HIPAA.
Precisamos garantir criptografia, auditoria e retenção apropriada.

### Decisão

Implementar criptografia AES-256, logging de acesso e retenção de dados por 7 anos.`;
  }

  return `# 📋 Template: ADR — Architecture Decision Record

> Use quando uma decisão técnica é significativa ou controversa.

---

## ADR-XXX: ${exampleDecision}

**Status:** proposed | accepted | deprecated | superseded by ADR-YYY
**Data:** YYYY-MM-DD
**Autores:** [quem participou da decisão]

---

### Contexto

> Qual é o problema ou necessidade que levou a esta decisão?

${contextDescription}

---

### Decisão

> O que foi decidido?

${decisionDescription}

---

### Alternativas Consideradas

| # | Alternativa | Prós | Contras | Por que descartada |
|---|-----------|------|---------|-------------------|
| 1 | ${alternativeOne} | [prós] | [contras] | [motivo] |
| 2 | ${alternativeTwo} | [prós] | [contras] | [motivo] |

---

### Consequências

**Positivas:**
- [consequência positiva 1]
- [consequência positiva 2]

**Negativas:**
- [consequência negativa 1]
- [mitigação: como minimizar]

**Riscos:**
- [risco 1] — probabilidade: [alta/média/baixa]

---

### Notas

- [qualquer informação adicional]${domainAdrs}
`;
}

/**
 * Generate Threat Model template with optional pre-filled domain-specific threats
 */
export function generateThreatModelTemplate(ctx?: EnrichedTemplateContext | TemplateContext): string {
  const enriched = getEnriched(ctx);
  const domain = enriched.domain;
  const businessEntities = domain?.businessEntities || [];
  const compliance = domain?.compliance || [];

  let featureName = '[Nome]';
  let actors = `| [ator 1] | [alto/médio/baixo] | [dados/recursos] |`;
  let sensitiveData = `| [dado 1] | PII / Financeiro / Auth | [como proteger] |`;
  let domainSpecificThreats = '';

  // Generate domain-specific actors and threats
  if (domain?.domain === 'fintech') {
    featureName = 'Transferência Bancária';
    actors = `| Usuário | Alto | Conta bancária, saldo |
| Sistema Interno | Alto | Todas as transações |
| Banco Parceiro | Médio | Dados de rota |
| Auditor (interno) | Médio | Logs de transações |`;

    sensitiveData = `| CPF | PII | AES-256 at-rest, TLS in-transit |
| Número de Conta | Financeiro | AES-256 + masking |
| Saldo | Financeiro | Hash verificável |
| Histórico de Transações | Auditoria | Criptografado, signed |`;

    domainSpecificThreats = `

---

## Ameaças Específicas de Fintech

| Ameaça | Descrição | Mitigação |
|--------|-----------|-----------|
| Falsificação de Identidade | Hacker usa CPF falso para abrir conta | Validação com gov API, SMS 2FA |
| Tamperização de Saldo | Atacante modifica saldo direto no DB | Checksums, transações com assinatura |
| Roubo de Sessão | Hijack de cookie de autenticação | HTTPS, SameSite cookie, token rotation |
| Negação de Transferência | Usuário nega ter feito transação | Auditoria, e-mail de confirmação |
| Bloqueio de Serviço | DDoS na API de transações | Rate limiting, WAF, CDN |
| Escalonamento de Permissão | Admin faz transferência não autorizada | RBAC, audit logging, segregação |`;
  } else if (domain?.domain === 'tax' || domain?.subDomain === 'tax-processing') {
    featureName = 'Cálculo e Envio de Imposto';
    actors = `| Contribuinte | Alto | Declaração, CPF, rendimentos |
| Contador | Médio | Dados do cliente, acesso a declaração |
| Receita Federal | Médio | Declaração enviada, comprovantes |
| Auditor Interno | Médio | Logs de processamento, erros |`;

    sensitiveData = `| CPF/CNPJ | PII | AES-256, masking em logs |
| Rendimentos Totais | Financeiro | Criptografado |
| Deduções e Benefícios | Pessoal | Criptografado |
| Histórico de Envios | Auditoria | Signed, imutável |`;

    domainSpecificThreats = `

---

## Ameaças Específicas de Impostos

| Ameaça | Descrição | Mitigação |
|--------|-----------|-----------|
| Falsificação de Receita | Declarar rendimento falso | Cruzamento com dados da Receita Federal |
| Tamperização de Cálculo | Hacker reduz imposto devido | Validação automática, recálculo periódico |
| Vazamento de Dados | Exposição de CPF/rendimento | Criptografia, LGPD compliance |
| Negação de Envio | Usuário nega envio ao fisco | Timestamp assinado, audit log |
| Indisponibilidade na Época | Servidor cai no último dia | SLA 99.9%, failover automático |
| Acesso não Autorizado | Contador acessa dado de cliente errado | RBAC granular, segregação de dados |`;
  } else if (domain?.domain === 'healthtech') {
    featureName = 'Acesso a Histórico Médico';
    actors = `| Paciente | Alto | Histórico médico, exames, receitas |
| Médico | Alto | Prontuário do paciente |
| Farmacêutico | Médio | Prescrições, alergias |
| Auditor Compliance | Médio | Logs de acesso, consentimento |`;

    sensitiveData = `| Nome Paciente | PII | Criptografado, HIPAA compliant |
| Histórico Médico | Saúde | AES-256, acesso restrito |
| Medicamentos | Saúde | Criptografado, masking em logs |
| Resultado de Exames | Saúde | Criptografado, assinado digitalmente |`;

    domainSpecificThreats = `

---

## Ameaças Específicas de Healthtech

| Ameaça | Descrição | Mitigação |
|--------|-----------|-----------|
| Acesso não Autorizado | Outro médico lê prontuário | RBAC por especialidade, audit |
| Adulteração de Histórico | Alterar resultado de exame | Blockchain/assinatura digital |
| Vazamento de Dados | Exposição de histórico médico | Criptografia, isolamento de rede |
| Negação de Diagnóstico | Paciente nega consentimento | Digital signature + timestamp |
| Indisponibilidade | Sistema cai durante consulta | Backup em tempo real, SLA 99.95% |
| Privilégio Elevado | Admin lê dados de qualquer paciente | Segregação de funções, logging |`;
  }

  return `# 🛡️ Template: Threat Model (STRIDE)

> Use para features que lidam com dados sensíveis, pagamentos, autenticação.

---

## Feature: ${featureName}

### Atores e Assets

| Ator | Nível de Confiança | Assets que Acessa |
|------|-------------------|------------------|
${actors}

---

### Análise STRIDE

| Categoria | Ameaça | Probabilidade | Impacto | Mitigação |
|-----------|--------|-------------|---------|-----------|
| **S**poofing | Identidade falsa / autenticação fraca | M | A | MFA, JWT assinado, validação gov |
| **T**ampering | Alteração de dados em trânsito/repouso | M | A | HTTPS, assinatura digital, checksums |
| **R**epudiation | Negar ação realizada | M | A | Audit log detalhado com timestamp |
| **I**nformation Disclosure | Vazamento de dados sensíveis | A | A | Criptografia AES-256, LGPD compliance |
| **D**enial of Service | Serviço indisponível (DDoS, travamento) | M | A | Rate limiting, WAF, scaling automático |
| **E**levation of Privilege | Escalar permissão (user → admin) | M | A | RBAC granular, segregação de funções |

---

### Dados Sensíveis

| Dado | Classificação | Proteção |
|------|-------------|----------|
${sensitiveData}

---

### Conformidade e Requisitos Regulatórios

${
  compliance.length > 0
    ? `| Regulamento | Aplicável | Verificação |
|-------------|-----------|-------------|
${compliance.map((c) => `| ${c.name} | Sim | ${c.mandatoryChecks[0] || 'Auditoria'} |`).join('\n')}`
    : `| Regulamento | Aplicável | Verificação |
|-------------|-----------|-------------|
| LGPD (dados pessoais) | Depende | Consentimento, direito ao esquecimento |
| Conformidade de Dados | Depende | Criptografia, HTTPS, audit logs |`
}

---

### Checklist de Segurança

\`\`\`
□ Input validado e sanitizado
□ Output encodado (XSS prevention)
□ Queries parametrizadas (SQL injection)
□ Autenticação obrigatória (MFA quando sensível)
□ Autorização por role/permission (RBAC)
□ Dados sensíveis criptografados at rest (AES-256)
□ Dados sensíveis criptografados in transit (TLS 1.2+)
□ Rate limiting implementado
□ Audit log para ações sensíveis (timestamp + usuário)
□ Secrets em variáveis de ambiente (não hardcoded)
□ Consentimento e transparência (LGPD/GDPR)
□ Testes de penetração agendados
\`\`\`
${domainSpecificThreats}
`;
}

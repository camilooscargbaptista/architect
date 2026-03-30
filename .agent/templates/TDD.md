# 🔬 Template: TDD — Test-Driven Development

> RED → GREEN → REFACTOR. Nesta ordem. Sempre.

---

## Estrutura de Testes (jest)

```typescript
describe('agent-generator', () => {

  describe('create', () => {

    // ── Happy Path ──
    it('should create agent-generator successfully', () => {
      // Arrange
      const input = { name: 'Test Entity' };

      // Act
      const result = service.create(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Entity');
    });

    // ── Error Path ──
    it('should throw [erro] when [condição inválida]', () => {
      // Arrange
      const invalidInput = undefined;

      // Act & Assert
      expect(() => service.create(invalidInput)).toThrow(Error);
    });

    // ── Boundary ──
    it('should handle empty input', () => {
      // Arrange
      const boundaryInput = {};

      // Act
      const result = service.create(boundaryInput);

      // Assert
      expect(result).toBeDefined();
    });

  it('should get /endpointextractor correctly', async () => {
    // Arrange
    const endpoint = '/endpointextractor';

    // Act
    const response = await request(app).get(endpoint);

    // Assert
    expect(response.status).toBe(200);
  });
  });
});
```

---

## Ciclo TDD

```
1. RED:    Escrever teste que FALHA
2. GREEN:  Escrever código MÍNIMO para passar
3. REFACTOR: Melhorar sem quebrar testes
4. REPEAT
```

---

## Checklist

```
□ Teste escrito ANTES do código
□ Teste falha antes da implementação (RED)
□ Implementação mínima para passar (GREEN)
□ Refatoração sem quebrar testes (REFACTOR)
□ Happy path coberto
□ Error path coberto
□ Boundary cases cobertos
□ Cobertura atinge o mínimo do projeto
```

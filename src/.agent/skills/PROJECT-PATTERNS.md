---
antigravity:
  trigger: 'on_demand'
  description: 'Padrões e convenções específicos do projeto'
version: 3.1.0
---

# 📚 Skills: Padrões do Projeto

> Referência rápida dos padrões arquiteturais detectados e como seguí-los.

---

## Convenções

- **Nomenclatura de arquivos:** camelCase para arquivos, PascalCase para classes
- **Stack:** TypeScript, JavaScript
- **Frameworks:** Não detectados

---

## Padrões Arquiteturais Detectados

### Extractor/Parser Pattern

Extractors/Parsers são usados para extrair e transformar dados de fontes externas (PDFs, APIs, arquivos).

**Exemplos no projeto:**
- `core/agent-generator/enrichers/endpoint-extractor.ts`
- `core/agent-generator/enrichers/endpoint-extractor.js`

**Como criar um novo:**
1. Criar interface: `I{Tipo}Extractor`
2. Implementar: `{Tipo}Extractor implements I{Tipo}Extractor`
3. Método principal: `extract(source): ExtractedData`
4. Testar com fixtures (dados de exemplo)
5. Tratar edge cases: dados vazios, formato inválido, timeout


---

## Padrões de Domínio: devtools / code-intelligence



### Integrações
- **Email (SMTP)** (other)



---

## Checklist para Novo Código

```
□ Segue os padrões acima?
□ Testes escritos antes do código (TDD)?
□ Nomenclatura consistente com convenções?
□ Sem duplicação de lógica existente?
□ Documentação atualizada (JSDoc/docstring)?
```

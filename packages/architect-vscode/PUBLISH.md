# Guia de Publicação — Architect Intelligence Extension

## Pré-requisitos

```bash
cd packages/architect-vscode
npm install
npm run build   # Gera dist/extension.js via esbuild
```

---

## 1. VS Code Marketplace

### 1.1 Criar Publisher (primeira vez)

1. Acesse https://dev.azure.com
2. Crie uma organização (ou use uma existente)
3. Vá em **User Settings** (ícone do usuário) → **Personal Access Tokens**
4. Crie um token com:
   - **Name:** `vsce-publish`
   - **Organization:** All accessible organizations
   - **Scopes:** Custom → **Marketplace** → check **Manage**
   - **Expiration:** 1 year
5. Copie o token gerado

### 1.2 Registrar o Publisher

```bash
npx @vscode/vsce login camilooscargbaptista
# Cola o PAT quando pedir
```

Se o publisher ainda não existe:
```bash
# Acesse https://marketplace.visualstudio.com/manage
# Clique "Create Publisher"
# Use ID: camilooscargbaptista
# Display Name: Girardelli Tecnologia
```

### 1.3 Publicar

```bash
# Gerar .vsix e publicar
npx @vscode/vsce publish --no-dependencies

# Ou publicar um .vsix já existente
npx @vscode/vsce publish --packagePath architect-vscode-9.0.0.vsix
```

A extensão aparece em https://marketplace.visualstudio.com em ~5 minutos.

---

## 2. Open VSX (Cursor, Antigravity, Theia, Eclipse Che)

### 2.1 Criar conta

1. Acesse https://open-vsx.org
2. Faça login com GitHub
3. Vá em **Settings** → **Access Tokens**
4. Crie um token com nome `ovsx-publish`
5. Copie o token

### 2.2 Criar namespace (primeira vez)

```bash
npx ovsx create-namespace camilooscargbaptista -p <OPENVSX_TOKEN>
```

### 2.3 Publicar

```bash
# Publicar direto
npx ovsx publish --no-dependencies -p <OPENVSX_TOKEN>

# Ou publicar um .vsix existente
npx ovsx publish architect-vscode-9.0.0.vsix -p <OPENVSX_TOKEN>
```

A extensão aparece em https://open-vsx.org imediatamente.

---

## 3. Instalar Localmente (para testar)

```bash
# VS Code
code --install-extension architect-vscode-9.0.0.vsix

# Cursor
cursor --install-extension architect-vscode-9.0.0.vsix

# Ou via GUI: Extensions → "..." → "Install from VSIX..."
```

---

## 4. Atualizar versão

```bash
# Bump version
npm version patch   # 9.0.0 → 9.0.1
# ou
npm version minor   # 9.0.0 → 9.1.0

# Rebuild e republicar
npm run build
npx @vscode/vsce publish --no-dependencies
npx ovsx publish --no-dependencies -p <OPENVSX_TOKEN>
```

---

## 5. CI/CD (opcional — GitHub Actions)

Crie `.github/workflows/publish-extension.yml`:

```yaml
name: Publish Extension
on:
  push:
    tags: ['vscode-v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install & Build
        working-directory: packages/architect-vscode
        run: |
          npm install
          npm run build

      - name: Publish to VS Code Marketplace
        working-directory: packages/architect-vscode
        run: npx @vscode/vsce publish --no-dependencies
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}

      - name: Publish to Open VSX
        working-directory: packages/architect-vscode
        run: npx ovsx publish --no-dependencies -p ${{ secrets.OPENVSX_TOKEN }}
```

Secrets necessários no GitHub:
- `VSCE_PAT` — Azure DevOps Personal Access Token
- `OPENVSX_TOKEN` — Open VSX Access Token

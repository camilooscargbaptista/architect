#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  🏗️  Architect v3.0 — Interactive Launcher                      ║
# ║  Seleciona projeto via Finder, executa análise completa,        ║
# ║  salva resultados no diretório escolhido.                       ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# ── Script location (resolve symlinks) ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHITECT_BIN="${SCRIPT_DIR}/dist/adapters/cli.js"

# ── Helpers ──

print_banner() {
  local GRAY='\033[38;5;240m'
  local WHITE='\033[38;5;255m'
  local MAGENTA='\033[38;5;201m'
  echo ""
  echo -e "${GRAY}  ┌─────────────────────────────────────────────────────────────────┐${NC}"
  echo -e "${GRAY}  │${NC}                                                                 ${GRAY}│${NC}"
  echo -e "${GRAY}  │${NC}  ${CYAN}${BOLD}⚡ ARCHITECT v3.0${NC}  ${DIM}Enterprise Architecture Intelligence${NC}     ${GRAY}│${NC}"
  echo -e "${GRAY}  │${NC}  ${DIM}@girardelli/architect — powered by Girardelli Tecnologia${NC}    ${GRAY}│${NC}"
  echo -e "${GRAY}  │${NC}                                                                 ${GRAY}│${NC}"
  echo -e "${GRAY}  └─────────────────────────────────────────────────────────────────┘${NC}"
  echo ""
}

print_step() {
  echo -e "\n${BLUE}▸${NC} ${BOLD}$1${NC}"
}

print_success() {
  echo -e "  ${GREEN}✅ $1${NC}"
}

print_warn() {
  echo -e "  ${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "  ${RED}❌ $1${NC}"
}

print_info() {
  echo -e "  ${DIM}$1${NC}"
}

# ── OS Detection ──

detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "macos" ;;
    Linux*)  echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

OS=$(detect_os)

# ── Folder Picker ──

pick_folder() {
  local prompt="$1"
  local default_path="${2:-$HOME}"
  local result=""

  case "$OS" in
    macos)
      result=$(osascript -e "
        set selectedFolder to choose folder with prompt \"$prompt\" default location POSIX file \"$default_path\"
        return POSIX path of selectedFolder
      " 2>/dev/null) || true
      ;;
    linux)
      # Try zenity first (GNOME), then kdialog (KDE), then terminal fallback
      if command -v zenity &>/dev/null; then
        result=$(zenity --file-selection --directory --title="$prompt" 2>/dev/null) || true
      elif command -v kdialog &>/dev/null; then
        result=$(kdialog --getexistingdirectory "$default_path" --title "$prompt" 2>/dev/null) || true
      fi
      ;;
    windows)
      # PowerShell folder picker
      result=$(powershell.exe -Command "
        Add-Type -AssemblyName System.Windows.Forms
        \$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        \$dialog.Description = '$prompt'
        \$dialog.SelectedPath = '$default_path'
        if (\$dialog.ShowDialog() -eq 'OK') { \$dialog.SelectedPath }
      " 2>/dev/null | tr -d '\r') || true
      ;;
  esac

  # Fallback: terminal input
  if [ -z "$result" ]; then
    echo "" >&2
    echo -e "  ${YELLOW}Não foi possível abrir o seletor de pasta.${NC}" >&2
    echo -e "  ${DIM}Digite o caminho manualmente:${NC}" >&2
    read -rp "  > " result </dev/tty
  fi

  # Remove trailing slash
  echo "${result%/}"
}

# ── Menu de Análise ──

show_analysis_menu() {
  echo "" >&2
  echo -e "${BOLD}Selecione as análises a executar:${NC}" >&2
  echo "" >&2
  echo -e "  ${CYAN}1)${NC} 🔍 Análise completa     ${DIM}(report HTML + refactor plan + agents)${NC}" >&2
  echo -e "  ${CYAN}2)${NC} 📊 Apenas score          ${DIM}(score rápido com breakdown)${NC}" >&2
  echo -e "  ${CYAN}3)${NC} 🐛 Anti-patterns          ${DIM}(detectar problemas arquiteturais)${NC}" >&2
  echo -e "  ${CYAN}4)${NC} 🤖 Gerar .agent/          ${DIM}(framework de agentes Enterprise-Grade)${NC}" >&2
  echo -e "  ${CYAN}5)${NC} 🔧 Plano de refatoração   ${DIM}(steps + operations + score estimado)${NC}" >&2
  echo -e "  ${CYAN}6)${NC} 🗺️  Diagrama Mermaid       ${DIM}(grafo de dependências)${NC}" >&2
  echo -e "  ${CYAN}7)${NC} 🚀 TUDO                   ${DIM}(roda todas as análises acima)${NC}" >&2
  echo "" >&2
  read -rp "  Opção [1-7] (default: 1): " choice </dev/tty
  echo "${choice:-1}"
}

# ── Validações ──

check_prerequisites() {
  print_step "Verificando pré-requisitos..."

  # Node.js
  if ! command -v node &>/dev/null; then
    print_error "Node.js não encontrado. Instale: https://nodejs.org"
    exit 1
  fi
  local node_version
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt 18 ]; then
    print_error "Node.js >= 18 necessário. Atual: $(node -v)"
    exit 1
  fi
  print_success "Node.js $(node -v)"

  # Dependencies installed?
  if [ ! -d "${SCRIPT_DIR}/node_modules" ]; then
    print_warn "Dependências não instaladas. Instalando agora..."
    (cd "$SCRIPT_DIR" && npm install --silent)
    if [ $? -ne 0 ]; then
      print_error "Falha ao instalar dependências. Rode: cd $SCRIPT_DIR && npm install"
      exit 1
    fi
    print_success "Dependências instaladas"
  fi

  # Architect built?
  print_info "Garantindo que a versão mais recente está compilada..."
  (cd "$SCRIPT_DIR" && npm run build)
  if [ ! -f "$ARCHITECT_BIN" ]; then
    print_error "Falha ao compilar. Rode: cd $SCRIPT_DIR && npm run build"
    exit 1
  fi
  print_success "Architect buildado/atualizado"

  # Register CLI globally (npm link) if 'architect' not in PATH
  if ! command -v architect &>/dev/null; then
    print_warn "Comando 'architect' não encontrado no PATH. Registrando via npm link..."
    (cd "$SCRIPT_DIR" && npm link --silent 2>/dev/null) || true
    if command -v architect &>/dev/null; then
      print_success "Comando 'architect' disponível globalmente"
    else
      print_info "npm link falhou (talvez precise de sudo). Use: npx architect ou ./architect-run.sh"
    fi
  else
    print_success "Comando 'architect' disponível"
  fi
}

# ── Execução das Análises ──

run_analyze() {
  local project="$1"
  local output_dir="$2"
  local project_name
  project_name=$(basename "$project")

  print_step "Executando análise completa de ${BOLD}${project_name}${NC}..."
  node "$ARCHITECT_BIN" analyze "$project" \
    --format html \
    --output "${output_dir}/architect-report-${project_name}.html"
  print_success "Report HTML: ${output_dir}/architect-report-${project_name}.html"
}

run_score() {
  local project="$1"
  local output_dir="$2"
  local project_name
  project_name=$(basename "$project")

  print_step "Calculando score de ${BOLD}${project_name}${NC}..."
  node "$ARCHITECT_BIN" score "$project" --format json \
    > "${output_dir}/architect-score-${project_name}.json"

  # Print inline score
  local score
  score=$(node -e "const s = require('${output_dir}/architect-score-${project_name}.json'); console.log(s.overall + '/100 — M:' + s.breakdown.modularity + ' C:' + s.breakdown.coupling + ' Co:' + s.breakdown.cohesion + ' L:' + s.breakdown.layering)" 2>/dev/null || echo "ver JSON")
  print_success "Score: ${score}"
}

run_anti_patterns() {
  local project="$1"
  local output_dir="$2"
  local project_name
  project_name=$(basename "$project")

  print_step "Detectando anti-patterns em ${BOLD}${project_name}${NC}..."
  node "$ARCHITECT_BIN" anti-patterns "$project" --format json \
    > "${output_dir}/architect-antipatterns-${project_name}.json"

  local count
  count=$(node -e "const d = require('${output_dir}/architect-antipatterns-${project_name}.json'); console.log(d.length)" 2>/dev/null || echo "?")
  print_success "Anti-patterns encontrados: ${count}"
}

run_agents() {
  local project="$1"
  local output_dir="$2"
  local project_name
  project_name=$(basename "$project")

  print_step "Gerando framework de agentes (.agent/) para ${BOLD}${project_name}${NC}..."

  # Generate agents in the project directory (standard location)
  node "$ARCHITECT_BIN" agents "$project"

  # Also copy to output dir if different
  if [ -d "${project}/.agent" ] && [ "$project" != "$output_dir" ]; then
    cp -r "${project}/.agent" "${output_dir}/.agent-${project_name}" 2>/dev/null || true
    print_success ".agent/ gerado no projeto E copiado para output"
  else
    print_success ".agent/ gerado no projeto"
  fi
}

run_refactor() {
  local project="$1"
  local output_dir="$2"
  local project_name
  project_name=$(basename "$project")

  print_step "Gerando plano de refatoração para ${BOLD}${project_name}${NC}..."
  node "$ARCHITECT_BIN" refactor "$project" \
    --output "${output_dir}/architect-refactor-${project_name}.html"
  print_success "Refactor plan: ${output_dir}/architect-refactor-${project_name}.html"
}

run_diagram() {
  local project="$1"
  local output_dir="$2"
  local project_name
  project_name=$(basename "$project")

  print_step "Gerando diagrama Mermaid de ${BOLD}${project_name}${NC}..."
  node "$ARCHITECT_BIN" diagram "$project" \
    --output "${output_dir}/architect-diagram-${project_name}.mmd"
  print_success "Diagrama: ${output_dir}/architect-diagram-${project_name}.mmd"
}

# ── Open Results ──

open_results() {
  local output_dir="$1"

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "  ${BOLD}✅ Análise concluída!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${DIM}Resultados salvos em:${NC}"
  echo -e "  ${BOLD}${output_dir}${NC}"
  echo ""

  # List generated files
  echo -e "  ${DIM}Arquivos gerados:${NC}"
  for f in "${output_dir}"/architect-*; do
    [ -e "$f" ] && echo -e "  ${CYAN}📄${NC} $(basename "$f")"
  done
  if [ -d "${output_dir}/.agent"* ] 2>/dev/null; then
    echo -e "  ${CYAN}📁${NC} .agent/ (framework de agentes)"
  fi

  echo ""
  read -rp "  Abrir pasta de resultados? [S/n]: " open_choice </dev/tty
  open_choice="${open_choice:-S}"

  if [[ "$open_choice" =~ ^[Ss]$ ]]; then
    case "$OS" in
      macos)   open "$output_dir" ;;
      linux)   xdg-open "$output_dir" 2>/dev/null || true ;;
      windows) explorer.exe "$output_dir" 2>/dev/null || true ;;
    esac
  fi

  # Try to open HTML report
  local html_report
  html_report=$(find "$output_dir" -name "architect-report-*.html" -maxdepth 1 2>/dev/null | head -1)
  if [ -n "$html_report" ]; then
    read -rp "  Abrir report HTML no browser? [S/n]: " browser_choice </dev/tty
    browser_choice="${browser_choice:-S}"
    if [[ "$browser_choice" =~ ^[Ss]$ ]]; then
      case "$OS" in
        macos)   open "$html_report" ;;
        linux)   xdg-open "$html_report" 2>/dev/null || true ;;
        windows) start "$html_report" 2>/dev/null || true ;;
      esac
    fi
  fi
}

# ── Main ──

main() {
  print_banner
  check_prerequisites

  # ── Step 1: Select project ──
  print_step "Selecione o projeto para analisar"
  print_info "Uma janela do Finder/Explorer será aberta..."

  PROJECT_PATH=$(pick_folder "🏗️ Architect — Selecione o PROJETO para analisar" "$HOME")

  if [ -z "$PROJECT_PATH" ] || [ ! -d "$PROJECT_PATH" ]; then
    print_error "Nenhum projeto selecionado ou diretório inválido."
    exit 1
  fi
  print_success "Projeto: ${PROJECT_PATH}"

  # Quick validation — does it look like a code project?
  local file_count
  file_count=$(find "$PROJECT_PATH" -maxdepth 3 -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.dart" -o -name "*.go" -o -name "*.java" -o -name "*.rs" -o -name "*.rb" -o -name "*.php" -o -name "*.cs" \) 2>/dev/null | wc -l | tr -d ' ') || file_count=0
  if [ "$file_count" -eq 0 ]; then
    print_warn "Nenhum arquivo de código encontrado nas primeiras 3 camadas."
    read -rp "  Continuar mesmo assim? [s/N]: " continue_choice </dev/tty
    if [[ ! "$continue_choice" =~ ^[Ss]$ ]]; then
      echo "  Abortado."
      exit 0
    fi
  else
    print_info "Encontrados ${file_count} arquivos de código"
  fi

  # ── Step 2: Select output directory ──
  print_step "Selecione onde salvar os resultados"
  print_info "Uma janela do Finder/Explorer será aberta..."

  OUTPUT_PATH=$(pick_folder "🏗️ Architect — Selecione DESTINO dos resultados" "$HOME/Documents")

  if [ -z "$OUTPUT_PATH" ]; then
    # Default: create output dir next to project
    OUTPUT_PATH="${PROJECT_PATH}/architect-results"
    print_warn "Nenhum destino selecionado. Usando: ${OUTPUT_PATH}"
  fi

  # Create output dir if needed
  mkdir -p "$OUTPUT_PATH"
  print_success "Destino: ${OUTPUT_PATH}"

  # ── Step 3: Choose analysis ──
  CHOICE=$(show_analysis_menu)

  # ── Step 4: Execute ──
  local start_time
  start_time=$(date +%s)

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
  echo -e "  ${BOLD}🚀 Iniciando análise...${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

  case "$CHOICE" in
    1) run_analyze "$PROJECT_PATH" "$OUTPUT_PATH" ;;
    2) run_score "$PROJECT_PATH" "$OUTPUT_PATH" ;;
    3) run_anti_patterns "$PROJECT_PATH" "$OUTPUT_PATH" ;;
    4) run_agents "$PROJECT_PATH" "$OUTPUT_PATH" ;;
    5) run_refactor "$PROJECT_PATH" "$OUTPUT_PATH" ;;
    6) run_diagram "$PROJECT_PATH" "$OUTPUT_PATH" ;;
    7)
      run_analyze "$PROJECT_PATH" "$OUTPUT_PATH"
      run_refactor "$PROJECT_PATH" "$OUTPUT_PATH"
      run_agents "$PROJECT_PATH" "$OUTPUT_PATH"
      run_diagram "$PROJECT_PATH" "$OUTPUT_PATH"
      run_anti_patterns "$PROJECT_PATH" "$OUTPUT_PATH"
      run_score "$PROJECT_PATH" "$OUTPUT_PATH"
      ;;
    *)
      print_error "Opção inválida: $CHOICE"
      exit 1
      ;;
  esac

  local end_time
  end_time=$(date +%s)
  local elapsed=$((end_time - start_time))

  echo ""
  echo -e "  ${DIM}⏱️  Tempo total: ${elapsed}s${NC}"

  # ── Step 5: Open results ──
  open_results "$OUTPUT_PATH"

  echo ""
  echo -e "  ${DIM}Powered by @girardelli/architect v3.0${NC}"
  echo ""
}

# ── Run ──
main "$@"

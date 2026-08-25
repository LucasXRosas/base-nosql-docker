#!/usr/bin/env bash
#
# setup.sh — Instalação e configuração automatizada do ambiente Docker + NoSQL
#             para Ubuntu / Linux Mint / Debian
#
# Disciplina: Banco de Dados NoSQL — UTFPR Campus Guarapuava
# Professor:  Prof. Marcelo Vichar
#
# Uso:  chmod +x setup.sh && ./setup.sh
#
set -euo pipefail

# ──────────────────────────────────────────────────
# Cores para output
# ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC} $*"; }
log_error()   { echo -e "${RED}[ERRO]${NC}  $*"; }

# ──────────────────────────────────────────────────
# Verificação de privilégios
# ──────────────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
    log_error "Não execute este script diretamente com sudo (ex: sudo ./setup.sh)."
    log_error "Execute como seu usuário normal: ./setup.sh"
    log_error "O script solicitará a senha de sudo apenas quando necessário."
    exit 1
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   UTFPR — Banco de Dados NoSQL (Ambiente de Dev)         ║${NC}"
echo -e "${CYAN}║   Instalador e Configurador de Permissões Docker         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

log_info "Solicitando permissão de administrador para configuração..."
sudo -v || { log_error "Falha ao obter permissões sudo."; exit 1; }

# Manter sudo ativo em background
while true; do sudo -n true; sleep 50; kill -0 "$$" || exit; done 2>/dev/null &
SUDO_KEEPALIVE_PID=$!
trap 'kill $SUDO_KEEPALIVE_PID 2>/dev/null' EXIT

# ──────────────────────────────────────────────────
# 1. Detectar distribuição
# ──────────────────────────────────────────────────
log_info "Detectando distribuição Linux..."

if [[ ! -f /etc/os-release ]]; then
    log_error "Arquivo /etc/os-release não encontrado. Distribuição não suportada."
    exit 1
fi

# shellcheck source=/dev/null
source /etc/os-release
CODENAME="${UBUNTU_CODENAME:-$VERSION_CODENAME}"

if [[ -z "$CODENAME" ]]; then
    CODENAME="jammy" # fallback seguro para Ubuntu 22.04 LTS
fi

log_ok "Distribuição: $PRETTY_NAME ($CODENAME)"
ARCH="$(dpkg --print-architecture)"
log_ok "Arquitetura: $ARCH"

# ──────────────────────────────────────────────────
# 2. Configurar limites do Kernel para Elasticsearch
# ──────────────────────────────────────────────────
log_info "Configurando vm.max_map_count (necessário para o Elasticsearch)..."
CURRENT_MAP_COUNT=$(sysctl -n vm.max_map_count 2>/dev/null || echo "0")
if [[ "$CURRENT_MAP_COUNT" -lt 262144 ]]; then
    sudo sysctl -w vm.max_map_count=262144 >/dev/null
    echo "vm.max_map_count=262144" | sudo tee /etc/sysctl.d/99-elasticsearch.conf >/dev/null
    log_ok "vm.max_map_count configurado para 262144."
else
    log_ok "vm.max_map_count já está adequado ($CURRENT_MAP_COUNT)."
fi

# ──────────────────────────────────────────────────
# 3. Remover versões antigas / conflitantes
# ──────────────────────────────────────────────────
log_info "Verificando pacotes conflitantes..."
CONFLICTING=(docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc)
for pkg in "${CONFLICTING[@]}"; do
    if dpkg -l "$pkg" &>/dev/null; then
        log_warn "Removendo pacote conflitante: $pkg"
        sudo apt-get remove -y -qq "$pkg" &>/dev/null || true
    fi
done

# ──────────────────────────────────────────────────
# 4. Instalar dependências e Chave GPG do Docker
# ──────────────────────────────────────────────────
log_info "Atualizando repositórios e instalando dependências base..."
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release jq >/dev/null

sudo install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
fi

echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

# ──────────────────────────────────────────────────
# 5. Instalar Docker Engine + Docker Compose v2
# ──────────────────────────────────────────────────
log_info "Instalando Docker Engine e Docker Compose v2..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin >/dev/null
log_ok "Docker Engine e plugins instalados com sucesso."

# ──────────────────────────────────────────────────
# 6. CONFIGURAÇÃO DEFINITIVA DO DOCKER SEM SUDO
# ──────────────────────────────────────────────────
log_info "Configurando permissões do Docker para o usuário '$USER'..."

# Criar grupo docker se não existir
if ! getent group docker >/dev/null; then
    sudo groupadd docker
    log_ok "Grupo 'docker' criado."
fi

# Adicionar usuário atual ao grupo docker
if ! id -nG "$USER" | grep -qw docker; then
    sudo usermod -aG docker "$USER"
    log_ok "Usuário '$USER' adicionado ao grupo 'docker'."
fi

# Ajustar permissões do socket do Docker e ~/.docker
if [[ -S /var/run/docker.sock ]]; then
    sudo chown root:docker /var/run/docker.sock
    sudo chmod 660 /var/run/docker.sock
fi

if [[ -d "$HOME/.docker" ]]; then
    sudo chown -R "$USER":"$USER" "$HOME/.docker"
    sudo chmod -R g+rwx "$HOME/.docker"
fi

# Habilitar e iniciar serviço
sudo systemctl enable docker.service >/dev/null 2>&1
sudo systemctl enable containerd.service >/dev/null 2>&1
sudo systemctl start docker >/dev/null 2>&1
log_ok "Serviço Docker ativo e habilitado no boot."

# ──────────────────────────────────────────────────
# 7. Verificação Final
# ──────────────────────────────────────────────────
DOCKER_VER=$(docker --version 2>/dev/null || echo "OK")
COMPOSE_VER=$(docker compose version 2>/dev/null || echo "OK")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           INSTALAÇÃO E CONFIGURAÇÃO CONCLUÍDA!           ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "║  ${BOLD}Docker:${NC}  $DOCKER_VER"
echo -e "║  ${BOLD}Compose:${NC} $COMPOSE_VER"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "║  ${BOLD}COMO RODAR SEM SUDO:${NC}                                  ║"
echo -e "║  1. No terminal atual, o grupo 'docker' foi ativado.     ║"
echo -e "║  2. Se abrir um NOVO terminal e der 'permission denied', ║"
echo -e "║     basta rodar: ${CYAN}newgrp docker${NC} ou deslogar/logar.       ║"
echo -e "║                                                          ║"
echo -e "║  ${BOLD}PARA SUBIR O AMBIENTE COMPLETO:${NC}                         ║"
echo -e "║     ${CYAN}./iniciar.sh${NC}                                         ║"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Entrar no grupo docker na sessão atual
exec sg docker -c "bash"

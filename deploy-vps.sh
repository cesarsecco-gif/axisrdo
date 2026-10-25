#!/usr/bin/env bash
# =============================================================
# AXIS RDO — Script de Implantação Automatizada na VPS Hostinger
# Axis Consultoria e Planejamento
# Repositório: https://github.com/cesarsecco-gif/axisrdo.git
# =============================================================

set -e

echo "========================================================="
echo "   AXIS RDO — Axis Consultoria e Planejamento"
echo "   Iniciando Implantação / Atualização na VPS Hostinger"
echo "========================================================="

# 1. Atualizar pacotes do sistema
echo "[1/6] Atualizando pacotes do sistema operacional..."
sudo apt-get update -y

# 2. Instalar Docker e Docker Compose caso não existam
if ! command -v docker &> /dev/null; then
    echo "[2/6] Docker não encontrado. Instalando Docker Engine..."
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "Docker instalado com sucesso!"
else
    echo "[2/6] Docker já está instalado."
fi

# 3. Configurar Firewall UFW (SSH, HTTP, HTTPS)
echo "[3/6] Configurando regras de firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp || true
    sudo ufw allow 80/tcp || true
    sudo ufw allow 443/tcp || true
    sudo ufw --force enable || true
fi

# 4. Criar estrutura de diretórios necessária
echo "[4/6] Verificando diretórios de dados e SSL..."
mkdir -p data certbot/conf certbot/www

# 5. Criar .env de produção se não existir
if [ ! -f .env ]; then
    echo "Gerando chave secreta JWT para o ambiente de produção..."
    RANDOM_SECRET=$(openssl rand -hex 32)
    ADMIN_PASSWORD=$(openssl rand -hex 16)
    cat <<EOF > .env
PORT=3000
NODE_ENV=production
ALLOW_NETWORK=true
JWT_SECRET=${RANDOM_SECRET}
PLATFORM_ADMIN_EMAIL=admin@axisconsplan.com.br
PLATFORM_ADMIN_PASSWORD=${ADMIN_PASSWORD}
DATABASE_URL="file:/app/data/axis_rdo.db"
AXIS_DATA_DIR="/app/data"
EOF
    echo "Arquivo .env criado com sucesso."
    echo "Senha inicial do administrador da plataforma: ${ADMIN_PASSWORD}"
    echo "Guarde esta senha em local seguro; ela não será exibida novamente."
fi

# Completar configurações seguras em instalações anteriores.
if ! grep -q '^JWT_SECRET=' .env; then
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
fi
if ! grep -q '^PLATFORM_ADMIN_EMAIL=' .env; then
    echo "PLATFORM_ADMIN_EMAIL=admin@axisconsplan.com.br" >> .env
fi
if ! grep -q '^PLATFORM_ADMIN_PASSWORD=' .env; then
    ADMIN_PASSWORD=$(openssl rand -hex 16)
    echo "PLATFORM_ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> .env
    echo "Senha inicial do administrador da plataforma: ${ADMIN_PASSWORD}"
    echo "Guarde esta senha em local seguro; ela não será exibida novamente."
fi

# 6. Compilar e subir os contêineres Docker
echo "[5/6] Construindo imagens e iniciando contêineres..."
docker compose pull || true
docker compose up -d --build --remove-orphans

echo "[6/6] Verificando status dos serviços..."
docker compose ps

echo ""
echo "========================================================="
echo "   ✅ AXIS RDO implantado com sucesso na VPS Hostinger!"
echo "   Acesse pelo IP do seu servidor: http://$(curl -s ifconfig.me)"
echo "========================================================="
echo ""
echo "Para ativar SSL gratuito (HTTPS) com seu domínio próprio:"
echo "sudo docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot -d seudominio.com.br"
echo ""

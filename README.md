# AXIS RDO
> **Plataforma SaaS Multi-tenant de Gestão de Diários de Obra e Relatórios Fotográficos de Engenharia**  
> Desenvolvido por **Axis Consultoria e Planejamento**  
> Repositório: [github.com/cesarsecco-gif/axisrdo](https://github.com/cesarsecco-gif/axisrdo)

---

## 🏗️ Visão Geral
O **AXIS RDO** é uma solução completa para gestão de obras, rodovias e projetos de infraestrutura civil, permitindo:
- **Multi-tenant Real:** Isolamento seguro de dados para cada construtora, consultoria ou perito;
- **Controle de Acesso Baseado em Perfis (RBAC):**
  - **Administrador:** Gestão de planos, faturamento, assentos de usuários e exclusão de obras.
  - **Gestor / Engenheiro de Obra:** Criação de obras, finalização de RDOs e gerenciamento de equipes.
  - **Técnico de Campo:** Apontamentos diários, envio de fotos georreferenciadas e conferência.
  - **Fiscal / Leitor:** Visualização e download de relatórios executivos.
- **Planos e Monetização:**
  - **Plano Individual:** 1 usuário, até 3 obras simultâneas, 5 GB de armazenamento.
  - **Plano Corporativo:** 10 usuários inclusos (+ assentos adicionais), obras ilimitadas, 100 GB em nuvem.
  - Checkout integrado com **PIX automático**, Cartão de Crédito e Webhooks (Asaas / Mercado Pago).
- **Relatórios Técnicos:** Exportação em PDF executivo de alta fidelidade e planilhas analíticas consolidadas (.xlsx).

---

## 🚀 Stack Tecnológica
- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons
- **Backend:** Node.js 20, Express, Prisma ORM, JWT, Bcrypt
- **Banco de Dados:** SQLite (desenvolvimento) / PostgreSQL (produção VPS)
- **Infraestrutura:** Docker, Docker Compose, Nginx Reverse Proxy com SSL Let's Encrypt
- **Processamento:** Tesseract.js (OCR), jsPDF, fflate, @napi-rs/canvas

---

## 💻 Como Rodar Localmente

### 1. Pré-requisitos
- Node.js 20+ instalado
- Git

### 2. Passo a Passo
```bash
# Entrar no diretório do código-fonte
cd codigo-fonte

# Instalar dependências
npm install

# Inicializar o banco de dados local com Prisma
npx prisma db push

# Iniciar servidor de desenvolvimento (frontend Vite + backend Express)
npm run dev
```

Acesse a aplicação no navegador em: `http://localhost:3000`

---

## 🌐 Como Subir para a VPS Hostinger (Deploy Rápido)

A infraestrutura do **AXIS RDO** está 100% pronta para a VPS Hostinger utilizando Docker.

### 1. Conecte-se via SSH na sua VPS Hostinger:
```bash
ssh root@SEU_IP_DA_VPS
```

### 2. Clone o repositório oficial do GitHub:
```bash
git clone https://github.com/cesarsecco-gif/axisrdo.git
cd axisrdo
```

### 3. Execute o script de implantação automatizada:
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

O script cuidará de:
1. Instalar o Docker e Docker Compose automaticamente (se ainda não existirem);
2. Configurar o firewall UFW para liberar as portas 22 (SSH), 80 (HTTP) e 443 (HTTPS);
3. Gerar chaves criptográficas seguras de sessão;
4. Compilar e subir os contêineres da aplicação e do Nginx;
5. Disponibilizar o sistema online no IP da sua VPS!

### 4. Configurar Domínio Próprio e Certificado SSL Gratuito (HTTPS)
Após apontar o seu domínio (ex: `app.axisconsultoria.com.br`) para o IP da VPS no seu painel DNS:
```bash
sudo docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot -d seudominio.com.br
```

---

## 🔒 Propriedade Intelectual
Propriedade exclusiva de **Axis Consultoria e Planejamento**.  
Todos os direitos reservados.

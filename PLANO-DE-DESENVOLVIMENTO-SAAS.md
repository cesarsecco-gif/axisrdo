# PLANO DE DESENVOLVIMENTO — AXIS RDO (SaaS)
> **De Sistema Desktop a Plataforma Web Comercial Multi-tenant**  
> **Proprietária:** Axis Consultoria e Planejamento  
> **Repositório:** [github.com/cesarsecco-gif/axisrdo](https://github.com/cesarsecco-gif/axisrdo)  
> **Infraestrutura de Destino:** VPS Hostinger (Linux / Docker)

---

## 1. Visão do Produto e Modelo de Negócio

O **AXIS RDO** é uma plataforma moderna em modelo **SaaS (Software as a Service)** voltada à construção civil, supervisão rodoviária e obras de infraestrutura.

### Modelo Comercial:
* **Plano Individual (Autônomos / Peritos):**
  * 1 usuário (assento único);
  * Gestão de até 3 obras simultâneas;
  * Armazenamento de até 5 GB de fotos;
  * Emissão de RDOs e Relatórios Fotográficos com logotipo do cliente.
* **Plano Corporativo (Construtoras / Supervisoras / Consultorias):**
  * Pacote base (ex: 3 a 5 usuários inclusos) + valor adicional por assento extra;
  * Obras e contratos ilimitados;
  * Armazenamento expansível (50 GB a 500 GB+);
  * Gestão de níveis de acesso por colaborador e frentes de serviço;
  * Pacote analítico consolidado e exportação de dados em lote.

---

## 2. Mapa Geral de Evolução

```
┌─────────────────────────────────┐
│ FASE 1: Rebranding & Git        │ ──► [CONCLUÍDA ✅]
│ Identidade Axis, .gitignore     │
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ FASE 2: Arquitetura & Banco     │ ──► [CONCLUÍDA ✅]
│ Prisma ORM, Multi-tenant,       │
│ SQLite/PostgreSQL e Isolamento  │
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ FASE 3: Autenticação & RBAC     │ ──► [CONCLUÍDA ✅]
│ Login, JWT, Níveis de Acesso e  │
│ Gestão de Equipe / Assentos     │
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ FASE 4: Planos & Monetização    │ ──► [CONCLUÍDA ✅]
│ Planos Indiv./Corp., Assinatura │
│ Checkout PIX e Webhooks         │
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ FASE 5: VPS Hostinger & DevOps  │ ──► [CONCLUÍDA ✅]
│ Dockerfile, Compose, Nginx SSL  │
│ Script deploy-vps.sh            │
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ FASE 6: Mobile PWA & Lançamento │ ──► [PRÓXIMA ETAPA 🚀]
│ Uso offline no canteiro de obra │
└─────────────────────────────────┘
```

---

## 3. Detalhamento das Fases

### Fase 1: Identidade Visual e Repositório (Concluída ✅)
* [x] Parametrização da marca **AXIS RDO** da **Axis Consultoria e Planejamento**.
* [x] Criação do componente vetorial oficial `AxisLogo.tsx`.
* [x] Atualização de títulos, metadados (`index.html`) e navegação do sistema.
* [x] Filtro de binários do Windows e dados locais via `.gitignore`.
* [x] Inicialização do repositório Git e primeiro push na branch `main`.

---

### Fase 2: Arquitetura Multi-Tenant e Banco de Dados Relacional
> **Objetivo:** Permitir que centenas de empresas e engenheiros usem o sistema simultaneamente sem conflito de dados ou estouro de memória.

1. **Eliminação do Workspace Singleton:**
   - Desacoplar a variável global `workspace` em memória no backend.
   - Toda rota da API passará a receber o contexto de quem está operando: `/api/tenants/:tenantId/obras/:obraId`.
2. **Implantação do Banco de Dados (PostgreSQL + Prisma ORM):**
   - **Tabela `Tenants` (Empresas Clientes):** Razão social, CNPJ, plano contratado, status da assinatura, limites.
   - **Tabela `Users` (Usuários):** Nome, e-mail, senha criptografada, tenantId, cargo/papel.
   - **Tabela `Obras`:** Contrato, rodovia, trecho, empresa contratada, configurações visuais e logo.
   - **Tabela `RDOs`:** Número, data, clima, efetivo, preposto, serviços do dia e assinaturas.
   - **Tabela `Fotos`:** Metadados, latitude/longitude, estaca, lado, caminho do arquivo no disco/S3 (desacoplando o Base64 do banco).
3. **Serviço de Armazenamento de Arquivos:**
   - Substituir requisições JSON de 500 MB por upload Multipart via streaming.
   - Arquivos organizados no disco do VPS por tenant (`/var/axis/storage/{tenantId}/{obraId}/...`) com suporte futuro a buckets S3/Cloudflare R2.

---

### Fase 3: Autenticação, Níveis de Acesso (RBAC) e Equipes
> **Objetivo:** Proteger os dados das empresas e controlar quem pode visualizar, editar ou aprovar diários de obras.

1. **Segurança e Sessões:**
   - Autenticação via JWT (JSON Web Tokens) armazenados em cookies seguros `HttpOnly` e `SameSite`.
   - Criptografia com algoritmo Argon2 ou Bcrypt.
   - Fluxo de recuperação de senha por e-mail transacional.
2. **Níveis de Acesso (RBAC):**
   - **Administrador da Empresa (Owner):** Gerencia faturamento, planos, convida/remove membros e cria obras.
   - **Engenheiro / Gestor de Obra:** Cria, preenche e finaliza RDOs, cadastra equipes e edita catálogos.
   - **Apontador de Campo / Técnico:** Envia fotos com coordenadas e preenche os rascunhos de serviços do dia.
   - **Fiscal / Cliente Externo (Leitor):** Acesso somente leitura para download de relatórios e conferência.
3. **Controle de Assentos:**
   - Painel para o Administrador da conta convidar membros por e-mail com trava automática ao atingir o limite do plano.

---

### Fase 4: Monetização, Planos e Pagamentos Automatizados
> **Objetivo:** Cobrança automatizada e gestão de assinaturas para venda de planos individuais e corporativos.

1. **Gateway de Pagamento Brasileiro (Asaas ou Mercado Pago):**
   - Cobrança recorrente via **PIX automático**, **Boleto bancário** e **Cartão de Crédito**.
   - Notificações de cobrança automatizadas por e-mail e WhatsApp.
2. **Webhooks e Gestão de Assinaturas:**
   - Ativação imediata da conta do cliente após a confirmação do pagamento.
   - Período de carência e bloqueio amigável de acesso em caso de inadimplência.
3. **Painel de Faturamento (Self-Service):**
   - Espaço para o cliente visualizar faturas, fazer upgrade de plano ou adicionar novos assentos de usuários.

---

### Fase 5: Infraestrutura, VPS Hostinger e DevOps
> **Objetivo:** Garantir alta disponibilidade, segurança SSL e deploy automatizado a cada atualização de código.

1. **Conteinerização com Docker:**
   - `Dockerfile` otimizado em multi-stage build (Node.js 20 Alpine).
   - `docker-compose.yml` orquestrando o App, o banco PostgreSQL e o Nginx.
2. **Servidor Web e Segurança (Nginx + Let's Encrypt):**
   - Emissão e renovação automática de certificados SSL gratuitos (HTTPS).
   - Configuração de `client_max_body_size 500M;` para tráfego seguro de imagens.
   - Firewall (UFW) bloqueando portas internas, liberando apenas HTTP (80) e HTTPS (443).
3. **CI/CD com GitHub Actions:**
   - Ao realizar `git push main`, a pipeline compila os testes e atualiza o VPS Hostinger via SSH sem interrupção de serviço.
4. **Rotina de Backups Off-site:**
   - Script diário com snapshot do PostgreSQL e fotos sincronizados para armazenamento em nuvem externa.

---

### Fase 6: Mobile PWA e Experiência em Campo
> **Objetivo:** Proporcionar agilidade no canteiro de obras e áreas rodoviárias sem internet estável.

1. **Progressive Web App (PWA):**
   - Ícone instalável no celular (Android e iOS) com aspecto de aplicativo nativo.
2. **Uso em Campo:**
   - Abertura direta da câmera do smartphone com captura de metadados GPS e carimbo em alta resolução.
   - Armazenamento em cache local no aparelho (IndexedDB) para posterior sincronização quando o aparelho reconectar ao sinal de rede.

---

## 4. Cronograma de Execução Estimado

| Etapa | Foco Principal | Prazo Estimado |
| :--- | :--- | :--- |
| **Fase 1** | White-labeling, Identidade Axis e Git | **Concluída ✅** |
| **Fase 2** | Banco PostgreSQL, Fim do Singleton, Multi-tenant | 2 a 3 semanas |
| **Fase 3** | Login, Níveis de Acesso (RBAC), Convite de Equipe | 1 a 2 semanas |
| **Fase 4** | Planos comerciais, Gateway de Pagamento e Assentos | 1 a 2 semanas |
| **Fase 5** | VPS Hostinger, Docker, Nginx, SSL e CI/CD | 1 semana |
| **Fase 6** | PWA Mobile, Modo Offline e Homologação | 1 a 2 semanas |

---

## 5. Próxima Ação Imediata
Iniciar a **Fase 2**:
* Configuração do ORM (Prisma) e modelagem das entidades de Banco de Dados (`Tenant`, `User`, `Obra`, `RdoDay`, `Photo`).

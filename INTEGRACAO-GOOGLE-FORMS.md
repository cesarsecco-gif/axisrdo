# Ideias de Integração com Google Forms e Google Drive

Este documento registra as possibilidades de integração do sistema local de Relatório Fotográfico RDO com formulários em nuvem (Google Forms) para recebimento de fotos em campo.

Como o aplicativo atualmente trabalha lendo arquivos de uma pasta local no computador (de forma offline), existem duas abordagens principais para realizar essa integração:

## 1. Sincronização via Google Drive Desktop (Mais Simples / Sem alterar código)

Como o aplicativo foi desenhado para ler fotos diretamente de pastas no Windows, a forma mais rápida de integrar é usando o aplicativo oficial do Google Drive para computador.

* **Como funciona:** Você cria um **Google Forms** com um campo de upload de arquivos. Todas as fotos enviadas pelo formulário caem automaticamente em uma pasta no seu Google Drive.
* **Configuração:** Você instala o [Google Drive para Desktop](https://www.google.com/drive/download/) no seu computador e configura para espelhar essa pasta específica de respostas. Em seguida, basta apontar a "pasta principal" no sistema RDO para essa pasta sincronizada no seu computador.
* **Resultado:** Sempre que alguém enviar uma foto pelo Forms em campo, ela baixa automaticamente no seu computador pelo Google Drive. O sistema RDO reconhece a foto instantaneamente, mantendo o funcionamento "offline" e sem precisar alterar o código do sistema.

## 2. Integração Direta via Código (Google Drive API)

Se a ideia for que o usuário clique em um botão dentro do sistema RDO para "Baixar novas fotos da Nuvem", é possível adicionar essa funcionalidade programaticamente.

* **Como funciona:** Seria integrada a **Google Drive API** no código backend (Node.js) do servidor local.
* **Fluxo:** O sistema teria uma tela onde você vincula sua conta do Google. Com um clique, a aplicação se conecta ao Google Drive, verifica a pasta de respostas do Google Forms, baixa as fotos novas, organiza nas subpastas por dia localmente e atualiza o `projeto.json`.
* **Vantagem:** Fica tudo centralizado na interface do sistema, sem depender do aplicativo do Google Drive rodando em segundo plano no Windows. Requer tempo de desenvolvimento para implementar a autenticação (OAuth2) e o download de arquivos via API.

## 3. Automação com Google Apps Script / Webhooks (Apenas para nuvem)

Outra via seria criar um script lá no Google Forms (usando Apps Script) que avisa sua aplicação assim que uma foto nova chega via `HTTP POST`.
* **Ressalva:** Como a aplicação roda de forma local no seu computador (`localhost`), essa abordagem exigiria que o seu computador estivesse constantemente ligado e exposto à internet (via serviços como Ngrok) ou que a aplicação fosse migrada para uma hospedagem em nuvem (servidor web). Esta opção altera fundamentalmente a natureza "offline local" do aplicativo.

---
*Conversa salva para referência futura em implementações ou ajustes de fluxo de trabalho.*

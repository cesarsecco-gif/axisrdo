RDO v1.6.0 — filtro por intervalo e exportação PDF/XLSX

NOVIDADES v1.6.0
- Filtro por intervalo de datas.
- Botões de RDO identificam data, número e página X/Y.
- Exportação PDF/XLSX por mês, período ou página.
- XLSX com abas RDO, Serviços e Fotos.

RELATORIO FOTOGRAFICO DER/PR — VERSAO 1.5.0

ATUALIZAR E ABRIR
1. Aguarde Salvo neste PC na versao anterior e exporte um backup.
2. Feche a janela do app e a janela de comandos anterior.
3. Extraia todo o ZIP em uma nova pasta e execute INICIAR.cmd.
4. Confira v1.4.1 no topo. O app le a pasta de trabalho ja configurada.
Requer Windows 10/11 x64 e navegador atualizado. Node e os modelos OCR
estao incluidos. Nao precisa de login, chave de IA ou internet.
Mantenha a janela de comandos aberta durante o uso.


OCR AUTOMATICO DA DESCRICAO DA ESTAMPA
Ao importar fotos do NoteCam/GPS Map Camera, o aplicativo lê automaticamente a
regiao inferior direita da imagem, onde normalmente ficam data, hora, coordenadas,
rumo, descricao e numero de indice. O OCR identifica a linha mais provavel de ser
a descricao do servico e preenche o campo "Descricao do Servico (Padrao DER/PR)".
Exemplo: a estampa "LIMPEZA CANALETA" preenche automaticamente esse campo.
A leitura e local/offline, nao altera a foto original e continua permitindo edicao
manual. Se nao houver uma descricao legivel, o texto padrao permanece para revisao.

RDO EM LOTE POR PASTA
Na aba RDO, selecione a pasta e clique Gerar todos os RDOs da pasta.
Defina valores iniciais comuns (ou deixe em branco para preencher depois)
e clique Criar rascunhos da pasta. Cada data com fotos marcadas gera um RDO.
A opcao de incluir dias sem fotos abrange o intervalo entre a primeira e
a ultima data marcada da pasta; os motivos devem ser conferidos por dia.
Os registros ja existentes sao preservados, sem duplicacao ou alteracao
das correcoes manuais. A tela informa quais datas ja existiam.
Novos RDOs em lote usam somente fotos marcadas da pasta escolhida.
RDOs individuais antigos mantem o vinculo original por data do projeto,
conforme a origem mostrada na tela. Continua havendo um RDO por data.
Clique em cada dia para corrigir os dados e finalizar apos a conferencia.
Baixar PDFs da pasta (ZIP) baixa todos os RDOs relacionados de uma vez.
Rascunhos seguem identificados como rascunhos no arquivo e no PDF.
Espere Salvo neste PC antes de encerrar. A interface no Windows deve ser
conferida no computador de destino; compilacao e testes do lote passaram.
Teste para desenvolvimento: node --import tsx test-rdo-lote.mjs

NOVO MODULO RDO
1. Abra a aba 4. RDO - Diario de obras.
2. Entre em Configuracoes do RDO e confira empresa, contrato, supervisora,
   preposto e os responsaveis. Os valores iniciais vieram da planilha modelo.
   As observacoes da supervisora e do fiscal tambem vem destas configuracoes.
3. Escolha uma data (pode usar a lista de datas com fotos marcadas) e clique
   em Criar RDO desta data. E permitido criar dias sem fotos.
4. Selecione clima, quantidade de profissionais, suficiencia da equipe
   e presenca do preposto. O dia da semana e marcado automaticamente.
5. Preencha Observacoes da contratada com servicos adicionais, observacoes
   ou o motivo do dia sem fotos.
6. Confira os servicos vinculados. Eles vem das fotos marcadas, em ordem
   cronologica, com texto em maiusculas e sem descricoes repetidas.
   Para corrigir um servico, edite a descricao da foto em Gerenciar fotos.
7. Use Visualizar folha / PDF para conferir o documento. Finalizar RDO
   verifica os campos e o encaixe no modelo antes de mudar o estado.
8. Clique Baixar PDF do RDO. O PDF do RDO e separado do relatorio fotografico.

NUMERACAO, ATUALIZACAO E CONTINUACAO
Um RDO por data do projeto. Numeracao inicia em 1 e segue a ordem de criacao.
Continuacoes mantem o numero e indicam Pagina 1 de 2, Pagina 2 de 2 etc.
A primeira pagina tem os 19 espacos para servicos do modelo. Descricoes
longas ocupam mais linhas, mantendo o tamanho de letra. As demais paginas
de servicos repetem o cabecalho e apresentam o texto restante. Observacoes
extensas recebem paginas proprias de continuacao, sem cortes.
Mudancas nas fotos vinculadas ou nas configuracoes atualizam o RDO. Se
afetarem um RDO finalizado, ele volta a Rascunho para conferencia. Tambem
ha Reabrir para correcoes. PDFs ja baixados devem ser gerados novamente.
Os nomes dos responsaveis sao automaticos; assinaturas ficam para depois.
O campo Codigo do clima permanece em branco como no modelo enviado.
Dias sem fotos exigem justificativa nas observacoes antes de finalizar.

PDF E DADOS LOCAIS
O PDF e gerado pelo proprio aplicativo, sem Excel instalado ou internet.
Se a previa nao abrir no navegador, use Baixar PDF para conferir o arquivo
no leitor do Windows. O arquivo e separado do PDF fotografico existente.
Os RDOs e suas configuracoes integram projeto.json e os backups do projeto.
Aguarde Salvo neste PC antes de fechar. Os testes automatizados e a revisao
visual dos PDFs passaram; a interacao no Windows precisa ser conferida
no computador de destino.
Para desenvolvedores: node --import tsx test-rdo.mjs, dentro de codigo-fonte.

TAGS
Em Gerenciar Fotos, clique na tag ou em + Tags no cartao ou na tabela.
Selecione tags salvas, crie uma descricao em Adicionar ou use o lapis
para editar o nome nesta foto. Use x para remover a tag da foto.
Clique em Salvar tags. As descricoes ficam no catalogo do projeto para
reutilizacao. Editar uma tag nesta foto nao altera outras fotos; o nome
anterior continua no catalogo. Limite: 32 tags por foto, 64 caracteres por tag.
Todas as tags e Sem tags estao no filtro superior. A categoria anterior,
como Pavimentacao, aparece como tag inicial e pode ser removida ou editada.

SUBPASTAS POR DIA
Selecione a pasta principal e use Subpastas por dia da foto para abrir
os registros de uma data. Todos os dias volta a mostrar o conjunto.
No disco, as copias ficam dentro da pasta de trabalho, por exemplo:
fotos/09_SETEMBRO_2026/12/arquivo.png
O dia vem da DATA DO CADASTRO, nao da estampa recebida na imagem.
Ao editar Data e salvar, o arquivo e remanejado para o novo dia. A pasta
principal mensal permanece a escolhida; alterar o mes da data nao troca
automaticamente a pasta principal. Confira o periodo ao editar datas.
Datas antigas invalidas ficam em Sem-data ate serem corrigidas.
Pastas principais com nomes iguais recebem um sufixo para evitar mistura.
As copias antigas reconhecidas sao reorganizadas no primeiro salvamento.
A copia antiga so e removida apos gravar o projeto e conferir seu conteudo.
Arquivos alterados fora do app sao preservados, com aviso na tela.
Se um arquivo no novo destino foi modificado externamente, o app solicita
que ele seja preservado ou renomeado antes de tentar salvar novamente.

EXCLUSAO EM LOTE
Marque Excluir nas fotos ou use Selecionar todas as exibidas. Clique
Excluir selecionadas e confirme. Mudar filtros limpa a selecao.
Os registros saem do projeto/relatorio, mas as copias no disco permanecem.

BUSCA DA DESCRICAO DO SERVICO
Na importacao e na edicao da foto, ao digitar a Descricao do Servico o
app oferece ate 3 sugestoes com as descricoes ja cadastradas nas fotos do
projeto, comecando pelas mais recentes. Com o campo vazio aparecem as 3
ultimas descricoes usadas. A comparacao ignora acento, maiusculas e
espacos extras e a sugestao pode comecar em qualquer palavra do texto.
Clique na sugestao para preencher o campo com o texto completo.
MOVER FOTOS DE UMA PASTA PARA OUTRA
No Gerenciador de fotos, a barra "Selecao em lote" tem os botoes Mover
selecionadas e Mover todas as exibidas. Com uma pasta ja escolhida no
seletor "1. Escolher Pasta das Fotos...", o botao Mover toda a pasta leva
o grupo inteiro. Em cada foto existe o icone de mover e, na edicao, o
campo Pasta de destino da foto. O dialogo mostra as pastas com a
quantidade de fotos e permite criar uma nova pasta de destino ali mesmo.
Ao confirmar, os registros mudam de pasta e as copias em disco sao
realocadas para a nova pasta na proxima gravacao automatica, mantendo a
subpasta do dia da foto.
REORDENAR AS FOTOS A MAO
No Gerenciador de fotos, clique em Reordenar fotos (ao lado do botao de
ordem). Em modo de ordenacao cada foto mostra quatro botoes: subir,
descer, levar para o inicio e levar para o fim. O numero # do cartao e a
posicao da foto na sequencia. A ordem escolhida vale para as paginas do
relatorio fotografico, para o RDO e para a exportacao, e e gravada
automaticamente a cada clique. Fotos novas entram na posicao cronologica
sem quebrar a sequencia definida. Use Concluir para sair do modo; a
faixa Ordem manual ativa oferece Continuar ordenando e Restaurar ordem
cronologica, que descarta a ordem manual e volta a ordenar por data e
hora. Enquanto houver filtro ativo, as setas reordenam apenas as fotos
exibidas, mantendo as demais nas posicoes atuais.
RDO MOSTRANDO "DIA SEM FOTOS MARCADAS"
Cada RDO guarda a pasta de origem das fotos do dia. Se a pasta for
removida ou recriada (fotos movidas para outra pasta e antiga apagada),
o dia ficava apontando para uma pasta que nao existe mais e o RDO
aparecia vazio mesmo com fotos marcadas. Agora o app religa o dia a
pasta onde as fotos daquela data estao na hora, a lista de servicos
volta a aparecer e a correcao e gravada sozinha na proxima gravacao.
Se a data tiver fotos em mais de uma pasta, o dia fica sem vinculo e
considera todas as fotos da data (RDO individual da data).
EDITOR DE ESTAMPAS
Editar estampa permite adicionar faixa externa ou substituir uma area
selecionada. O OCR portugues funciona offline. Revise a leitura antes
de salvar. Na faixa, a foto e a estampa existente permanecem intactas.
Na substituicao, a area inteira e aproximada por interpolacao dos contornos;
isso pode apagar detalhes e NAO recupera o fundo original. Apenas a leitura
do texto usa IA. A copia editada comeca fora do relatorio para revisao.

SALVAMENTO, BACKUP E PDF
Aguarde Salvo neste PC antes de fechar o navegador e o terminal.
O arquivo principal continua sendo projeto.json na pasta escolhida.
Backups e diagnostico permite criar/restaurar copias e configurar retencao
e segundo destino. O backup automatico preserva o estado anterior ao primeiro
salvamento da sessao/dia; use Criar backup agora para copiar o estado atual.
Copias antes de remocoes e restauracoes sao preservadas. Monitore o espaco.
PDF oferece relatorio completo/pagina atual, qualidade, progresso e cancelar.
Se necessario, use Imprimir / Salvar PDF do navegador.
O limite de gravacao do projeto continua sendo 500 MB; PNGs editados e
originais incorporados podem aumentar bastante o tamanho.

VALIDACAO E CODIGO-FONTE
TypeScript, compilacao e testes de integracao aprovados. A interface,
dialogos nativos e PDF ainda precisam de homologacao no Windows de destino.
Para desenvolvimento: npm ci; npm run build:desktop.
Testes: node test-organizacao.mjs; node test-etapa-a.mjs;
node test-estampas.mjs. Executar dentro de codigo-fonte.


V1.7.0 - INTEGRAÇÃO RELATÓRIO FOTOGRÁFICO -> RDO
- Botões Gerar RDOs do relatório e Atualizar RDOs.
- Datas das fotos marcadas do relatório selecionado são convertidas em RDOs, preservando edições manuais.
- O servidor existente reabre RDOs finalizados afetados por alterações nas fotos/configurações.

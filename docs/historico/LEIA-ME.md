# Registro de decisões das entregas

Cada arquivo desta pasta é o diário técnico de uma entrega: o que foi decidido durante a execução, por quê, e o que custa se a decisão estiver errada.

| Arquivo | Entrega |
|---|---|
| `2026-10-05-obras-decisoes.md` | Versão 1.10.0 — gerenciamento de obras |
| `2026-10-06-equipe-planilha-decisoes.md` | Versão 1.11.0 — equipe técnica pelo Excel |
| `2026-10-06-catalogos-decisoes.md` | Versão 1.12.0 — catálogos dos campos repetitivos |

## Como ler

São anotações curtas, feitas durante o trabalho, em três formatos:

- **`Task N: complete`** — a tarefa terminou e os testes passaram.
- **`Ruling:`** — uma decisão tomada sem consultar o usuário, porque a especificação não respondia ou o plano estava errado. Traz o motivo e o custo se estiver errada. **São estas que importam numa retomada:** explicam por que o código não faz exatamente o que a especificação dizia.
- **`Final:`** — o que a revisão independente achou no fim e o que foi feito a respeito. `fixed` é correção aplicada com teste; `minor (deferred)` é algo que foi visto e deixado de lado de propósito.

O detalhe de cada entrega está no `RDO-V<versão>-ALTERAÇÕES.md` da pasta raiz; as decisões do usuário e as regras estão nas especificações em `docs/superpowers/specs/`.

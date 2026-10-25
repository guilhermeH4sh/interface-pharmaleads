# PharmaLeads

Escopo Supabase inicial aprovado em 24/10/2026: somente a tabela public.pharmaleads. O contrato canônico recebeu um aditivo; nenhuma migration multischema será aplicada a esse projeto nesta fase.

M02 inclui um importador local de cadastro por CSV. Prévia sem chave ou gravação: .\ops\windows\Import-Pharmaleads.ps1 -File 'C:\caminho\arquivo.csv' -Mode insert. Cabeçalho obrigatório: cnpj,nome,uf,cidade; opcionais: razao_social,bairro,endereco,cnae. O modo update aceita uma linha existente por CNPJ. Nenhum campo comercial é atualizado. A escrita real permanece bloqueada até a revisão da RLS da própria tabela; detalhes em docs/M02.md.

Nova versão construída por módulos: Python/FastAPI e React/TypeScript. O sistema legado foi removido localmente por autorização do usuário em 23/10/2026. Histórico Git preservado.

M00–M03 aceitos. M04 implementado para revisão do piloto: fontes/políticas em configuração JSON versionada, sem banco auxiliar; API somente leitura e importador protegido. 27 testes M04 e validação do wheel com HTTP real passaram. Aceite humano pendente; M05–M24 não iniciados. Hospedagem ainda não definida; sem coleta ou publicação operacionais. Detalhes em [M04](docs/M04.md).


## Executar a fundação M01

Requer Python 3.12, uv 0.9.6, Node 24 e npm. A partir da raiz, em PowerShell:

```powershell
.\ops\windows\Setup-M01.ps1
# Em terminais separados:
.\ops\windows\Start-Api.ps1
.\ops\windows\Start-Web.ps1
```

Web: http://127.0.0.1:5173. API: http://127.0.0.1:8000. `/health` retorna 200; `/ready` retorna 503 até as dependências reais de M02/M03 serem implementadas. Configuração por variáveis de processo `PHARMALEADS_*`; arquivos `.env` locais não são carregados automaticamente.

## Verificar

```powershell
npm.cmd --prefix apps/web exec -- playwright install chromium
.\ops\windows\Test-M01.ps1
```

## Estrutura e registros

- `packages/backend/src/pharmaleads`: pacote Python instalável.
- `apps/web`: aplicação React, lockfile npm e testes web próprios.
- `tests/unit`: testes Python isolados.
- `ops/windows`: instalação, execução e verificação.
- [M01](docs/M01.md): versões, comandos, evidências e limites.
- [M02](docs/M02.md): migrations Alembic, papéis, configuração de banco e limites de validação.
- [Progresso](docs/PROGRESSO.md), [contexto](docs/CONTEXTO.md), [decisões](docs/DECISOES.md) e [matriz](docs/MATRIZ_REQUISITOS.md).
- [Limpeza autorizada do legado](docs/LIMPEZA_LEGADO.md).
- [Contrato canônico](docs/referencia/PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md).

M02 exige ambiente segregado para demonstrar integração real. M03 depende de pedido específico e da conclusão das dependências. Não usar produção em testes nem enviar segredos no chat.

Para a alternativa PostgreSQL read-only com **somente** `public.pharmaleads`, consulte [M02](docs/M02.md). O comando `.\ops\windows\Test-Supabase-Connection.ps1` não foi executado com senha real; a integração inicial escolhida usa Data API.

O transporte inicial escolhido é a **Data API**. A FastAPI local respondeu `connected` em `/health/supabase` após `HEAD` à rota exclusiva de `public.pharmaleads`, sem retornar linhas. A rota não disponibiliza leads na FastAPI/web. As políticas RLS atuais precisam de correção antes do acesso operacional. Detalhes e limites em [M02](docs/M02.md).

# Limpeza local autorizada do legado

Data: 23/10/2026 (America/Sao_Paulo). Escopo: remover o sistema anterior e preservar M00/M01; não executar M02.

## Pedido, autorização e entrega

Usuário: "eu gostaria de ter começado o projeto do zero e que o sistema legado fosse apagado". Após lista concreta e confirmação solicitada para excluir o legado, preservar M00/M01/Git e usar a base local atual, respondeu "pode continuar". Decisão EX-04 substitui a preservação anterior do legado.

Entregue: árvore de aplicação contendo somente a fundação nova Python/FastAPI + React/TypeScript. Nenhum backend Node paralelo. README, AGENTS, exemplo de configuração e acompanhamento atualizados. O contrato canônico permanece intacto. Não houve reset, stash, commit, push, deploy ou alteração de banco.

## Removidos

- Diretórios: `server/`, `worker/`, `api/`, `src/`, `shared/`, `scraper/`, `supabase/`, `assets/`, `node_modules/` e `dist/` da raiz.
- Configurações/entradas da raiz: `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, `vercel.json`, `.dockerignore`, `.prettierrc.json`, `test-db.js`.
- Documentação antiga: `DOCUMENTACAO_TECNICA.md`, `docs/ARQUITETURA.md`, `docs/OPERACAO.md`.
- Testes antigos: `tests/api.test.ts`, `tests/contracts.test.ts`, `tests/database.test.ts`, `tests/ui.e2e.ts`.
- Referências de configuração antigas no `.env.example`; mantidas somente as variáveis M01 `PHARMALEADS_*`.

`script.js`, `styles.css` e outros arquivos do scraper já estavam excluídos antes da limpeza; não foram recriados. Configurações locais ignoradas `.env`/`.env.local` não foram lidas nem removidas; a aplicação M01 não as carrega. Caches de ferramentas permanecem ignorados. Não se afirma apagamento seguro de credenciais ou eliminação de cópias no histórico Git/caches.

## Preservados e documentos alterados

Código, testes, locks e scripts novos em `packages/backend/`, `apps/`, `ops/windows/`, `tests/unit/`, `pyproject.toml`, `uv.lock`, `.python-version` e CI. Comparação SHA-256 antes/depois da limpeza confirmou 27 arquivos de código/testes/configuração/scripts de M01 inalterados; locks não foram editados. O manifesto temporário está em `.tmp/cleanup-m01-hashes.json` (ignorado).

Documentos atualizados: `README.md`, `AGENTS.md`, `docs/CONTEXTO.md`, `docs/PROGRESSO.md`, `docs/DECISOES.md`, `docs/MATRIZ_REQUISITOS.md`, `docs/M01.md`, este registro e `.env.example`. Inventários e decisões de M00/M01 permanecem como histórico, com decisão de exclusão posterior explícita.

## Comandos e ambiente

Diretório raiz para inspeção, exclusão, documentos e Python:
`C:\Users\guilh\.gemini\antigravity-ide\scratch\centrus-pharmaleads`.

Inspeções reais: `git status --short`, `git diff --stat`, `git diff --name-only`, `git diff --cached --stat`, `rg --files`, buscas `rg -n` por referências ao legado, leitura de configurações não secretas e regra de sincronização. `git fetch origin` falhou inicialmente por permissão em `.git/FETCH_HEAD`; repetido com permissão ampliada, passou. `git rev-list --left-right --count HEAD...origin/main`: 0/0 após fetch. Working tree alterado, autorizado pelo usuário; não foi declarado limpo.

Exclusão em PowerShell: lista literal dos caminhos acima; cada alvo convertido a caminho absoluto com `[IO.Path]::GetFullPath`, validado dentro da raiz resolvida e recusado se reparse point na raiz do alvo. Somente então `Remove-Item -LiteralPath $candidatePath -Recurse -Force`. SHA-256 por `Get-FileHash` antes/depois. Nenhum comando legado executado.

Verificação Python executada na raiz:

```powershell
.\.venv\Scripts\python.exe -m ruff check packages/backend/src tests/unit
.\.venv\Scripts\python.exe -m ruff format --check packages/backend/src tests/unit
.\.venv\Scripts\python.exe -m mypy
.\.venv\Scripts\python.exe -m pytest tests/unit -q
```

Verificação web executada em `C:\Users\guilh\.gemini\antigravity-ide\scratch\centrus-pharmaleads\apps\web`, usando Node 24.22.1 do runtime `C:\Users\guilh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin` no PATH:

```powershell
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test --config playwright.cleanup.config.ts
```

O caminho npm usado na entrega original (`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`) não existe nesta sessão. Primeira tentativa falhou antes do lint; usada a CLI de cada dependência já instalada, sem alterar package.json/locks ou instalar pacotes. `Test-M01.ps1` não foi executado integralmente: requer npm no PATH.

Para E2E, configuração temporária `apps/web/playwright.cleanup.config.ts` importou a configuração original e substituiu somente `webServer.command` por `node node_modules/vite/bin/vite.js --host 127.0.0.1`. Mesmos testes, navegadores, porta e assertions; arquivo temporário removido após execução. Nenhum servidor preexistente foi reutilizado. A configuração permanente permanece intacta.

## Resultados reais e limites

- Ruff e formatação: passaram; mypy: 7 arquivos sem erros.
- pytest: 14 testes passaram. TestClient ficou sem resposta no sandbox e foi interrompido; repetição fora do sandbox passou em 0,96 s. Aviso de depreciação Starlette/httpx já conhecido.
- ESLint e TypeScript: passaram.
- Vitest: 2 testes passaram. Primeira execução foi interrompida enquanto terminava; repetição fora do sandbox passou.
- Build Vite: passou; JS 299,14 kB (95,43 kB gzip), CSS 9,84 kB (3,14 kB gzip).
- Playwright: tentativa restrita interrompida; repetição fora do sandbox passou, 2 cenários em 14,7 s (desktop/mobile). Cenários verificam navegação por teclado, recarga, ausência de overflow e ausência de requisições externas. Avisos NO_COLOR/FORCE_COLOR sem falha.
- Inspeção visual das capturas `apps/web/test-results/foundation-desktop.png` e `foundation-mobile.png`: conteúdo e cartões legíveis e adaptados. Na captura mobile o link de pular conteúdo está visível por foco de teclado; nenhuma alteração visual foi realizada nesta limpeza.

Capturas ficam em diretório ignorado. Não executados: CI remota/Linux, instalação limpa, banco/Auth/Storage, migrations, coleta, APIs externas, restore ou homologação comercial. Não há novos TCs de negócio executados. Não se criou teste para a exclusão; reusados os testes reais da fundação.

## Estados, segurança e próxima etapa

M00 aceito; M01 implementado e testado localmente, sem integração Supabase ou aceite humano registrado. M02–M24 não iniciados. G1/G2/G3 não submetidos. Políticas e contratos de módulos futuros continuam pendentes. Nenhum segredo lido, nenhum banco ou serviço externo acionado pelos testes, nenhuma API paga ativada. Git fetch foi a única operação remota, para inspeção da base.

Parar nesta limpeza. Próximo: aceite de M01 e pedido específico para M02; demonstração real de isolamento/migrations depende de ambiente Supabase segregado e decisão D-06, sem segredos no chat.

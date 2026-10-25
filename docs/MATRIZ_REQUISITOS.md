# Matriz de requisitos e trabalho

Fonte: contrato canônico v2.0, seções 1–16. IDs Mxx/UC/TC abaixo são os da v2.0. A correspondência dos 72 RFs e 37 RNFs v1.5, com conflitos de prioridade, está em [RECONCILIACAO_V15.md](RECONCILIACAO_V15.md); os cenários de teste v1.5 foram inventariados em namespace próprio e ainda exigem vínculo individual com evidências ao implementar cada módulo. Nenhuma funcionalidade legada é automaticamente aceita para a nova arquitetura.

## Módulos

| ID | Escopo | Dependência / gate | Estado / evidência |
|---|---|---|---|
| M00 | Contexto, inventário e governança | contrato e inventário | documentação entregue e aceita pelo usuário; evidências em PROGRESSO |
| M01 | Fundação e shell web | M00 aceito; pedido humano; base preservada após fetch | **aceito pelo usuário em 24/10/2026**; evidências em M01.md e PROGRESSO |
| M02 | Supabase e migrations isoladas | M01; D-06 e aditivo canônico limitam projeto a public.pharmaleads | **aceito pelo usuário em 24/10/2026**. Tabela resetada (0 linhas), `cnpj NOT NULL`, índices duplicados removidos, coluna `origem` adicionada. RLS corrigida: apenas `authenticated` e `service_role` com acesso. Probe `/health/supabase` integrado. Importador CSV local pronto com dry-run e trava de escrita. |
| M03 | Supabase Auth e RBAC/ABAC | M02; D-07 para matriz final | **aceito pelo usuário em 24/10/2026**. JWT Supabase validado (HS256, issuer, audience, exp). Papéis via `app_metadata.role` (user_metadata ignorado — TC-007). `GET /v1/me` entregue. RLS atualizada com `auth.uid()` e papel. 15 testes passando. D-07 aberta para M11. |
| M04 | Políticas de fonte e contratos | M02/M03 | piloto implementado; 27 testes M04 e smoke HTTP do wheel passaram; configuração de produção para Render validada; aceite humano da adaptação pendente |
| M05 | Receita, recorte e G1 | M04; D-01/D-02/D-06 para importação real | não iniciado na v2.0; sem evidência |
| M06 | Fila PostgreSQL e workers | M05 + G1; D-19 | não iniciado na v2.0; sem evidência |
| M07 | Descoberta de sites e validação | M04/M06; G1 e fontes autorizadas | não iniciado na v2.0; sem evidência |
| M08 | Scrapy institucional HTTP | M06/M07 | não iniciado na v2.0; sem evidência |
| M09 | Playwright seletivo | M08; proteção browser | não iniciado na v2.0; sem evidência |
| M10 | Consolidação, revisão e evidência | M04/M08; D-20 | não iniciado na v2.0; sem evidência |
| M11 | API CRM e histórico | M03/M10; D-07/D-17 | não iniciado na v2.0; sem evidência |
| M12 | Privacidade, supressão e exportação | M04/M06/M11; D-03/D-05 | não iniciado na v2.0; sem evidência |
| M13 | Dashboard comercial real | M11/M12 | não iniciado na v2.0; sem evidência |
| M14 | Coleta manual no dashboard e G2 | M06–M13; gera G2 | não iniciado na v2.0; sem evidência |
| M15 | Agendas automáticas (opcional após G2) | G2; seleção humana; M06 | não iniciado na v2.0; sem evidência |
| M16 | Farmácia Popular (opcional após G2) | G2; seleção humana; D-16 | não iniciado na v2.0; sem evidência |
| M17 | Redes/franquias (opcional após G2) | G2; seleção humana; D-16 | não iniciado na v2.0; sem evidência |
| M18 | Anvisa (opcional após G2) | G2; seleção humana; D-16 | não iniciado na v2.0; sem evidência |
| M19 | CSV/fornecedores licenciados (opcional após G2) | G2; seleção humana; D-16 | não iniciado na v2.0; sem evidência |
| M20 | OpenStreetMap (opcional após G2) | G2; seleção humana; D-16 | não iniciado na v2.0; sem evidência |
| M21 | Google Places separado (opcional após G2 e aprovação) | G2; aprovação D-04/D-14 | não iniciado na v2.0; sem evidência |
| M22 | Métricas e alertas | M14; extensões conforme ativadas; D-09 | não iniciado na v2.0; sem evidência |
| M23 | Operação sem Docker, segurança e backup | M14/M22; D-11/D-12; gera G3 | não iniciado na v2.0; sem evidência |
| M24 | Homologação, auditoria e piloto | M23 + G3; D-09/D-12 | não iniciado na v2.0; sem evidência |

## Casos de uso

Estado de todos: planejado; implementação/integração/aceite pendentes. Rastreio de módulos é plano técnico, não aceite.

| ID | Caso | Módulos |
|---|---|---|
| UC-01 | Importar recorte oficial com dry-run, validação e promoção. | M05 |
| UC-02 | Buscar/listar/filtrar estabelecimentos nacionalmente por UF, cidade, CNAE, situação e contato. | M11/M13 |
| UC-03 | Cadastrar domínio candidato, validar e revisar associação. | M07 |
| UC-04 | Executar/reprocessar/cancelar coleta manual com monitor real. | M06/M14 |
| UC-05 | Consolidar contatos com rastreabilidade, classificação e revisão. | M10 |
| UC-06 | Distribuir leads e registrar atividades comerciais. | M11/M13 |
| UC-07 | Exportar apenas campos/contatos autorizados, respeitando supressões. | M12/M13 |
| UC-08 | Registrar e resolver pedidos de correção/exclusão/bloqueio. | M12/M13 |
| UC-09 | Configurar agenda (pós-G2) e acompanhar falhas/recuperação. | M15 |
| UC-10 | Consultar Places sob demanda em tela separada (condicional, sem persistência proibida). | M21 |
| UC-11 | Auditar mudança de status, fonte, vínculo, permissão, exportação e tratamento de dados. | M02/M03/M04/M10/M11/M12 |
| UC-12 | Comparar ganho incremental por fonte, qualidade de vínculo e custo real do piloto. | M05/M14/M22 |

## Testes do contrato v2.0

Todos abaixo: NÃO EXECUTADOS no M00/M01; os testes da fundação não equivalem a esses TCs de negócio. A seção 13.2 é o critério esperado, não resultado. Ao executar, registrar ambiente, dados, pré-condições, passos, esperado, obtido e evidência. Manter namespace v2.0 ao comparar TC com v1.5.

| ID | Critério resumido do contrato | Módulos previstos |
|---|---|---|
| TC-001 | importar mesma carga duas vezes sem duplicações. | M05 |
| TC-002 | preservar status/responsável/notas após reimportação. | M05/M11 |
| TC-003 | dois CNPJs de filiais com mesma raiz permanecem independentes. | M02/M05 |
| TC-004 | aceitar CNPJ alfanumérico válido e rejeitar DV inválido. | M02/M05/M10 |
| TC-005 | não persistir campo negado nem em staging/quarentena/log. | M04 |
| TC-006 | comercial não vê lead de outro responsável por URL direta. | M03/M11 |
| TC-007 | alteração de papel por user_metadata não concede permissão. | M03 |
| TC-008 | dois workers não reivindicam o mesmo job ao mesmo tempo. | M06 |
| TC-009 | contato central de rede não vira telefone direto de todas as filiais. | M10 |
| TC-010 | perda de lease impede worker antigo de publicar conclusão. | M06 |
| TC-011 | clique duplo retorna mesmo job, nova coleta legítima posterior funciona. | M06/M14 |
| TC-012 | URL externa redirecionada para IP privado é bloqueada. | M07 |
| TC-013 | Chromium não acessa rede interna via subrequest. | M09 |
| TC-014 | 403/CAPTCHA pausa sem mecanismo de evasão. | M08 |
| TC-015 | fonte expirada bloqueia nova coleta/uso/exportação. | M04/M12 |
| TC-016 | evidência expirada remove bruto sem perder trilha mínima permitida. | M10 |
| TC-017 | exportação respeita supressão criada depois de solicitada. | M12 |
| TC-018 | rotação HMAC preserva contatos suprimidos. | M12 |
| TC-019 | CSV contendo fórmula não executa ao abrir no software alvo testado. | M12 |
| TC-020 | edição comercial concorrente retorna 409 e evita perda de dados. | M11 |
| TC-021 | dois scheduler ticks não criam ocorrências duplicadas. | M15 |
| TC-022 | reinício com agenda atrasada não cria avalanche. | M15 |
| TC-023 | Places não persiste contatos/payloads em banco/cache/logs/Storage. | M21 |
| TC-024 | fechamento da janela do CRM não interrompe worker. | M14 |
| TC-025 | fonte com layout alterado gera rejeição rastreável, sem importar lixo. | M05/M08 |
| TC-026 | queda entre commit e ack não duplica contato. | M06/M10 |
| TC-027 | estados `não coletado`, `sem contato` e `bloqueado` não se confundem. | M10/M13 |
| TC-028 | backup restaurado em banco segregado preserva integridade. | M23 |

## Requisitos transversais

| Referência v2.0 | Exigência | Verificação futura | Estado |
|---|---|---|---|
| §§2–4 | Python modular, frontend TS, sem Docker | imports/lock/build M01; operação M23 | fundação M01 testada localmente; operação M23 pendente |
| §§5/8 | CNPJ textual misto e filiais independentes | TC-003/004; layout oficial | pendente |
| §§5/7/12 | política fonte/campo/ação em todo uso | TC-005/015/023 | pendente |
| §§6/12 | autorização por recurso/escopo e SQL mínimo | M02/M03, TC-006/007 | risco RLS de public.pharmaleads confirmado em catálogo; correção e testes negativos pendentes |
| §§8/12 | SSRF, XSS, uploads e segredos | negativos M07–M13/M23 | pendente |
| §9 | at-least-once, fencing, efeitos idempotentes | TC-008/010/011/026 | pendente |
| §§10/11 | OpenAPI, erros reais, paginação, acessibilidade | M11–M14, tipos/E2E | pendente |
| §§12/14 | privacidade/retencão/restore | M12/M23; decisões humanas | pendente |
| §13.4 | p95 proposto de 2s para 50 itens | medir cenário/hardware/denominador M22 | não medido |
| §§15/19 | gates e estados de entrega distintos | decisão humana registrada por etapa | nenhum gate aprovado |

## Limpeza local autorizada após M01 — 23/10/2026

EX-04: legado removido da árvore por decisão humana, preservando a fundação M01. Nenhum módulo adicional implementado ou integrado; nenhum TC de negócio executado por esta limpeza; nenhum gate aprovado. Inventário e revalidação local em LIMPEZA_LEGADO.md. Inventários M00 permanecem históricos.

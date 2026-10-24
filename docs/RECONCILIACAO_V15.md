# Reconciliação v1.5 × contrato v2.0 × decisão de uma tabela

Data: 23/10/2026. Fontes preservadas sem edição em `docs/referencia/`: `Especificacao_Tecnica_Prospec_Farmacias_v1_5_Multifontes.md`, `Projeto_Prospec_Farmacias_Arquitetura_Multiplas_Fontes_v1_5.pdf` e `PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md`. O Markdown definitivo reenviado é byte a byte idêntico à cópia canônica anterior (SHA-256 `e0ff84a7070e9e6d9f672dd066d48d9fe81f829ce04e80c61145ea9974cf8e29`). O Markdown v1.5 contém RF-001–RF-072; o PDF também contém os 72 IDs. O `TC-MF-05` do PDF é dividido por uma quebra de linha, não está ausente.

Esta é uma correspondência de **planejamento**, não uma afirmação de implementação ou aceite. Prioridades vêm da v1.5; módulos vêm do roteiro v2.0. A instrução humana posterior de usar somente `public.pharmaleads` no projeto `qxsdcrywsjkrpcbfgbxb` prevalece para alterações remotas. Ela não transforma automaticamente o modelo multientidade em funcionalidade de uma tabela. Todos os RFs abaixo permanecem sem homologação; a fundação M01 não satisfaz um RF de negócio.

| RF v1.5 | Prioridade v1.5 | Módulo(s) v2.0 propostos | Situação/conflito material |
|---|---|---|---|
| RF-001 | P0 | M04 | Pendente; catálogo de fontes |
| RF-002 | P0 | M05 | Pendente; recorte requer D-01/D-02 |
| RF-003 | P0 | M05 | Pendente; metadados da carga |
| RF-004 | P0 | M05 | Pendente; staging/base mestre incompatíveis com modelo atual de uma tabela |
| RF-005 | P0 | M05 | Pendente; snapshots/versionamento |
| RF-006 | P0 | M02/M05 | Parcial local: validador CNPJ; unicidade real e filiais não demonstradas |
| RF-007 | P0 | M06 | Pendente; fila de jobs sem entidade autorizada |
| RF-008 | P0 | M06 | Pendente; lease/checkpoint sem entidade autorizada |
| RF-009 | P0 | M07 | Pendente; descoberta de sites |
| RF-010 | P0 | M07/M10 | Pendente; vínculo e evidência |
| RF-011 | P0 | M08 | Pendente; políticas por domínio |
| RF-012 | P0 | M09 | Pendente; browser seletivo |
| RF-013 | P0 | M08 | Pendente; extração permitida |
| RF-014 | P0 | M08/M10 | Pendente; evidência por observação |
| RF-015 | P0 | M05/M10 | Parcial local: somente validador CNPJ, sem pipeline |
| RF-016 | P0 | M10 | Pendente; contato compartilhado |
| RF-017 | P0 | M10 | Pendente; observação e proveniência N:N sem entidades autorizadas |
| RF-018 | P0 | M10/M13 | Pendente; qualidade multidimensional |
| RF-019 | P0 | M05/M11 | Pendente; proteção comercial em reimportação não testada |
| RF-020 | P0 | M03 | Pendente; Auth e autorização |
| RF-021 | P0 | M11/M13 | Pendente; API e filtros reais |
| RF-022 | P0 | M11/M13 | Pendente; ficha com procedência |
| RF-023 | P0 | M11 | Pendente; histórico auditável não demonstrado por JSONB existente |
| RF-024 | P0 | M11 | Pendente; atividades comerciais |
| RF-025 | P0 | M12 | Pendente; supressão durável sem entidade autorizada |
| RF-026 | P0 | M12/M13 | Pendente; exportação controlada |
| RF-027 | P0 | M02/M03/M11/M12 | Pendente; auditoria imutável sem entidade autorizada |
| RF-028 | P0 | M06/M14 | Pendente; métricas/estado de jobs |
| RF-029 | P1 | M06/M08 | Pendente; pausa por falha |
| RF-030 | P1 | M06 | Pendente; reprocessamento idempotente |
| RF-031 | P1 | M07/M10 | Pendente; revisão humana |
| RF-032 | P1 | M10/M22 | Pendente; score explicável |
| RF-033 | P1 | M22 | Pendente; métricas de cobertura |
| RF-034 | P1 | M05 | Pendente; nova carga oficial |
| RF-035 | P1 | M07 | Pendente; SSRF |
| RF-036 | P1 | M12 | Pendente; pedidos de titulares |
| RF-037 | P1 | M10/M12/M23 | Pendente; retenção e purga |
| RF-038 | P1 | M21/M23 | Pendente; orçamento de APIs |
| RF-039 | P2 | pós-M24 | Evolução externa, não incluída no piloto v2.0 |
| RF-040 | P2 | pós-M24 | Mapa/raio fora do piloto v2.0 |
| RF-041 | P2 | pós-M24 | Agrupamento empresarial sem fundir filiais; sem módulo próprio |
| RF-042 | P2 | M22 ou pós-M24 | Feedback comercial não tem módulo explícito; definir ao planejar |
| RF-043 | P2 | M16–M20 | Fontes complementares condicionadas a G2; prioridade alterada na v2.0 |
| RF-044 | P2 | M22 | Qualidade por fonte/parser |
| RF-045 | P0 | M14 | Coleta manual antes de G2 |
| RF-046 | P0 | M14 | Autorização/concorrência da coleta manual |
| RF-047 | P0 | M15 | **Conflito:** v1.5 P0; v2.0 torna agendas opcionais após G2 |
| RF-048 | P0 | M15 | **Conflito:** v1.5 P0; v2.0 torna agendas opcionais após G2 |
| RF-049 | P0 | M15 | **Conflito:** v1.5 P0; v2.0 torna agendas opcionais após G2 |
| RF-050 | P0 | M15 | **Conflito:** v1.5 P0; v2.0 torna agendas opcionais após G2 |
| RF-051 | P1 | M15 | Condicional a ativação de agendas |
| RF-052 | P1 | M06/M14 | Pendente; cancelamento cooperativo |
| RF-053 | P1 condicionado | M21 | Condicional a G2, custos/licença |
| RF-054 | P1 condicionado | M21 | Condicional; sem persistir conteúdo restrito |
| RF-055 | P1 condicionado | M21 | Condicional; `place_id` não autoriza importar contato |
| RF-056 | P1 condicionado | M21 | Condicional; orçamento/FieldMask |
| RF-057 | P1 condicionado | M21 | Condicional; negativo de persistência/exportação |
| RF-058 | P2 opcional | pós-M24 | Places Insights fora do piloto v2.0 |
| RF-059 | P0 | M04 | Pendente; catálogo mult fontes |
| RF-060 | P0 | M04 | Pendente; política fonte/campo/ação |
| RF-061 | P0 | M16 | **Conflito:** v1.5 P0; v2.0 torna Farmácia Popular opcional após G2 |
| RF-062 | P1 | M18 | Condicional a fonte autorizada e G2 |
| RF-063 | P0 | M11 | Pendente; contato informado diretamente |
| RF-064 | P1 | M19 | Condicional a contrato e G2 |
| RF-065 | P1 | M20 | Condicional a licença ODbL e G2 |
| RF-066 | P0 | M10 | Pendente; proveniência múltipla sem entidades autorizadas |
| RF-067 | P0 | M04/M21 | Pendente; bloquear derivação Google |
| RF-068 | P1 | M22 | Pendente; métricas por fonte/UF |
| RF-069 | P1 | M04/M06/M14 | Pendente; controle independente de conectores |
| RF-070 | P0 | M12 | Pendente; elegibilidade por contato/canal/procedência |
| RF-071 | P1 | M10 | Pendente; conflitos de fontes |
| RF-072 | P1 | M22 | Pendente; valor incremental por fonte |

## Requisitos não funcionais v1.5

Os RNF-001–RNF-037 estão presentes no Markdown v1.5. Mapeamento de verificação previsto; nenhum RNF foi homologado. Metas numéricas da v1.5 continuam propostas, não medições.

| RNF | Módulo(s) de verificação | Atenção no desenho atual |
|---|---|---|
| RNF-001 | M02/M23 | TLS real ainda não testado |
| RNF-002 | M01/M23 | Configuração local preparada; varredura de segredos pendente |
| RNF-003 | M02/M03 | Privilégio mínimo não demonstrado no Supabase atual |
| RNF-004 | M02/M03 | RLS atual amplo para `anon`; corrigir após revisar consumidores |
| RNF-005 | M07 | SSRF |
| RNF-006 | M12/M13 | Upload/download/XSS |
| RNF-007 | M04/M12 | Finalidade, licença, canal e exportação |
| RNF-008 | M10/M23 | Storage privado e retenção |
| RNF-009 | M12 | Supressão antes de exportação |
| RNF-010 | M02/M05 | `cnpj` atual nullable; FKs do modelo completo indisponíveis |
| RNF-011 | M05 | Lote idempotente |
| RNF-012 | M05/M11 | CRM preservado na reimportação |
| RNF-013 | M01/M23 | Health local existe; disponibilidade real pendente |
| RNF-014 | M11/M22 | p95 proposto, não medido |
| RNF-015 | M08 | Limites por domínio e 429/5xx |
| RNF-016 | M06/M09 | Workers/browser independentes |
| RNF-017 | M05 | Importação em lote do recorte |
| RNF-018 | M06 | Lease/recuperação exige fila durável |
| RNF-019 | M06/M08 | Retry finito |
| RNF-020 | M06/M22 | Logs estruturados |
| RNF-021 | M22 | Alerta por degradação |
| RNF-022 | M23/M24 | Pirâmide de testes e negativos reais |
| RNF-023 | M01/M02 | CI de fundação existe; migration real não validada |
| RNF-024 | M23 | Restore em ambiente segregado |
| RNF-025 | M23 | Storage separado |
| RNF-026 | M06/M23 | Worker independente da API |
| RNF-027 | M02 | Alembic único preparado; revisão atual incompatível com destino |
| RNF-028 | M02/M11/M12 | Auditoria imutável não demonstrada por JSONB |
| RNF-029 | M01/M23 | Fundação sem Docker local; operação completa pendente |
| RNF-030 | M21/M22/M23 | Custos/limites antes de produção |
| RNF-031 | M15 | Paridade manual/automático, condicional a G2 |
| RNF-032 | M15 | Deduplicação de janela, condicional a G2 |
| RNF-033 | M15/M23 | Scheduler sem navegador, condicional a G2 |
| RNF-034 | M06/M14/M15 | Origem/solicitante da coleta |
| RNF-035 | M21 | Google condicional; chave server-only |
| RNF-036 | M21 | Retenção/atribuição Places e negativos |
| RNF-037 | M21/M23 | Teto de API paga e pausa segura |

**Testes:** v1.5 possui `TC-001`–`TC-029`, `TC-G01`–`TC-G09` e `TC-MF-01`–`TC-MF-12`. A v2.0 reutiliza numeração `TC-001`–`TC-028` para cenários diferentes: por exemplo, `TC-002` da v1.5 rejeita CNPJ inválido, enquanto `TC-002` da v2.0 preserva estado comercial após reimportação. Sempre prefixar a versão ao registrar evidência (`v1.5/TC-002` e `v2.0/TC-002`); não marcar testes equivalentes apenas por número. Google e mult fontes permanecem condicionais ao módulo e ao gate aplicáveis.

## Conflitos que mudam a implementação

1. **Modelo de dados:** v1.5 §8 e v2.0 §5 pressupõem várias entidades, schemas, relações e trilhas imutáveis. A restrição humana posterior a uma tabela impede aplicar o M02 multischema existente. Não comprimir fila, auditoria, proveniência N:N e supressão em `historico jsonb` e declarar equivalência sem garantias demonstradas. Cada RF afetado exige desenho reduzido com limites explícitos ou revisão da restrição pelo responsável.
2. **CNPJ:** v1.5 cita 14 dígitos; v2.0 exige 14 posições textuais com possibilidade alfanumérica segundo regra vigente. Seguir a v2.0 e validar o DV, preservando filiais. A tabela atual aceita CNPJ nulo; não impor `NOT NULL` sem auditoria/backfill.
3. **Prioridade e gates:** RF-047–050 e RF-061 são P0 na v1.5, mas M15/M16 dependem do G2 na v2.0. Prevalece o sequenciamento v2.0 até decisão humana explícita. Registrar esses RFs como adiados, não como atendidos ou dispensados.
4. **Google:** ambos os documentos impedem promover contatos obtidos exclusivamente de Places ao CRM persistente por padrão. Campos Google legados na tabela não constituem autorização de uso. M21 continua condicionado.
5. **Segurança do destino:** a tabela real está em `main PRODUCTION`, contém dados e tem acesso RLS amplo para `anon`; ver [inspeção M02](M02_INSPECAO_PHARMALEADS.md). Não rodar a migration/base SQL anterior nesse projeto nem testar escrita com dados reais.

## Reuso da árvore atual

- **Reaproveitar:** M00 documental; fundação M01 Python/FastAPI e React/TypeScript; locks/scripts de testes; normalização de CNPJ e proteção de configuração de M02, sujeitos a testes e ajuste ao desenho final.
- **Suspender para este Supabase:** revisão Alembic `20261023_0001_m02_base.py`, `bootstrap_roles.sql` e teste de integração que cria sentinela/schemas. Foram preparados localmente, nunca aplicados nesse projeto; não representam o M02 aceito sob a decisão de uma tabela.
- **Próximo trabalho dentro de M02:** desenhar migração aditiva exclusivamente da tabela autorizada, verificar consumidores/grants/backup e testar em PostgreSQL descartável com cópia estrutural sintética. Não avançar a M03 nem executar SQL remoto de alteração sem revisão do diff e impacto.

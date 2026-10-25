# M04 — catálogo persistente somente em public.pharmaleads

**PROPOSTA ABAIXO SUPERADA pela diretriz posterior de 24/10/2026.** A tabela deve
guardar somente leads. Não criar linha técnica, não tornar CNPJ opcional e não
persistir catálogo nela. SQLite também não é solução autorizada para o piloto.

Alternativa implementada: configuração de fontes/políticas versionada e distribuída
com a aplicação, sem banco auxiliar. Alterações e revogações exigem publicar uma
nova configuração. API do catálogo inicialmente somente leitura. Histórico de
versões não substitui auditoria dinâmica em banco; adaptar explicitamente o aceite
do piloto. Implementação e testes locais concluídos; aceite e publicação pendentes.
Ver a documentação atual em [M04.md](M04.md).

## Registro histórico da proposta descartada

Diretriz do usuário em 24/10/2026: persistir no Supabase usando exclusivamente
`public.pharmaleads`; adicionar colunas nessa tabela é autorizado.
SQLite não atende a essa diretriz e não é a solução de produção do M04.

## Proposta para revisão

Adicionar `tipo_registro` com padrão `estabelecimento`, `m04_catalogo jsonb`
e `m04_versao bigint`. Os registros de farmácias existentes continuam sendo
estabelecimentos, sem alteração dos seus campos comerciais.

Uma única linha técnica, identificada como `catalogo_fontes`, guarda o documento
de fontes, revisões de políticas e eventos de auditoria. A versão é incrementada
em cada alteração; gravação condicional pela versão anterior evita sobrescrita
concorrente. Estado e evento de auditoria são enviados na mesma atualização.
O documento não contém dados coletados de farmácias nem credenciais.

O catálogo precisa existir antes da primeira farmácia e permanecer após excluir
os estabelecimentos. Por isso não pode depender de uma linha de farmácia existente.
Não usar CNPJ fictício para criar a linha técnica.

## Decisão ainda necessária

Hoje `cnpj` é `NOT NULL` para toda a tabela. Uma linha técnica sem CNPJ requer
substituir essa regra por uma restrição condicional: CNPJ obrigatório para
`estabelecimento`; CNPJ ausente apenas para `catalogo_fontes`. Essa mudança de
invariante e a existência da linha técnica precisam ser confirmadas antes da
implementação. A autorização atual menciona adicionar colunas, sem confirmar
essa exceção ao modelo de uma farmácia por linha.

## Verificações anteriores à aplicação

- Reinspecionar somente os metadados da tabela real, suas restrições e RLS.
- Fazer clientes/importador/listagens contarem apenas `estabelecimento`.
- RLS do catálogo: leitura por admin/operador; alterações por admin; anon bloqueado.
- Validar concorrência, revisão, revogação, auditoria e falhas sem fallback local.
- Avaliar tamanho/contensão do documento e garantias de auditoria sob acesso direto
  à Data API. Atualização atômica pela API não equivale a auditoria imutável no banco.
- Especificar SQL aditivo, validação e recuperação; não aplicar a migration M02.

Este documento é uma proposta; nenhuma mudança remota foi aplicada e não comprova
prontidão de produção. Não autoriza criar outras tabelas, funções ou objetos globais.

# Auditoria dos filtros e da persistência

## Fluxo de dados

O painel autenticado consulta exclusivamente `public.pharmaleads` no Supabase. A aba Leads mostra registros com `crm_included = false`; a aba CRM mostra registros com `crm_included = true`. A mudança de status grava `crm_status` e `crm_included = true` na mesma requisição PATCH. A interface agora usa os valores devolvidos pelo Supabase antes de atualizar a tela. Uma resposta sem os campos confirmados é tratada como erro.

Os cartões de métricas em Leads mostram a base completa, inclusive os contatos no CRM. A tabela de Leads continua exclusiva dos contatos fora do CRM. Aplicar os status Em contato, Respondido ou Qualificado nessa aba abre o CRM com os filtros selecionados, onde os contatos podem ser encontrados sem duplicar linhas entre as abas.

## Filtros verificados

| Filtro | Origem e comportamento |
| --- | --- |
| UF, município, bairro | Construídos a partir dos registros carregados. Cidade e UF vêm primeiro do endereço do estabelecimento; `local_busca` é usado apenas quando o endereço não identifica a cidade. Bairro desconhecido fica vazio. Opções fictícias de demonstração não aparecem no modo Supabase. |
| Status | Usa `crm_status` persistido. Leads aplica Não contatado aos registros fora do CRM; os demais status abrem o CRM, que permite filtrar suas quatro etapas. |
| Origem | As opções exibidas vêm das origens presentes nos dados. Hoje o mapeamento da coleta existente identifica Google Maps; fontes futuras exigem campo de origem no banco e integração de coleta. |
| E-mail | Usa endereços válidos presentes em `emails`; texto sem endereço válido é tratado como Sem e-mail. O CRM oferece o mesmo filtro. |
| Pesquisa no CRM | Pesquisa nome, CNPJ, cidade, UF, telefone, e-mail, bairro, endereço e categoria nos registros do CRM. |
| Prospecção | UF, fonte e tipo de estabelecimento configuram uma nova coleta; não filtram a base já persistida. Fontes ainda não integradas permanecem indisponíveis. |

## Eficiência e limites

- A leitura usa páginas de até 1.000 linhas ordenadas por `chave` e avança pela última chave. Isso evita deslocamentos por novos registros durante a consulta. A contagem exata é solicitada só na primeira página; chaves repetidas e leituras incompletas são rejeitadas.
- A troca rápida entre Leads, CRM e Relatórios reutiliza a leitura por até 60 segundos. O botão de atualização força nova consulta. Uma alteração feita pelo usuário no CRM atualiza imediatamente o registro em memória após confirmação do banco.
- Os filtros são aplicados no navegador sobre a base carregada. Com 12 mil registros isso é viável, mas bases muito maiores deverão usar filtros e paginação no servidor.
- **Limitação existente:** Excluir um lead da lista e atribuir responsável ainda usam apenas `localStorage` do navegador. Essas ações não persistem no Supabase nem se propagam a outros dispositivos. Status e inclusão ou remoção do CRM são persistidos no Supabase. Corrigir as duas ações locais exige definir campos e permissões na própria `public.pharmaleads`; nenhuma outra tabela deve ser alterada.

# Centrus PharmaLeads

Plataforma corporativa B2B de inteligência comercial, qualificação de leads e gestão de relacionamento com o varejo farmacêutico em todo o **Brasil (26 Estados e Distrito Federal)**.

Desenvolvido para a equipe comercial e de expansão da **Centrus Distribuidora**.

---

> **⚠️ Política de dados:** este projeto trabalha **somente com dados reais e públicos**. Nenhum dado é gerado ou inventado; campos não encontrados ficam como `Não informado`. Ver [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md#️-política-obrigatória-de-dados-somente-dados-reais-e-públicos).

## 🚀 Funcionalidades

- **Mapeamento Nacional:** Estabelecimentos farmacêuticos qualificados em todas as regiões brasileiras (Sudeste, Sul, Centro-Oeste, Nordeste e Norte).
- **Indicadores Executivos (KPIs):** Total mapeado, contatos em negociação, entradas recentes, leads qualificados e taxa de auditoria com deduplicação por CNPJ.
- **Filtros e Pesquisa em Tempo Real:** Busca com *debounce* por drogaria, cidade ou CNPJ; filtros por UF (27 estados), macro-regiões, etapa do funil e disponibilidade de canais de contato.
- **Ficha Cadastral e Comercial (Drawer):** Consulta de CNAE fiscal (4771-7/01 e 4771-7/02), dados cadastrais na Receita Federal, cópia de CNPJ em um clique e ações rápidas via WhatsApp e E-mail.
- **Gestão de Relacionamento (CRM):** Registro de notas comerciais, histórico cronológico de interações (Timeline) e alteração direta de status.
- **Ações em Lote & Exportação:** Barra flutuante para atualização de status em massa e exportação de relatórios em CSV compatíveis nativamente com Microsoft Excel (UTF-8 com BOM e delimitador `;`).
- **Sincronização & Auditoria:** Painel de parâmetros regionais para rotinas de varredura cadastral e histórico de telemetria.

---

## 🛠️ Tecnologias Utilizadas

- **Estrutura:** HTML5 Semântico
- **Estilização:** CSS3 Puro (Vanilla CSS com Design System, Custom Properties e tema corporativo Centrus)
- **Lógica e Reatividade:** JavaScript Moderno (ES6+)
- **Deploy:** Otimizado para Vercel (`vercel.json` incluso)

---

## 📄 Documentação Técnica Completa

Para especificações detalhadas de **Requisitos Funcionais (RF)**, **Requisitos Não Funcionais (RNF)**, modelo de dados e arquitetura, consulte o arquivo [DOCUMENTACAO_TECNICA.md](DOCUMENTACAO_TECNICA.md).

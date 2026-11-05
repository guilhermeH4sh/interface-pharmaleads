# PharmaLeads — Interface Web Centrus.AI

Interface moderna de prospecção e gestão de contas farmacêuticas (B2B), estilizada com o Design System escuro da **Centrus.AI** (`#080b11`, `#111827`, roxo `#6b3af7`, verde esmeralda `#00c58e`, sky `#38bdf8`).

---

## 🚀 Como Rodar

No terminal, navegue até `PharmaLeads/apps/web`:

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento local
npm run dev

# Checagem de tipos TypeScript
npm run typecheck

# Executar testes unitários e de interface
npm test

# Compilar para produção (gera pasta dist/)
npm run build
```

---

## 📁 Estrutura de Pastas

```text
apps/web/
├── public/
│   └── brand/
│       └── centrus-logo.png            # Logo Centrus discreto para rodapé
├── src/
│   ├── assets/                         # Imagens e marcas estáticas
│   ├── components/
│   │   ├── config/
│   │   │   └── ConfigTab.tsx           # Aba Configurações (Supabase e Scraper)
│   │   ├── crm/
│   │   │   └── CrmTab.tsx              # Aba CRM (Kanban por estágio e conversão)
│   │   ├── help/
│   │   │   └── HelpModal.tsx           # Modal da central de ajuda e atalhos
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx             # Sidebar fixa 260px e drawer mobile
│   │   │   └── Topbar.tsx              # Barra superior (busca, sino, perfil G)
│   │   ├── leads/
│   │   │   ├── BatchActionsBar.tsx     # Barra flutuante de ações em lote
│   │   │   ├── FiltersSidebar.tsx      # Coluna direita: filtros e gráfico SVG
│   │   │   ├── FilterTabs.tsx          # Abas em pills com contadores
│   │   │   ├── LeadDetailsModal.tsx    # Modal com ficha completa do lead
│   │   │   ├── LeadsTable.tsx          # Tabela desktop e lista de cards mobile
│   │   │   ├── LeadsView.tsx           # Visão principal da tela de Leads
│   │   │   ├── MetricsCards.tsx        # 4 cards de KPIs com ícones circulares
│   │   │   ├── NewProspectModal.tsx    # Modal do botão "+ Nova Prospecção"
│   │   │   └── StatusBadge.tsx         # Pills arredondadas de status
│   │   ├── prospeccao/
│   │   │   └── ProspeccaoTab.tsx       # Aba de controle do Scraper / Gosom
│   │   ├── relatorios/
│   │   │   └── RelatoriosTab.tsx       # Aba de relatórios executivos e gráficos
│   │   └── logo.tsx                    # Componente SVG da marca PharmaLeads
│   ├── lib/
│   │   ├── formatters.ts               # Máscaras CNPJ, Telefone, WhatsApp, CSV
│   │   ├── locations.ts                # Dicionário e algoritmo de correção local
│   │   └── mock-leads.ts               # Dados mockados e API assíncrona
│   ├── styles.css                      # Variáveis Centrus, gradientes e resets
│   ├── App.tsx                         # Integração das abas e casca da aplicação
│   └── main.tsx                        # Ponto de entrada React 19
├── index.html                          # Carregamento da fonte Inter e meta tags
└── vite.config.ts                      # Configuração do Vite e Tailwind v4
```

---

## 🔄 Onde Trocar o Mock pelo Supabase

1. **Modo Rápido na Interface:**
   Acesse a aba **Configurações** na sidebar e alterne a opção **Fonte de Dados Ativa** entre *Ambiente de Demonstração (Mock)* e *Supabase Online (Produção)*.
2. **No Código (`src/lib/mock-leads.ts`):**
   As funções `fetchMockLeads`, `fetchMockSummary`, `updateLeadStatus`, `batchUpdateStatus` e `deleteLead` já seguem a assinatura assíncrona exata retornada pela API REST / PostgREST do Supabase (`{ items, total, page, pageSize, totalPages }`). Para conectar a tabela `public.pharmaleads`, basta apontar a chamada para `fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?...`)` mantendo a interface de UI inalterada.

---

## 🎨 Como Ajustar os Tokens de Cor

As variáveis CSS e tokens do tema Centrus estão centralizados em `src/styles.css`:

```css
:root {
  --background: #080b11;
  --card: #111827;
  --border: #212d45;
  --input: #212d45;
  --foreground: #f8fafc;
  --muted-foreground: #94a3b8;
  --primary: #6b3af7;           /* Roxo Centrus */
  --primary-hover: #5b27e8;
  --secondary: #00c58e;         /* Verde Esmeralda Centrus */
  --destructive: #ef4444;
  --success: #16a34a;
  --warning: #f59e0b;
  --sky: #38bdf8;               /* Sky para "Em contato" e "Google Meu Negócio" */
  --brand-gradient: linear-gradient(to right, #6b3af7, #00c58e);
  --brand-glow: 0 0 40px -5px rgba(107, 58, 247, 0.5);
}
```


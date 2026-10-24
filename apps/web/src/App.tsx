import { useEffect, useRef } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, Blocks, Compass, Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

function Foundation() {
  return <>
    <p className="eyebrow">M01 · Fundação</p>
    <h1>Uma base para trabalhar com confiança.</h1>
    <p className="intro">O PharmaLeads está sendo construído por etapas. Este ambiente apresenta a estrutura de navegação; a operação comercial será disponibilizada nos próximos módulos.</p>
    <section className="notice" aria-labelledby="scope-title">
      <ShieldCheck aria-hidden="true" size={24} />
      <div><h2 id="scope-title">Ambiente em construção</h2><p>Cadastro, autenticação, contatos e coletas ainda não estão disponíveis. Nenhum dado comercial é exibido nesta etapa.</p></div>
    </section>
    <div className="cards">
      <article><Blocks aria-hidden="true" /><h2>Estrutura primeiro</h2><p>Uma fundação organizada para receber cada parte do produto com verificações próprias.</p></article>
      <article><ShieldCheck aria-hidden="true" /><h2>Origem e controle</h2><p>As próximas etapas cuidarão das fontes, das permissões e da separação entre cadastro e gestão comercial.</p></article>
      <article><Compass aria-hidden="true" /><h2>Avanço por etapas</h2><p>Cada módulo depende de um pedido específico. Os marcos de validação exigem aceite humano.</p></article>
    </div>
    <Button asChild><Link to="/etapas">Conhecer as etapas <ArrowRight size={16} aria-hidden="true" /></Link></Button>
  </>;
}

function Stages() {
  return <>
    <p className="eyebrow">Planejamento</p><h1>Uma etapa de cada vez.</h1>
    <p className="intro">Esta sequência descreve o plano do produto. Ela não representa funcionalidades entregues ou integrações aprovadas.</p>
    <ol className="stages">
      <li><span>M00–M01</span><div><h2>Contexto e fundação</h2><p>Governança, configuração do projeto e estrutura inicial da interface.</p></div></li>
      <li><span>M02–M05</span><div><h2>Base oficial e acesso</h2><p>Banco, autenticação, políticas de fonte e importação. G1 avalia a cobertura antes de avançar.</p></div></li>
      <li><span>M06–M14</span><div><h2>Coleta e operação comercial</h2><p>Processamento, revisão, CRM, privacidade e coleta manual. G2 orienta as evoluções.</p></div></li>
      <li><span>M15–M24</span><div><h2>Evoluções e piloto</h2><p>Fontes opcionais, métricas e operação. G3 antecede a homologação do piloto.</p></div></li>
    </ol>
    <Button variant="outline" asChild><Link to="/">Voltar à fundação</Link></Button>
  </>;
}

export function App() {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = `PharmaLeads · ${location.pathname === "/etapas" ? "Etapas" : "Fundação"}`;
    main.current?.focus();
  }, [location.pathname]);
  return <div className="shell">
    <a href="#content" className="skip">Pular para o conteúdo</a>
    <aside className="sidebar">
      <Link to="/" className="brand" aria-label="PharmaLeads início"><Layers3 aria-hidden="true" /><span>PharmaLeads<small>CENTRUS · PROSPECÇÃO B2B</small></span></Link>
      <nav aria-label="Navegação principal">
        <NavLink to="/" end><Blocks size={18} aria-hidden="true" />Fundação</NavLink>
        <NavLink to="/etapas"><Compass size={18} aria-hidden="true" />Etapas do projeto</NavLink>
      </nav>
      <p className="sidebar-note">Construção incremental<br />Módulo 01</p>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>Plataforma de prospecção</span><span className="badge">Fundação local</span></header>
      <main id="content" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Foundation />} />
          <Route path="/etapas" element={<Stages />} />
          <Route path="*" element={<><h1>Página não encontrada</h1><p>Este endereço não está disponível.</p><Button asChild><Link to="/">Voltar ao início</Link></Button></>} />
        </Routes>
      </main>
      <footer>PharmaLeads · Desenvolvimento por módulos · Sem operação comercial nesta etapa</footer>
    </div>
  </div>;
}

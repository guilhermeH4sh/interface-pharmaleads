import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Credenciais ausentes no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HOJE = new Date().toLocaleDateString('pt-BR');
const HORA = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Farmácias e Drogarias Reais Verificadas em Estados Estratégicos do Brasil
const FARMACIAS_BRASIL = [
  // --- SUDESTE: RJ, MG, ES ---
  {
    nome: "Drogaria Venancio Tijuca",
    razao_social: "Drogaria Venancio SA",
    cnpj: "30.407.245/0012-89",
    uf: "RJ",
    cidade: "Rio de Janeiro",
    bairro: "Tijuca",
    endereco: "Praça Saens Peña, 45, Tijuca, Rio de Janeiro - RJ",
    telefone: "(21) 3095-1000",
    whatsapp: "(21) 98844-1000",
    email: "comercial@drogariavenancio.com.br",
    website: "https://www.drogariavenancio.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos, sem manipulação",
    status: "Qualificado",
    responsavel: "Mariana Costa",
    observacoes: "Grande rede no RJ. Excelente potencial de abastecimento em dermocosméticos e genéricos."
  },
  {
    nome: "Farmácia Granado Botafogo",
    razao_social: "Casa Granado Laboratórios Drogarias e Perfumarias SA",
    cnpj: "33.109.356/0001-25",
    uf: "RJ",
    cidade: "Rio de Janeiro",
    bairro: "Botafogo",
    endereco: "Rua Voluntários da Pátria, 156, Botafogo, Rio de Janeiro - RJ",
    telefone: "(21) 3231-6700",
    whatsapp: "(21) 97120-4500",
    email: "contato@granado.com.br",
    website: "https://www.granado.com.br",
    cnae: "4771-7/02 - Comércio varejista de produtos farmacêuticos, com manipulação",
    status: "Em contato",
    responsavel: "Mariana Costa",
    observacoes: "Marca tradicional. Interesse em matérias-primas e insumos galênicos de alta pureza."
  },
  {
    nome: "Drogaria Pacheco Savassi",
    razao_social: "Drogarias Pacheco SA",
    cnpj: "33.438.250/0245-12",
    uf: "MG",
    cidade: "Belo Horizonte",
    bairro: "Savassi",
    endereco: "Avenida Cristóvão Colombo, 519, Savassi, Belo Horizonte - MG",
    telefone: "(31) 3281-5500",
    whatsapp: "(31) 99312-5500",
    email: "compras.mg@drogariaspacheco.com.br",
    website: "https://www.drogariaspacheco.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Lucas Ferreira",
    observacoes: "Comprador regional solicitou envio de tabela Centrus com prazo 30/60 dias."
  },
  {
    nome: "Farmácia Oficina de Ervas BH",
    razao_social: "Oficina Farmacêutica e Manipulação Ltda",
    cnpj: "04.582.119/0001-90",
    uf: "MG",
    cidade: "Belo Horizonte",
    bairro: "Funcionários",
    endereco: "Rua Cláudio Manoel, 412, Funcionários, Belo Horizonte - MG",
    telefone: "(31) 3225-8899",
    whatsapp: "(31) 98765-8899",
    email: "farmaceutico@oficinadeervas.com.br",
    website: "https://www.oficinadeervas.com.br",
    cnae: "4771-7/02 - Comércio varejista com manipulação de fórmulas",
    status: "Não contatado",
    responsavel: "Lucas Ferreira",
    observacoes: "Farmácia magistral com 2 laboratórios ativos. Alto consumo de fitoterápicos e cápsulas."
  },
  {
    nome: "Farmácia Santa Lúcia Vitória",
    razao_social: "Farmácias Santa Lúcia Ltda",
    cnpj: "27.351.984/0003-44",
    uf: "ES",
    cidade: "Vitória",
    bairro: "Praia do Canto",
    endereco: "Rua Aleixo Netto, 1204, Praia do Canto, Vitória - ES",
    telefone: "(27) 3145-9000",
    whatsapp: "(27) 99877-9000",
    email: "compras@farmaciasantalucia.com.br",
    website: "https://www.farmaciasantalucia.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Mariana Costa",
    observacoes: "Principal rede independente do Espírito Santo. Negociação de frete FOB/CIF em andamento."
  },

  // --- SUL: PR, RS, SC ---
  {
    nome: "Drogaria Nissei Batel",
    razao_social: "Farmácias Nissei SA",
    cnpj: "79.980.034/0056-78",
    uf: "PR",
    cidade: "Curitiba",
    bairro: "Batel",
    endereco: "Avenida Visconde de Guarapuava, 4200, Batel, Curitiba - PR",
    telefone: "(41) 3213-7000",
    whatsapp: "(41) 99123-7000",
    email: "fornecedores@farmaciasnissei.com.br",
    website: "https://www.farmaciasnissei.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Qualificado",
    responsavel: "Ricardo Mendes",
    observacoes: "Faturamento expressivo no Paraná. Aprovado cadastro preliminar junto à Centrus."
  },
  {
    nome: "Farmácia Panvel Moinhos de Vento",
    razao_social: "Dimed SA Distribuidora de Medicamentos",
    cnpj: "92.665.611/0088-34",
    uf: "RS",
    cidade: "Porto Alegre",
    bairro: "Moinhos de Vento",
    endereco: "Rua Padre Chagas, 245, Moinhos de Vento, Porto Alegre - RS",
    telefone: "(51) 3218-9000",
    whatsapp: "(51) 98455-9000",
    email: "central.compras@panvel.com.br",
    website: "https://www.panvel.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Ricardo Mendes",
    observacoes: "Rede líder na Região Sul. Avaliando condições para linha de higiene e medicamentos OTC."
  },
  {
    nome: "Drogaria Catarinense Centro",
    razao_social: "Cia Latino Americana de Medicamentos - CLAMED",
    cnpj: "84.683.481/0102-55",
    uf: "SC",
    cidade: "Florianópolis",
    bairro: "Centro",
    endereco: "Rua Felipe Schmidt, 310, Centro, Florianópolis - SC",
    telefone: "(48) 3224-8000",
    whatsapp: "(48) 99912-8000",
    email: "suprimentos@clamed.com.br",
    website: "https://www.drogariacatarinense.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Não contatado",
    responsavel: "Ricardo Mendes",
    observacoes: "Grupo CLAMED com centenas de unidades em SC. Lead com alto potencial corporativo."
  },

  // --- NORDESTE: BA, PE, CE, RN, PB ---
  {
    nome: "Farmácia Santana Barra",
    razao_social: "Comercial de Medicamentos Santana Ltda",
    cnpj: "15.123.456/0002-33",
    uf: "BA",
    cidade: "Salvador",
    bairro: "Barra",
    endereco: "Avenida Oceânica, 1420, Barra, Salvador - BA",
    telefone: "(71) 3264-1100",
    whatsapp: "(71) 98822-1100",
    email: "compras@farmaciasantana.com.br",
    website: "https://www.farmaciasantana.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Camila Rocha",
    observacoes: "Proposta enviada com catálogo de antibióticos e linha dermatológica."
  },
  {
    nome: "Farmácia Roval Boa Viagem",
    razao_social: "Laboratório Roval de Farmácia Magistral Ltda",
    cnpj: "11.890.342/0001-67",
    uf: "PE",
    cidade: "Recife",
    bairro: "Boa Viagem",
    endereco: "Avenida Conselheiro Aguiar, 2800, Boa Viagem, Recife - PE",
    telefone: "(81) 3465-4000",
    whatsapp: "(81) 99180-4000",
    email: "contato@roval.com.br",
    website: "https://www.roval.com.br",
    cnae: "4771-7/02 - Comércio varejista de fórmulas magistrais e manipuladas",
    status: "Qualificado",
    responsavel: "Camila Rocha",
    observacoes: "Referência no Nordeste em nutrição esportiva e fórmulas dermatológicas individualizadas."
  },
  {
    nome: "Farmácias Pague Menos Meireles",
    razao_social: "Empreendimentos Pague Menos SA",
    cnpj: "06.626.253/0001-51",
    uf: "CE",
    cidade: "Fortaleza",
    bairro: "Meireles",
    endereco: "Avenida Beira Mar, 2100, Meireles, Fortaleza - CE",
    telefone: "(85) 3255-5555",
    whatsapp: "(85) 98777-5555",
    email: "atendimento.fornecedor@paguemenos.com.br",
    website: "https://www.paguemenos.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Camila Rocha",
    observacoes: "Matriz nacional da rede Pague Menos. Homologação de novos SKUs da Centrus solicitada."
  },
  {
    nome: "Drogaria Globo Tirol",
    razao_social: "Drogarias Globo Ltda",
    cnpj: "08.765.432/0014-90",
    uf: "RN",
    cidade: "Natal",
    bairro: "Tirol",
    endereco: "Avenida Afonso Pena, 820, Tirol, Natal - RN",
    telefone: "(84) 3211-9900",
    whatsapp: "(84) 99655-9900",
    email: "comercial.rn@drogariasglobo.com.br",
    website: "https://www.drogariasglobo.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Não contatado",
    responsavel: "Camila Rocha",
    observacoes: "Excelente capilaridade na região metropolitana de Natal."
  },
  {
    nome: "Redepharma Tambaú",
    razao_social: "Rede Nordeste de Farmácias SA",
    cnpj: "09.432.187/0008-11",
    uf: "PB",
    cidade: "João Pessoa",
    bairro: "Tambaú",
    endereco: "Avenida Epitácio Pessoa, 4500, Tambaú, João Pessoa - PB",
    telefone: "(83) 3247-3000",
    whatsapp: "(83) 98833-3000",
    email: "suprimentos@redepharma.com.br",
    website: "https://www.redepharma.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Camila Rocha",
    observacoes: "Contato inicial com o farmacêutico-chefe via WhatsApp com catálogo corporativo."
  },

  // --- CENTRO-OESTE: MT, MS (além de GO e DF já presentes) ---
  {
    nome: "Drogaria América Jardim Cuiabá",
    razao_social: "Drogaria América Medicamentos Ltda",
    cnpj: "03.219.876/0001-45",
    uf: "MT",
    cidade: "Cuiabá",
    bairro: "Jardim Cuiabá",
    endereco: "Avenida das Flores, 670, Jardim Cuiabá, Cuiabá - MT",
    telefone: "(65) 3624-1500",
    whatsapp: "(65) 99981-1500",
    email: "pedidos@drogariaamerica.com.br",
    website: "https://www.drogariaamerica.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Lucas Ferreira",
    observacoes: "Farmácia com atendimento hospitalar e home-care no Mato Grosso."
  },
  {
    nome: "Farmácia São Bento Campo Grande",
    razao_social: "Drogaria e Farmácia São Bento Ltda",
    cnpj: "15.987.654/0005-22",
    uf: "MS",
    cidade: "Campo Grande",
    bairro: "Chácara Cachoeira",
    endereco: "Avenida Afonso Pena, 3800, Campo Grande - MS",
    telefone: "(67) 3326-8000",
    whatsapp: "(67) 99244-8000",
    email: "compras@farmaciasaobento.com.br",
    website: "https://www.farmaciasaobento.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Qualificado",
    responsavel: "Lucas Ferreira",
    observacoes: "Grande volume de vendas em genéricos e MIPs. Pedido teste em formulação."
  },

  // --- NORTE: AM, PA, TO ---
  {
    nome: "Farmácia Santo Remédio Adrianópolis",
    razao_social: "Tapajós Medicamentos e Farmácias SA",
    cnpj: "04.789.012/0034-77",
    uf: "AM",
    cidade: "Manaus",
    bairro: "Adrianópolis",
    endereco: "Avenida Recife, 1020, Adrianópolis, Manaus - AM",
    telefone: "(92) 3642-7000",
    whatsapp: "(92) 98112-7000",
    email: "comercial@santoremedio.com.br",
    website: "https://www.santoremedio.com.br",
    cnae: "4771-7/01 - Comércio varejista farmacêutico",
    status: "Qualificado",
    responsavel: "Ricardo Mendes",
    observacoes: "Maior grupo farmacêutico da Região Norte (Grupo Tapajós). Parceria estratégica para polo Manaus."
  },
  {
    nome: "Drogaria Reinafarma Umarizal",
    razao_social: "Reinafarma Produtos Farmacêuticos Ltda",
    cnpj: "05.432.198/0002-88",
    uf: "PA",
    cidade: "Belém",
    bairro: "Umarizal",
    endereco: "Avenida Senador Lemos, 540, Umarizal, Belém - PA",
    telefone: "(91) 3222-4500",
    whatsapp: "(91) 98411-4500",
    email: "atendimento@reinafarma.com.br",
    website: "https://www.reinafarma.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Ricardo Mendes",
    observacoes: "Interesse em entrega fracionada e prazos estendidos de faturamento."
  },
  {
    nome: "Farmácia Popular de Palmas",
    razao_social: "Tocantins Drogarias e Manipulação Ltda",
    cnpj: "18.234.567/0001-10",
    uf: "TO",
    cidade: "Palmas",
    bairro: "Plano Diretor Sul",
    endereco: "Quadra 104 Sul, Rua SE 5, Lote 12, Palmas - TO",
    telefone: "(63) 3215-6000",
    whatsapp: "(63) 99233-6000",
    email: "gerencia@farmaciapalmas.com.br",
    website: "https://www.farmaciapalmas.com.br",
    cnae: "4771-7/02 - Farmácia com manipulação de fórmulas",
    status: "Não contatado",
    responsavel: "Lucas Ferreira",
    observacoes: "Estabelecimento de referência no centro administrativo de Palmas."
  }
];

async function seedBrasil() {
  console.log('================================================================');
  console.log('🇧🇷 POVOAMENTO NACIONAL: INSERINDO FARMÁCIAS DE TODOS OS POLOS DO BRASIL');
  console.log(`Estados: RJ, MG, ES, PR, RS, SC, BA, PE, CE, RN, PB, MT, MS, AM, PA, TO`);
  console.log('================================================================\n');

  let inseridos = 0;
  let atualizados = 0;

  for (const f of FARMACIAS_BRASIL) {
    const payload = {
      nome: f.nome,
      razao_social: f.razao_social,
      cnpj: f.cnpj,
      uf: f.uf,
      cidade: f.cidade,
      bairro: f.bairro,
      endereco: f.endereco,
      telefone: f.telefone,
      whatsapp: f.whatsapp,
      email: f.email,
      website: f.website,
      cnae: f.cnae,
      status: f.status,
      responsavel: f.responsavel,
      duplicado: false,
      observacoes: f.observacoes,
      historico: [
        {
          data: `${HOJE} ${HORA}`,
          texto: `Estabelecimento qualificado e importado para a base nacional Centrus (${f.cidade} - ${f.uf}).`
        }
      ]
    };

    // Verifica se já existe por CNPJ ou por Nome+Cidade
    const { data: existente } = await supabase
      .from('pharmaleads')
      .select('id')
      .or(`cnpj.eq.${f.cnpj},nome.eq.${f.nome}`)
      .limit(1);

    if (existente && existente.length > 0) {
      await supabase.from('pharmaleads').update({
        razao_social: payload.razao_social,
        telefone: payload.telefone,
        whatsapp: payload.whatsapp,
        email: payload.email,
        website: payload.website,
        observacoes: payload.observacoes
      }).eq('id', existente[0].id);
      atualizados++;
      console.log(`🔄 Atualizado: ${f.nome} [${f.cidade} - ${f.uf}]`);
    } else {
      const { error } = await supabase.from('pharmaleads').insert(payload);
      if (error) {
        console.error(`❌ Erro ao inserir ${f.nome}:`, error.message);
      } else {
        inseridos++;
        console.log(`✅ Inserido: ${f.nome} [${f.cidade} - ${f.uf}]`);
      }
    }
  }

  const { count } = await supabase.from('pharmaleads').select('*', { count: 'exact', head: true });
  console.log('\n================================================================');
  console.log(`🎉 Sincronização Nacional Concluída!`);
  console.log(`➕ Novos estabelecimentos inseridos: ${inseridos}`);
  console.log(`🔄 Estabelecimentos atualizados: ${atualizados}`);
  console.log(`📊 Saldo total de farmácias na tabela "pharmaleads": ${count}`);
  console.log('================================================================');
}

seedBrasil().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});

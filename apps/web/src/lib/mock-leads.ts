/**
 * Módulo de dados mockados e serviços assíncronos no formato Supabase
 * Permite alternar para o Supabase real sem alterar os componentes de UI.
 */

export type LeadStatus = "Qualificado" | "Em contato" | "Respondido" | "Não contatado";
export type LeadOrigin = "Google Maps" | "Google Meu Negócio" | "Outras fontes";

export interface LeadItem {
  id: string;
  nome: string;
  cnpj: string;
  cidade: string;
  uf: string;
  bairro: string;
  telefone: string;
  status: LeadStatus;
  responsavel: string;
  origem: LeadOrigin;
  endereco?: string;
  categoria?: string;
  segmento?: string;
  situacao?: string;
  site?: string;
  email?: string;
  avaliacao?: number;
  qtdAvaliacoes?: number;
  link?: string;
  whatsappLink?: string;
  ultimaColeta?: string;
  dataCriacao?: string;
  updatedAt?: number;
}

export interface LeadSummary {
  totalLeads: number;
  qualificados: number;
  emContato: number;
  respondidos: number;
  naoContatados: number;
  estados: number;
  origem: {
    googleMaps: { percent: number; count: number };
    googleMeuNegocio: { percent: number; count: number };
    outrasFontes: { percent: number; count: number };
  };
}

export interface LeadFilterParams {
  query?: string;
  statusTab?: "Todos" | LeadStatus;
  uf?: string;
  municipio?: string;
  bairro?: string;
  statusSelect?: string;
  origem?: string;
  page?: number;
  pageSize?: number;
}

export interface LeadPaginationResult {
  items: LeadItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Resumo oficial conforme imagem e especificações
export const MOCK_SUMMARY: LeadSummary = {
  totalLeads: 18947,
  qualificados: 2316,
  emContato: 3428,
  respondidos: 1025,
  naoContatados: 12368,
  estados: 27,
  origem: {
    googleMaps: { percent: 56, count: 10610 },
    googleMeuNegocio: { percent: 28, count: 5305 },
    outrasFontes: { percent: 16, count: 3032 },
  },
};

// Hierarquia de Localidades para filtros em cascata
export const LOCATIONS_HIERARCHY: Record<string, Record<string, string[]>> = {
  SP: {
    "São Paulo": ["Centro", "Pinheiros", "Moema", "Itaim Bibi", "Vila Mariana", "Santana", "Tatuapé"],
    "Sorocaba": ["Centro", "Campolim", "Além Ponte", "Trujillo", "Mangal"],
    "Campinas": ["Cambuí", "Centro", "Barão Geraldo", "Taquaral", "Guanabara"],
    "Ribeirão Preto": ["Centro", "Jardim Paulista", "Bonfim Paulista", "Ipiranga"],
    "Santos": ["Gonzaga", "Boqueirão", "Ponta da Praia", "Embaré"],
  },
  GO: {
    "Goiânia": ["Setor Bueno", "Setor Marista", "Setor Oeste", "Centro", "Jardim Goiás"],
    "Anápolis": ["Jundiaí", "Centro", "Maracanã", "Cidade Jardim"],
    "Aparecida de Goiânia": ["Centro", "Vila Brasília", "Garavelo"],
  },
  DF: {
    "Brasília": ["Asa Sul", "Asa Norte", "Sudoeste", "Águas Claras", "Taguatinga", "Guará"],
  },
  RJ: {
    "Rio de Janeiro": ["Copacabana", "Ipanema", "Barra da Tijuca", "Botafogo", "Tijuca", "Centro"],
    "Niterói": ["Icaraí", "Ingá", "Centro", "Santa Rosa"],
  },
  MG: {
    "Belo Horizonte": ["Savassi", "Lourdes", "Funcionários", "Centro", "Pampulha"],
    "Uberlândia": ["Centro", "Santa Mônica", "Fundinho"],
  },
  PR: {
    "Curitiba": ["Batel", "Centro", "Bigorrilho", "Água Verde", "Cabral"],
    "Londrina": ["Centro", "Gleba Palhano"],
  },
  RS: {
    "Porto Alegre": ["Moinhos de Vento", "Bela Vista", "Centro Histórico", "Menino Deus"],
    "Caxias do Sul": ["Centro", "Pellegrino", "São Pelegrino"],
  },
  BA: {
    "Salvador": ["Pituba", "Barra", "Graça", "Itaigara", "Brotas"],
  },
  SC: {
    "Florianópolis": ["Centro", "Trindade", "Agronômica", "Itacorubi"],
  },
  PE: {
    "Recife": ["Boa Viagem", "Graças", "Espinheiro", "Casa Forte"],
  },
  CE: {
    "Fortaleza": ["Aldeota", "Meireles", "Cocó", "Centro"],
  },
};

// Base inicial com os 5 leads da imagem + 37 leads adicionais realistas (total 42)
let MOCK_DATABASE: LeadItem[] = [
  // 1 a 5: EXATAMENTE os da imagem de referência
  {
    id: "lead-1",
    nome: "Farmácia Vital",
    cnpj: "12.345.678/0001-90",
    cidade: "Sorocaba",
    uf: "SP",
    bairro: "Centro",
    telefone: "(15) 99123-4567",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua Quinze de Novembro, 240, Centro, Sorocaba - SP",
    categoria: "Farmácia de Manipulação e Drogaria",
    site: "https://farmaciavital.com.br",
    email: "contato@farmaciavital.com.br",
    avaliacao: 4.8,
    qtdAvaliacoes: 142,
    dataCriacao: "2026-10-15T14:30:00Z",
  },
  {
    id: "lead-2",
    nome: "Drogaria São Bento",
    cnpj: "98.765.432/0001-11",
    cidade: "Campinas",
    uf: "SP",
    bairro: "Cambuí",
    telefone: "(19) 98877-6655",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Av. Coronel Silva Telles, 580, Cambuí, Campinas - SP",
    categoria: "Drogaria e Medicamentos Especiais",
    site: "https://drogariasaobento.com.br",
    email: "atendimento@saobento.com.br",
    avaliacao: 4.6,
    qtdAvaliacoes: 98,
    dataCriacao: "2026-10-18T10:15:00Z",
  },
  {
    id: "lead-3",
    nome: "Farmácia Boa Saúde",
    cnpj: "45.678.901/0001-22",
    cidade: "Goiânia",
    uf: "GO",
    bairro: "Setor Bueno",
    telefone: "(62) 98234-1122",
    status: "Respondido",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. T-63, 1102, Setor Bueno, Goiânia - GO",
    categoria: "Farmácia e Perfumaria",
    site: "https://boasaudego.com.br",
    email: "comercial@boasaudego.com.br",
    avaliacao: 4.7,
    qtdAvaliacoes: 215,
    dataCriacao: "2026-10-20T16:45:00Z",
  },
  {
    id: "lead-4",
    nome: "Drogaria Progresso",
    cnpj: "56.789.012/0001-33",
    cidade: "Brasília",
    uf: "DF",
    bairro: "Asa Sul",
    telefone: "(61) 99321-7788",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Outras fontes",
    endereco: "CLS 308 Bloco B Loja 14, Asa Sul, Brasília - DF",
    categoria: "Drogaria e Conveniência",
    site: "https://drogariaprogresso.com.br",
    email: "progresso.bsb@gmail.com",
    avaliacao: 4.2,
    qtdAvaliacoes: 64,
    dataCriacao: "2026-10-22T11:00:00Z",
  },
  {
    id: "lead-5",
    nome: "Farmácia Central",
    cnpj: "23.456.789/0001-44",
    cidade: "São Paulo",
    uf: "SP",
    bairro: "Pinheiros",
    telefone: "(11) 97654-3210",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua dos Pinheiros, 720, Pinheiros, São Paulo - SP",
    categoria: "Farmácia Tradicional e Homeopatia",
    site: "https://farmaciacentralsp.com.br",
    email: "gerencia@farmaciacentralsp.com.br",
    avaliacao: 4.9,
    qtdAvaliacoes: 380,
    dataCriacao: "2026-10-24T09:20:00Z",
  },
  // Demais leads fictícios com dados realistas
  {
    id: "lead-6",
    nome: "Drogaria Santa Marta",
    cnpj: "34.567.890/0001-55",
    cidade: "Goiânia",
    uf: "GO",
    bairro: "Setor Marista",
    telefone: "(62) 99112-3344",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Rua 137, 45, Setor Marista, Goiânia - GO",
    categoria: "Drogaria",
    email: "marista@santamarta.com.br",
    avaliacao: 4.5,
    qtdAvaliacoes: 110,
    dataCriacao: "2026-10-25T15:10:00Z",
  },
  {
    id: "lead-7",
    nome: "Farmácia Alquimia Manipulação",
    cnpj: "67.890.123/0001-66",
    cidade: "Belo Horizonte",
    uf: "MG",
    bairro: "Savassi",
    telefone: "(31) 98765-4321",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua Pernambuco, 1200, Savassi, Belo Horizonte - MG",
    categoria: "Farmácia de Manipulação",
    site: "https://alquimiamanipulacao.com.br",
    email: "sac@alquimiamanipulacao.com.br",
    avaliacao: 4.9,
    qtdAvaliacoes: 230,
    dataCriacao: "2026-10-26T14:00:00Z",
  },
  {
    id: "lead-8",
    nome: "Drogaria Nova Era",
    cnpj: "78.901.234/0001-77",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    bairro: "Copacabana",
    telefone: "(21) 99455-8822",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Nossa Senhora de Copacabana, 820, Copacabana - RJ",
    categoria: "Drogaria 24 Horas",
    avaliacao: 4.3,
    qtdAvaliacoes: 175,
    dataCriacao: "2026-10-26T16:30:00Z",
  },
  {
    id: "lead-9",
    nome: "Farmácia Vida & Equilíbrio",
    cnpj: "89.012.345/0001-88",
    cidade: "Curitiba",
    uf: "PR",
    bairro: "Batel",
    telefone: "(41) 99233-7711",
    status: "Respondido",
    responsavel: "Comercial Centrus",
    origem: "Outras fontes",
    endereco: "Av. do Batel, 1600, Batel, Curitiba - PR",
    categoria: "Homeopatia e Florais",
    site: "https://vidaeequilibrio.com.br",
    email: "curitiba@vidaeequilibrio.com.br",
    avaliacao: 4.8,
    qtdAvaliacoes: 89,
    dataCriacao: "2026-10-27T10:00:00Z",
  },
  {
    id: "lead-10",
    nome: "Drogaria São Paulo Moema",
    cnpj: "10.234.567/0001-99",
    cidade: "São Paulo",
    uf: "SP",
    bairro: "Moema",
    telefone: "(11) 98122-4455",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Av. Moema, 310, Moema, São Paulo - SP",
    categoria: "Drogaria e Vacinas",
    avaliacao: 4.4,
    qtdAvaliacoes: 310,
    dataCriacao: "2026-10-27T13:20:00Z",
  },
  {
    id: "lead-11",
    nome: "Farmácia Dermocosmética",
    cnpj: "21.345.678/0001-01",
    cidade: "Porto Alegre",
    uf: "RS",
    bairro: "Moinhos de Vento",
    telefone: "(51) 99888-2211",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua Padre Chagas, 215, Moinhos de Vento - RS",
    categoria: "Manipulação Dermatológica",
    site: "https://dermocosmetica.com.br",
    email: "lab@dermocosmetica.com.br",
    avaliacao: 5.0,
    qtdAvaliacoes: 160,
    dataCriacao: "2026-10-28T09:15:00Z",
  },
  {
    id: "lead-12",
    nome: "Drogaria Bem Viver",
    cnpj: "32.456.789/0001-12",
    cidade: "Salvador",
    uf: "BA",
    bairro: "Pituba",
    telefone: "(71) 99344-5566",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Av. Manoel Dias da Silva, 1420, Pituba, Salvador - BA",
    categoria: "Drogaria Popular",
    avaliacao: 4.1,
    qtdAvaliacoes: 72,
    dataCriacao: "2026-10-28T11:40:00Z",
  },
  {
    id: "lead-13",
    nome: "Farmácia Magistral Floripa",
    cnpj: "43.567.890/0001-23",
    cidade: "Florianópolis",
    uf: "SC",
    bairro: "Centro",
    telefone: "(48) 99111-7788",
    status: "Respondido",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua Felipe Schmidt, 400, Centro, Florianópolis - SC",
    categoria: "Fórmulas Personalizadas",
    site: "https://magistralfloripa.com.br",
    email: "pedidos@magistralfloripa.com.br",
    avaliacao: 4.7,
    qtdAvaliacoes: 95,
    dataCriacao: "2026-10-28T15:00:00Z",
  },
  {
    id: "lead-14",
    nome: "Drogaria Recife Farma",
    cnpj: "54.678.901/0001-34",
    cidade: "Recife",
    uf: "PE",
    bairro: "Boa Viagem",
    telefone: "(81) 98777-1234",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Outras fontes",
    endereco: "Av. Conselheiro Aguiar, 2800, Boa Viagem, Recife - PE",
    categoria: "Drogaria e Cosméticos",
    avaliacao: 4.2,
    qtdAvaliacoes: 58,
    dataCriacao: "2026-10-29T10:30:00Z",
  },
  {
    id: "lead-15",
    nome: "Farmácia Artesanal Ceará",
    cnpj: "65.789.012/0001-45",
    cidade: "Fortaleza",
    uf: "CE",
    bairro: "Aldeota",
    telefone: "(85) 99222-8899",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Santos Dumont, 3131, Aldeota, Fortaleza - CE",
    categoria: "Manipulação e Nutracêuticos",
    site: "https://artesanalceara.com.br",
    email: "comercial@artesanalceara.com.br",
    avaliacao: 4.9,
    qtdAvaliacoes: 210,
    dataCriacao: "2026-10-29T14:15:00Z",
  },
  {
    id: "lead-16",
    nome: "Drogaria Campolim",
    cnpj: "76.890.123/0001-56",
    cidade: "Sorocaba",
    uf: "SP",
    bairro: "Campolim",
    telefone: "(15) 99765-1122",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Av. Antônio Carlos Comitre, 900, Campolim, Sorocaba - SP",
    categoria: "Drogaria",
    avaliacao: 4.6,
    qtdAvaliacoes: 130,
    dataCriacao: "2026-10-30T09:00:00Z",
  },
  {
    id: "lead-17",
    nome: "Farmácia Biofórmula",
    cnpj: "87.901.234/0001-67",
    cidade: "Campinas",
    uf: "SP",
    bairro: "Taquaral",
    telefone: "(19) 98455-3344",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Nossa Senhora de Fátima, 500, Taquaral, Campinas - SP",
    categoria: "Farmácia de Manipulação",
    avaliacao: 4.4,
    qtdAvaliacoes: 84,
    dataCriacao: "2026-10-30T11:20:00Z",
  },
  {
    id: "lead-18",
    nome: "Drogaria Capital Sul",
    cnpj: "98.012.345/0001-78",
    cidade: "Brasília",
    uf: "DF",
    bairro: "Sudoeste",
    telefone: "(61) 98111-9900",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "CLSW 104 Bloco C, Sudoeste, Brasília - DF",
    categoria: "Drogaria Premium",
    site: "https://capitalsul.com.br",
    email: "gerente@capitalsul.com.br",
    avaliacao: 4.8,
    qtdAvaliacoes: 154,
    dataCriacao: "2026-10-30T16:00:00Z",
  },
  {
    id: "lead-19",
    nome: "Farmácia Botânica",
    cnpj: "19.123.456/0001-89",
    cidade: "São Paulo",
    uf: "SP",
    bairro: "Itaim Bibi",
    telefone: "(11) 99654-7788",
    status: "Respondido",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Rua Joaquim Floriano, 466, Itaim Bibi, São Paulo - SP",
    categoria: "Fitoterápicos e Suplementação",
    site: "https://botanicasp.com.br",
    email: "falecom@botanicasp.com.br",
    avaliacao: 4.9,
    qtdAvaliacoes: 275,
    dataCriacao: "2026-10-31T10:10:00Z",
  },
  {
    id: "lead-20",
    nome: "Drogaria Barra Farma",
    cnpj: "20.234.567/0001-90",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    bairro: "Barra da Tijuca",
    telefone: "(21) 98566-4433",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. das Américas, 4666, Barra da Tijuca, Rio de Janeiro - RJ",
    categoria: "Rede de Drogarias",
    avaliacao: 4.5,
    qtdAvaliacoes: 190,
    dataCriacao: "2026-10-31T14:40:00Z",
  },
  {
    id: "lead-21",
    nome: "Farmácia Naturalis",
    cnpj: "31.345.678/0001-01",
    cidade: "Belo Horizonte",
    uf: "MG",
    bairro: "Lourdes",
    telefone: "(31) 99122-6677",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Outras fontes",
    endereco: "Rua Curitiba, 1850, Lourdes, Belo Horizonte - MG",
    categoria: "Produtos Naturais e Manipulação",
    avaliacao: 4.3,
    qtdAvaliacoes: 62,
    dataCriacao: "2026-11-01T08:30:00Z",
  },
  {
    id: "lead-22",
    nome: "Drogaria Saúde Plena",
    cnpj: "42.456.789/0001-12",
    cidade: "Santos",
    uf: "SP",
    bairro: "Gonzaga",
    telefone: "(13) 99788-3344",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Ana Costa, 480, Gonzaga, Santos - SP",
    categoria: "Drogaria e Conveniência",
    site: "https://saudeplenasantos.com.br",
    email: "contato@saudeplenasantos.com.br",
    avaliacao: 4.7,
    qtdAvaliacoes: 145,
    dataCriacao: "2026-11-01T11:15:00Z",
  },
  {
    id: "lead-23",
    nome: "Farmácia Farmavida",
    cnpj: "53.567.890/0001-23",
    cidade: "Ribeirão Preto",
    uf: "SP",
    bairro: "Jardim Paulista",
    telefone: "(16) 99233-5566",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Av. Treze de Maio, 1050, Jardim Paulista, Ribeirão Preto - SP",
    categoria: "Drogaria",
    avaliacao: 4.4,
    qtdAvaliacoes: 99,
    dataCriacao: "2026-11-01T15:20:00Z",
  },
  {
    id: "lead-24",
    nome: "Drogaria Popular Goiana",
    cnpj: "64.678.901/0001-34",
    cidade: "Goiânia",
    uf: "GO",
    bairro: "Centro",
    telefone: "(62) 98444-1122",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Goiás, 620, Centro, Goiânia - GO",
    categoria: "Drogaria Popular",
    avaliacao: 4.0,
    qtdAvaliacoes: 80,
    dataCriacao: "2026-11-02T09:40:00Z",
  },
  {
    id: "lead-25",
    nome: "Farmácia Essência Divina",
    cnpj: "75.789.012/0001-45",
    cidade: "Curitiba",
    uf: "PR",
    bairro: "Bigorrilho",
    telefone: "(41) 98855-6677",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua Padre Anchieta, 2040, Bigorrilho, Curitiba - PR",
    categoria: "Manipulação de Alta Precisão",
    site: "https://essenciadivina.com.br",
    email: "sac@essenciadivina.com.br",
    avaliacao: 4.9,
    qtdAvaliacoes: 188,
    dataCriacao: "2026-11-02T13:10:00Z",
  },
  {
    id: "lead-26",
    nome: "Drogaria Asa Norte",
    cnpj: "86.890.123/0001-56",
    cidade: "Brasília",
    uf: "DF",
    bairro: "Asa Norte",
    telefone: "(61) 99433-2211",
    status: "Respondido",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "CLN 108 Bloco D, Asa Norte, Brasília - DF",
    categoria: "Drogaria e Bem-estar",
    avaliacao: 4.5,
    qtdAvaliacoes: 120,
    dataCriacao: "2026-11-02T16:50:00Z",
  },
  {
    id: "lead-27",
    nome: "Farmácia DermatoFarma",
    cnpj: "97.901.234/0001-67",
    cidade: "São Paulo",
    uf: "SP",
    bairro: "Vila Mariana",
    telefone: "(11) 98777-8899",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua Domingos de Morais, 1340, Vila Mariana, São Paulo - SP",
    categoria: "Dermatologia e Fórmulas",
    avaliacao: 4.6,
    qtdAvaliacoes: 140,
    dataCriacao: "2026-11-03T10:00:00Z",
  },
  {
    id: "lead-28",
    nome: "Drogaria Niterói Express",
    cnpj: "18.012.345/0001-78",
    cidade: "Niterói",
    uf: "RJ",
    bairro: "Icaraí",
    telefone: "(21) 99233-1144",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Outras fontes",
    endereco: "Rua Coronel Moreira César, 210, Icaraí, Niterói - RJ",
    categoria: "Drogaria Express",
    avaliacao: 4.3,
    qtdAvaliacoes: 87,
    dataCriacao: "2026-11-03T14:30:00Z",
  },
  {
    id: "lead-29",
    nome: "Farmácia Fórmula & Arte",
    cnpj: "29.123.456/0001-89",
    cidade: "Uberlândia",
    uf: "MG",
    bairro: "Centro",
    telefone: "(34) 99188-4455",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Afonso Pena, 890, Centro, Uberlândia - MG",
    categoria: "Farmácia de Manipulação",
    site: "https://formulaearte.com.br",
    email: "atendimento@formulaearte.com.br",
    avaliacao: 4.8,
    qtdAvaliacoes: 165,
    dataCriacao: "2026-11-03T17:00:00Z",
  },
  {
    id: "lead-30",
    nome: "Drogaria Londrina Saúde",
    cnpj: "30.234.567/0001-90",
    cidade: "Londrina",
    uf: "PR",
    bairro: "Gleba Palhano",
    telefone: "(43) 98844-3322",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Av. Ayrton Senna da Silva, 500, Gleba Palhano, Londrina - PR",
    categoria: "Drogaria e Vacinação",
    avaliacao: 4.5,
    qtdAvaliacoes: 104,
    dataCriacao: "2026-11-04T08:50:00Z",
  },
  {
    id: "lead-31",
    nome: "Farmácia Magistrale RS",
    cnpj: "41.345.678/0001-01",
    cidade: "Caxias do Sul",
    uf: "RS",
    bairro: "São Pelegrino",
    telefone: "(54) 99655-2233",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Júlio de Castilhos, 1800, São Pelegrino, Caxias do Sul - RS",
    categoria: "Manipulação e Homeopatia",
    avaliacao: 4.7,
    qtdAvaliacoes: 112,
    dataCriacao: "2026-11-04T11:20:00Z",
  },
  {
    id: "lead-32",
    nome: "Drogaria Barra Salvador",
    cnpj: "52.456.789/0001-12",
    cidade: "Salvador",
    uf: "BA",
    bairro: "Barra",
    telefone: "(71) 98711-4455",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Oceânica, 550, Barra, Salvador - BA",
    categoria: "Drogaria Beira-mar",
    site: "https://barrasalvadorfarma.com.br",
    email: "gerencia@barrasalvadorfarma.com.br",
    avaliacao: 4.6,
    qtdAvaliacoes: 140,
    dataCriacao: "2026-11-04T14:10:00Z",
  },
  {
    id: "lead-33",
    nome: "Farmácia Trindade Manipulação",
    cnpj: "63.567.890/0001-23",
    cidade: "Florianópolis",
    uf: "SC",
    bairro: "Trindade",
    telefone: "(48) 99877-3322",
    status: "Respondido",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Rua Lauro Linhares, 1200, Trindade, Florianópolis - SC",
    categoria: "Manipulação Universitária",
    avaliacao: 4.8,
    qtdAvaliacoes: 178,
    dataCriacao: "2026-11-04T16:30:00Z",
  },
  {
    id: "lead-34",
    nome: "Drogaria Graças Farma",
    cnpj: "74.678.901/0001-34",
    cidade: "Recife",
    uf: "PE",
    bairro: "Graças",
    telefone: "(81) 99155-7788",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Outras fontes",
    endereco: "Rua das Graças, 410, Graças, Recife - PE",
    categoria: "Drogaria Tradicional",
    avaliacao: 4.2,
    qtdAvaliacoes: 65,
    dataCriacao: "2026-11-04T18:00:00Z",
  },
  {
    id: "lead-35",
    nome: "Farmácia Meireles Farma",
    cnpj: "85.789.012/0001-45",
    cidade: "Fortaleza",
    uf: "CE",
    bairro: "Meireles",
    telefone: "(85) 98833-2244",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Av. Beira Mar, 2200, Meireles, Fortaleza - CE",
    categoria: "Drogaria e Cosméticos Premium",
    site: "https://meirelesfarma.com.br",
    email: "contato@meirelesfarma.com.br",
    avaliacao: 4.9,
    qtdAvaliacoes: 240,
    dataCriacao: "2026-11-04T19:30:00Z",
  },
  {
    id: "lead-36",
    nome: "Drogaria Tatuapé Mais",
    cnpj: "96.890.123/0001-56",
    cidade: "São Paulo",
    uf: "SP",
    bairro: "Tatuapé",
    telefone: "(11) 99344-1122",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Rua Tuiuti, 1850, Tatuapé, São Paulo - SP",
    categoria: "Drogaria Popular",
    avaliacao: 4.4,
    qtdAvaliacoes: 125,
    dataCriacao: "2026-11-04T20:15:00Z",
  },
  {
    id: "lead-37",
    nome: "Farmácia Homeopática Campinas",
    cnpj: "07.901.234/0001-67",
    cidade: "Campinas",
    uf: "SP",
    bairro: "Centro",
    telefone: "(19) 99211-4455",
    status: "Não contatado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Rua Barão de Jaguara, 1100, Centro, Campinas - SP",
    categoria: "Homeopatia e Antroposofia",
    avaliacao: 4.7,
    qtdAvaliacoes: 88,
    dataCriacao: "2026-11-04T20:45:00Z",
  },
  {
    id: "lead-38",
    nome: "Drogaria Águas Claras",
    cnpj: "18.012.345/0001-78",
    cidade: "Brasília",
    uf: "DF",
    bairro: "Águas Claras",
    telefone: "(61) 98455-6677",
    status: "Qualificado",
    responsavel: "Comercial Centrus",
    origem: "Google Maps",
    endereco: "Avenida das Araucárias, 1305, Águas Claras, Brasília - DF",
    categoria: "Drogaria 24h",
    site: "https://aguasclarasfarma.com.br",
    email: "atendimento@aguasclarasfarma.com.br",
    avaliacao: 4.7,
    qtdAvaliacoes: 170,
    dataCriacao: "2026-11-04T21:10:00Z",
  },
  {
    id: "lead-39",
    nome: "Farmácia Botanik Jardim Goiás",
    cnpj: "29.123.456/0001-89",
    cidade: "Goiânia",
    uf: "GO",
    bairro: "Jardim Goiás",
    telefone: "(62) 99555-8899",
    status: "Em contato",
    responsavel: "Comercial Centrus",
    origem: "Outras fontes",
    endereco: "Av. Deputado Jamel Cecílio, 2690, Jardim Goiás, Goiânia - GO",
    categoria: "Manipulação e Dermato",
    avaliacao: 4.8,
    qtdAvaliacoes: 135,
    dataCriacao: "2026-11-04T21:30:00Z",
  },
  {
    id: "lead-40",
    nome: "Drogaria Além Ponte",
    cnpj: "30.234.567/0001-90",
    cidade: "Sorocaba",
    uf: "SP",
    bairro: "Além Ponte",
    telefone: "(15) 98122-3344",
    status: "Respondido",
    responsavel: "Comercial Centrus",
    origem: "Google Meu Negócio",
    endereco: "Rua Coronel Nogueira Padilha, 580, Além Ponte, Sorocaba - SP",
    categoria: "Drogaria de Bairro",
    avaliacao: 4.3,
    qtdAvaliacoes: 79,
    dataCriacao: "2026-11-04T21:50:00Z",
  },
];

/**
 * Função assíncrona simulando endpoint do Supabase com filtros no servidor
 */
export async function fetchMockLeads(params: LeadFilterParams): Promise<LeadPaginationResult> {
  // Simula latência de rede realista (180ms)
  await new Promise((resolve) => setTimeout(resolve, 180));

  const {
    query = "",
    statusTab = "Todos",
    uf = "",
    municipio = "",
    bairro = "",
    statusSelect = "",
    origem = "",
    page = 1,
    pageSize = 5,
  } = params;

  let filtered = [...MOCK_DATABASE];

  // 1. Filtro da Aba rápida (Pills)
  if (statusTab && statusTab !== "Todos") {
    filtered = filtered.filter((item) => item.status === statusTab);
  }

  // 2. Filtro do Select de Status da coluna lateral
  if (statusSelect && statusSelect !== "Todos os status") {
    filtered = filtered.filter((item) => item.status === statusSelect);
  }

  // 3. Filtro de Origem
  if (origem && origem !== "Todas as origens") {
    filtered = filtered.filter((item) => item.origem === origem);
  }

  // 4. Filtro de UF
  if (uf && uf !== "Selecionar UF(s)" && uf !== "Todas as UFs") {
    filtered = filtered.filter((item) => item.uf === uf);
  }

  // 5. Filtro de Município
  if (municipio && municipio !== "Selecionar município" && municipio !== "Todos os municípios") {
    filtered = filtered.filter((item) => item.cidade.toLowerCase() === municipio.toLowerCase());
  }

  // 6. Filtro de Bairro
  if (bairro && bairro !== "Selecionar bairro" && bairro !== "Todos os bairros") {
    filtered = filtered.filter((item) => item.bairro.toLowerCase() === bairro.toLowerCase());
  }

  // 7. Busca textual (nome, cnpj, cidade, telefone, categoria)
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.nome.toLowerCase().includes(q) ||
        item.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        item.cidade.toLowerCase().includes(q) ||
        item.uf.toLowerCase().includes(q) ||
        item.telefone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        (item.bairro && item.bairro.toLowerCase().includes(q)) ||
        (item.categoria && item.categoria.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * Retorna as estatísticas resumidas
 */
export async function fetchMockSummary(): Promise<LeadSummary> {
  return MOCK_SUMMARY;
}

/**
 * Atualiza o status de um lead no banco mockado
 */
export async function updateLeadStatus(id: string, newStatus: LeadStatus): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const lead = MOCK_DATABASE.find((item) => item.id === id);
  if (!lead) return false;
  lead.status = newStatus;
  return true;
}

/**
 * Atualiza status em lote
 */
export async function batchUpdateStatus(ids: string[], newStatus: LeadStatus): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const idSet = new Set(ids);
  MOCK_DATABASE.forEach((item) => {
    if (idSet.has(item.id)) {
      item.status = newStatus;
    }
  });
  return true;
}

/**
 * Remove um lead do banco mockado
 */
export async function deleteLead(id: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const initialLength = MOCK_DATABASE.length;
  MOCK_DATABASE = MOCK_DATABASE.filter((item) => item.id !== id);
  return MOCK_DATABASE.length < initialLength;
}

/**
 * Helpers para selects cascateados
 */
export function getUFs(): string[] {
  return Object.keys(LOCATIONS_HIERARCHY).sort();
}

export function getMunicipios(uf: string): string[] {
  if (!uf || !LOCATIONS_HIERARCHY[uf]) return [];
  return Object.keys(LOCATIONS_HIERARCHY[uf]).sort();
}

export function getBairros(uf: string, municipio: string): string[] {
  if (!uf || !municipio || !LOCATIONS_HIERARCHY[uf] || !LOCATIONS_HIERARCHY[uf][municipio]) {
    return [];
  }
  return LOCATIONS_HIERARCHY[uf][municipio].sort();
}


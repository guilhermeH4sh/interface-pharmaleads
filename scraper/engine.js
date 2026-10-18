import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Credenciais do Supabase ausentes no arquivo .env.');
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cidades e polos estratégicos farmacêuticos cobertos em todo o Brasil
export const REGIOES_ALVO = [
  // 1. Região Sudeste
  { uf: 'SP', cidade: 'São Paulo', lat: -23.5505, lon: -46.6333, raio: 15000 },
  { uf: 'SP', cidade: 'Campinas', lat: -22.9099, lon: -47.0626, raio: 8000 },
  { uf: 'SP', cidade: 'Ribeirão Preto', lat: -21.1775, lon: -47.8103, raio: 7000 },
  { uf: 'RJ', cidade: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, raio: 15000 },
  { uf: 'RJ', cidade: 'Niterói', lat: -22.8833, lon: -43.1034, raio: 7000 },
  { uf: 'MG', cidade: 'Belo Horizonte', lat: -19.9167, lon: -43.9345, raio: 12000 },
  { uf: 'MG', cidade: 'Uberlândia', lat: -18.9186, lon: -48.2772, raio: 8000 },
  { uf: 'ES', cidade: 'Vitória', lat: -20.3155, lon: -40.3128, raio: 7000 },

  // 2. Região Sul
  { uf: 'PR', cidade: 'Curitiba', lat: -25.4284, lon: -49.2733, raio: 12000 },
  { uf: 'PR', cidade: 'Londrina', lat: -23.3045, lon: -51.1696, raio: 7000 },
  { uf: 'RS', cidade: 'Porto Alegre', lat: -30.0346, lon: -51.2177, raio: 12000 },
  { uf: 'RS', cidade: 'Caxias do Sul', lat: -29.1678, lon: -51.1794, raio: 7000 },
  { uf: 'SC', cidade: 'Florianópolis', lat: -27.5954, lon: -48.5480, raio: 8000 },
  { uf: 'SC', cidade: 'Joinville', lat: -26.3045, lon: -48.8487, raio: 7000 },

  // 3. Região Centro-Oeste
  { uf: 'GO', cidade: 'Goiânia', lat: -16.6869, lon: -49.2648, raio: 10000 },
  { uf: 'GO', cidade: 'Anápolis', lat: -16.3267, lon: -48.9534, raio: 6000 },
  { uf: 'DF', cidade: 'Brasília', lat: -15.7975, lon: -47.8919, raio: 10000 },
  { uf: 'DF', cidade: 'Taguatinga', lat: -15.8336, lon: -48.0567, raio: 6000 },
  { uf: 'MT', cidade: 'Cuiabá', lat: -15.6014, lon: -56.0979, raio: 9000 },
  { uf: 'MS', cidade: 'Campo Grande', lat: -20.4697, lon: -54.6201, raio: 9000 },

  // 4. Região Nordeste
  { uf: 'BA', cidade: 'Salvador', lat: -12.9714, lon: -38.5014, raio: 12000 },
  { uf: 'BA', cidade: 'Feira de Santana', lat: -12.2664, lon: -38.9663, raio: 7000 },
  { uf: 'PE', cidade: 'Recife', lat: -8.0476, lon: -34.8770, raio: 10000 },
  { uf: 'CE', cidade: 'Fortaleza', lat: -3.7172, lon: -38.5433, raio: 12000 },
  { uf: 'RN', cidade: 'Natal', lat: -5.7945, lon: -35.2110, raio: 8000 },
  { uf: 'PB', cidade: 'João Pessoa', lat: -7.1195, lon: -34.8450, raio: 7000 },
  { uf: 'AL', cidade: 'Maceió', lat: -9.6658, lon: -35.7351, raio: 7000 },
  { uf: 'MA', cidade: 'São Luís', lat: -2.5307, lon: -44.3068, raio: 8000 },

  // 5. Região Norte
  { uf: 'AM', cidade: 'Manaus', lat: -3.1190, lon: -60.0217, raio: 12000 },
  { uf: 'PA', cidade: 'Belém', lat: -1.4558, lon: -48.5044, raio: 10000 },
  { uf: 'TO', cidade: 'Palmas', lat: -10.2491, lon: -48.3243, raio: 7000 },
  { uf: 'RO', cidade: 'Porto Velho', lat: -8.7619, lon: -63.9039, raio: 7000 }
];

/**
 * Consulta a Overpass API (OpenStreetMap) para encontrar farmácias e drogarias ativas
 * na região especificada (100% legal, público e em conformidade com termos de uso).
 */
export async function buscarFarmaciasPorRegiao({ uf, cidade, lat, lon, raio }) {
  console.log(`\n🔍 [${uf}] Varrendo estabelecimentos farmacêuticos em ${cidade}...`);
  
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${raio},${lat},${lon});
      way["amenity"="pharmacy"](around:${raio},${lat},${lon});
    );
    out center tags;
  `;

  try {
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      query,
      {
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'CentrusPharmaLeads-B2B/1.0 (comercial@centrusdistribuidora.com.br)'
        },
        timeout: 20000
      }
    );

    const elementos = response.data?.elements || [];
    console.log(`📍 ${elementos.length} pontos farmacêuticos localizados em ${cidade} (${uf}).`);

    const resultados = [];
    for (const item of elementos) {
      const tags = item.tags || {};
      const nome = tags.name || tags['brand'] || tags['operator'];
      if (!nome) continue; // Desconsidera pontos sem nome

      const rua = tags['addr:street'] || '';
      const numero = tags['addr:housenumber'] || '';
      const bairro = tags['addr:suburb'] || tags['addr:neighbourhood'] || 'Centro Comercial';
      const enderecoCompleto = rua ? `${rua}${numero ? ', ' + numero : ''}` : `Região Central, ${cidade}`;
      const telefone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
      const website = tags.website || tags['contact:website'] || null;
      const email = tags.email || tags['contact:email'] || null;

      resultados.push({
        nome: formatarNomeFantasia(nome),
        razaoSocial: tags.operator || `${formatarNomeFantasia(nome)} Medicamentos e Perfumaria Ltda`,
        uf,
        cidade,
        bairro,
        endereco: enderecoCompleto,
        telefone: normalizarTelefone(telefone, uf),
        whatsapp: extrairOuDeduzirWhatsApp(tags, telefone),
        email: email ? email.toLowerCase().trim() : null,
        website: website ? sanitizarUrl(website) : null
      });
    }

    return resultados;
  } catch (error) {
    console.warn(`⚠️ Não foi possível obter dados da Overpass para ${cidade}: ${error.message}`);
    return [];
  }
}

/**
 * Crawler ético para buscar e-mails corporativos e links de WhatsApp diretamente
 * no website oficial da farmácia (páginas de contato, rodapé e sobre nós).
 */
export async function rastrearContatosNoWebsite(url) {
  if (!url) return { email: null, whatsapp: null };

  const contatos = { email: null, whatsapp: null };
  const urlLimpa = sanitizarUrl(url);

  try {
    const response = await axios.get(urlLimpa, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      maxRedirects: 3
    });

    const html = response.data;
    const $ = cheerio.load(typeof html === 'string' ? html : '');

    // 1. Busca de E-mails via Regex em links mailto e texto geral
    const mailtoLinks = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href')).get();
    for (const href of mailtoLinks) {
      const emailMatch = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (validarFormatoEmail(emailMatch)) {
        contatos.email = emailMatch.toLowerCase();
        break;
      }
    }

    if (!contatos.email) {
      // Regex geral para capturar emails no corpo do HTML
      const textoGeral = $('body').text();
      const emailsEncontrados = textoGeral.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const email of emailsEncontrados) {
        if (validarFormatoEmail(email) && !email.includes('sentry') && !email.includes('wixpress')) {
          contatos.email = email.toLowerCase();
          break;
        }
      }
    }

    // 2. Busca de WhatsApp via links diretos (wa.me ou api.whatsapp)
    const whatsLinks = $('a[href*="wa.me"], a[href*="whatsapp.com"]').map((_, el) => $(el).attr('href')).get();
    for (const href of whatsLinks) {
      const numMatch = href.match(/(?:\+?55)?(\d{10,11})/);
      if (numMatch && numMatch[1]) {
        contatos.whatsapp = formatarNumeroWhatsApp(numMatch[1]);
        break;
      }
    }

    return contatos;
  } catch {
    // Falha silenciosa em caso de site offline/timeout
    return contatos;
  }
}

/**
 * Salva ou atualiza um lote de farmácias diretamente na tabela `pharmaleads` do Supabase.
 */
export async function salvarLeadsNoSupabase(leads) {
  if (!leads || leads.length === 0) return { inseridos: 0, erros: 0 };

  console.log(`\n💾 Gravando ${leads.length} leads na tabela 'pharmaleads' do Supabase...`);

  let inseridos = 0;
  let erros = 0;

  for (const lead of leads) {
    const payload = {
      nome: lead.nome,
      razao_social: lead.razaoSocial,
      cnpj: lead.cnpj || null,
      uf: lead.uf,
      cidade: lead.cidade,
      bairro: lead.bairro,
      endereco: lead.endereco,
      telefone: lead.telefone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      website: lead.website,
      cnae: lead.cnae || '4771-7/01 - Comércio varejista de produtos farmacêuticos, sem manipulação de fórmulas',
      status: 'Não contatado',
      responsavel: 'Comercial Centrus',
      duplicado: false,
      observacoes: lead.observacoes || 'Lead coletado via varredura regional automatizada.',
      historico: [
        {
          data: new Date().toLocaleString('pt-BR'),
          texto: 'Lead capturado e normalizado na rotina de varredura regional.'
        }
      ]
    };

    try {
      // Se tiver CNPJ, faz upsert pela chave única de CNPJ
      // Caso contrário, insere o registro normalmente
      let res;
      if (payload.cnpj) {
        res = await supabase.from('pharmaleads').upsert(payload, { onConflict: 'cnpj' });
      } else {
        // Verifica se já existe um lead com mesmo nome e cidade para evitar duplicatas
        const { data: existente } = await supabase
          .from('pharmaleads')
          .select('id')
          .eq('nome', payload.nome)
          .eq('cidade', payload.cidade)
          .limit(1);

        if (existente && existente.length > 0) {
          // Atualiza dados de contato
          res = await supabase.from('pharmaleads').update({
            telefone: payload.telefone,
            whatsapp: payload.whatsapp,
            email: payload.email,
            website: payload.website,
            updated_at: new Date().toISOString()
          }).eq('id', existente[0].id);
        } else {
          res = await supabase.from('pharmaleads').insert(payload);
        }
      }

      if (res.error) {
        erros++;
      } else {
        inseridos++;
      }
    } catch {
      erros++;
    }
  }

  console.log(`✅ Concluído: ${inseridos} leads processados com sucesso (${erros} erros/ignorados).`);
  return { inseridos, erros };
}

// -----------------------------------------------------------------------------
// FUNÇÕES AUXILIARES DE FORMATAÇÃO E HIGIENIZAÇÃO
// -----------------------------------------------------------------------------

function formatarNomeFantasia(nome) {
  if (!nome) return 'Drogaria Regional';
  return nome.trim().replace(/\s+/g, ' ');
}

function normalizarTelefone(tel, uf) {
  if (!tel) return null;
  const limpo = tel.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  // Se veio sem DDD, atribui o DDD padrão da UF
  if (limpo.length === 8 || limpo.length === 9) {
    const ddd = uf === 'SP' ? '11' : uf === 'GO' ? '62' : '61';
    return `(${ddd}) ${limpo.length === 9 ? limpo.slice(0, 5) + '-' + limpo.slice(5) : limpo.slice(0, 4) + '-' + limpo.slice(4)}`;
  }
  return tel;
}

function extrairOuDeduzirWhatsApp(tags, telefone) {
  const whatsTag = tags['contact:whatsapp'] || tags['whatsapp'];
  if (whatsTag) {
    const digitos = whatsTag.replace(/\D/g, '');
    if (digitos.length >= 10) return formatarNumeroWhatsApp(digitos);
  }

  // Se o telefone informado for celular (9 dígitos começando com 9)
  if (telefone) {
    const digitos = telefone.replace(/\D/g, '');
    const apenasNumero = digitos.length === 11 ? digitos.slice(2) : digitos;
    if (apenasNumero.length === 9 && apenasNumero.startsWith('9')) {
      return formatarNumeroWhatsApp(digitos);
    }
  }

  return null;
}

function formatarNumeroWhatsApp(digitos) {
  const d = digitos.replace(/^55/, ''); // remove prefixo de país se presente
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return d;
}

function sanitizarUrl(url) {
  if (!url) return null;
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

function validarFormatoEmail(email) {
  if (!email || email.length > 80) return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return false;
  // Descartar extensões de imagens que possam ter sido capturadas indevidamente
  const invalidExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  return !invalidExts.some(ext => email.toLowerCase().endsWith(ext));
}

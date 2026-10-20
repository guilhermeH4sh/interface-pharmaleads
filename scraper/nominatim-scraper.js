import axios from 'axios';
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

// Regiões e termos de busca para expansão nacional (dados 100% reais do OpenStreetMap)
const REGIOES = [
  // Sudeste (RJ, MG, ES)
  { termo: 'farmacia', cidade: 'Rio de Janeiro', uf: 'RJ' },
  { termo: 'drogaria', cidade: 'Rio de Janeiro', uf: 'RJ' },
  { termo: 'farmacia', cidade: 'Niterói', uf: 'RJ' },
  { termo: 'farmacia', cidade: 'Belo Horizonte', uf: 'MG' },
  { termo: 'drogaria', cidade: 'Belo Horizonte', uf: 'MG' },
  { termo: 'farmacia', cidade: 'Uberlândia', uf: 'MG' },
  { termo: 'farmacia', cidade: 'Vitória', uf: 'ES' },

  // Sul (PR, RS, SC)
  { termo: 'farmacia', cidade: 'Curitiba', uf: 'PR' },
  { termo: 'drogaria', cidade: 'Curitiba', uf: 'PR' },
  { termo: 'farmacia', cidade: 'Porto Alegre', uf: 'RS' },
  { termo: 'drogaria', cidade: 'Porto Alegre', uf: 'RS' },
  { termo: 'farmacia', cidade: 'Florianópolis', uf: 'SC' },

  // Nordeste (BA, PE, CE)
  { termo: 'farmacia', cidade: 'Salvador', uf: 'BA' },
  { termo: 'drogaria', cidade: 'Salvador', uf: 'BA' },
  { termo: 'farmacia', cidade: 'Recife', uf: 'PE' },
  { termo: 'farmacia', cidade: 'Fortaleza', uf: 'CE' },

  // Norte (AM, PA)
  { termo: 'farmacia', cidade: 'Manaus', uf: 'AM' },
  { termo: 'farmacia', cidade: 'Belém', uf: 'PA' },

  // Centro-Oeste adicional (MT, MS)
  { termo: 'farmacia', cidade: 'Cuiabá', uf: 'MT' },
  { termo: 'farmacia', cidade: 'Campo Grande', uf: 'MS' }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function coletarFarmaciasReais() {
  console.log('================================================================');
  console.log('EXPANSÃO NACIONAL DE FARMÁCIAS E DROGARIAS REAIS');
  console.log('Fonte: Base Geográfica e Cadastral Nominatim / OpenStreetMap');
  console.log('================================================================\n');

  // Carrega registros existentes para evitar inserção duplicada
  const { data: existentes } = await supabase.from('pharmaleads').select('nome, cidade');
  const nomesProcessados = new Set(
    (existentes || []).map(e => `${(e.nome || '').toLowerCase().trim()}_${(e.cidade || '').toLowerCase().trim()}`)
  );
  console.log(`Leads já existentes no banco para desduplicação: ${nomesProcessados.size}\n`);

  let totalInseridos = 0;

  for (const reg of REGIOES) {
    const query = `${reg.termo} em ${reg.cidade} ${reg.uf}`;
    console.log(`Mapeando: "${query}"...`);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1&limit=15`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'CentrusPharmaLeads-Prospeccao/2.0 (comercial@centrusdistribuidora.com.br)',
          'Accept-Language': 'pt-BR,pt;q=0.9'
        },
        timeout: 10000
      });

      const items = response.data || [];
      console.log(`   ${items.length} estabelecimentos encontrados.`);

      for (const item of items) {
        let nomeOriginal = item.name || (item.address && item.address.amenity) || (item.address && item.address.shop);
        if (!nomeOriginal || nomeOriginal.length < 3) continue;

        // Limpeza e formatação do nome
        nomeOriginal = nomeOriginal.trim();
        const chaveUnica = `${nomeOriginal.toLowerCase()}_${reg.cidade.toLowerCase()}`;
        if (nomesProcessados.has(chaveUnica)) continue;
        nomesProcessados.add(chaveUnica);

        const addr = item.address || {};
        const rua = addr.road || addr.street || null;
        const num = addr.house_number || null;
        const bairro = addr.suburb || addr.neighbourhood || addr.city_district || null;
        const cep = addr.postcode || null;
        const enderecoCompleto = rua
          ? `${rua}${num ? ', ' + num : ''}${bairro ? ' - ' + bairro : ''}, ${reg.cidade} - ${reg.uf}`
          : null;

        // Extrai dados reais das tags do OpenStreetMap (sem gerar dados fictícios)
        const extra = item.extratags || {};
        const telReal = extra.phone || extra['contact:phone'] || extra['contact:mobile'] || null;
        const website = extra.website || extra['contact:website'] || null;
        const email = extra.email || extra['contact:email'] || null;
        const whatsReal = extra['contact:whatsapp'] || extra.whatsapp || null;

        const payload = {
          nome: nomeOriginal,
          razao_social: null, // Só via consulta oficial de CNPJ
          uf: reg.uf,
          cidade: reg.cidade,
          bairro: bairro,
          endereco: enderecoCompleto,
          telefone: telReal,
          whatsapp: whatsReal, // Somente se publicado na tag OSM
          email: email,
          website: website,
          cnae: null, // Só via consulta oficial de CNPJ
          status: 'Não contatado',
          responsavel: 'Comercial Centrus',
          duplicado: false,
          observacoes: `Estabelecimento real mapeado via OpenStreetMap (${item.lat}, ${item.lon}).${cep ? ' CEP: ' + cep + '.' : ''}${!telReal ? ' Telefone não encontrado em fonte pública.' : ''}`,
          historico: [
            {
              data: new Date().toLocaleString('pt-BR'),
              texto: 'Lead farmacêutico real capturado e adicionado ao pipeline da Centrus.'
            }
          ]
        };

        const { error } = await supabase.from('pharmaleads').insert(payload);
        if (!error) {
          totalInseridos++;
        }
      }

      // Respeita política de cortesia de 1s entre buscas do Nominatim
      await sleep(1100);
    } catch (err) {
      console.warn(`⚠️ Aviso na região ${reg.cidade}: ${err.message}`);
    }
  }

  const { count } = await supabase.from('pharmaleads').select('*', { count: 'exact', head: true });
  console.log('\n================================================================');
  console.log(`✅ EXTRAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`📥 Estabelecimentos reais adicionados: ${totalInseridos}`);
  console.log(`📊 Total geral ativo no Supabase: ${count} farmácias reais.`);
  console.log('================================================================');
  process.exit(0);
}

coletarFarmaciasReais();

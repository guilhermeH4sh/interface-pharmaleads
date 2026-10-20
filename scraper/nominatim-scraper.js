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

// Regiões e termos de busca para coletar estabelecimentos reais
const REGIOES = [
  // São Paulo
  { termo: 'farmacia', cidade: 'São Paulo', uf: 'SP', ddd: '11' },
  { termo: 'drogaria', cidade: 'São Paulo', uf: 'SP', ddd: '11' },
  { termo: 'drogaria', cidade: 'Campinas', uf: 'SP', ddd: '19' },
  { termo: 'farmacia', cidade: 'Campinas', uf: 'SP', ddd: '19' },
  { termo: 'farmacia', cidade: 'Ribeirão Preto', uf: 'SP', ddd: '16' },

  // Goiás
  { termo: 'farmacia', cidade: 'Goiânia', uf: 'GO', ddd: '62' },
  { termo: 'drogaria', cidade: 'Goiânia', uf: 'GO', ddd: '62' },
  { termo: 'farmacia', cidade: 'Anápolis', uf: 'GO', ddd: '62' },
  { termo: 'drogaria', cidade: 'Rio Verde', uf: 'GO', ddd: '64' },

  // Distrito Federal
  { termo: 'farmacia', cidade: 'Brasília', uf: 'DF', ddd: '61' },
  { termo: 'drogaria', cidade: 'Brasília', uf: 'DF', ddd: '61' },
  { termo: 'farmacia', cidade: 'Taguatinga', uf: 'DF', ddd: '61' },
  { termo: 'drogaria', cidade: 'Ceilândia', uf: 'DF', ddd: '61' }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function coletarFarmaciasReais() {
  console.log('================================================================');
  console.log('CAPTURA DE FARMÁCIAS E DROGARIAS REAIS (SP, GO, DF)');
  console.log('Fonte: Base Geográfica e Cadastral Nominatim / OpenStreetMap');
  console.log('================================================================\n');

  let totalInseridos = 0;
  const nomesProcessados = new Set();

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

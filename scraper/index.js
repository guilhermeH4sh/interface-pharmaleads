import {
  REGIOES_ALVO,
  buscarFarmaciasPorRegiao,
  rastrearContatosNoWebsite,
  salvarLeadsNoSupabase,
  supabase
} from './engine.js';

async function executarVarreduraCompleta() {
  console.log('================================================================');
  console.log('🚀 CENTRUS PHARMALEADS — ROTINA DE PROSPECÇÃO E SCRAPING REGIONAL');
  console.log('Cobertura: São Paulo (SP) | Goiás (GO) | Distrito Federal (DF)');
  console.log('Data/Hora de Início:', new Date().toLocaleString('pt-BR'));
  console.log('================================================================');

  let totalEncontrados = 0;
  let totalComTelefone = 0;
  let totalComWhatsapp = 0;
  let totalComEmail = 0;
  const todosLeads = [];

  for (const regiao of REGIOES_ALVO) {
    const farmacias = await buscarFarmaciasPorRegiao(regiao);
    totalEncontrados += farmacias.length;

    // Enriquecimento de contatos (Website, E-mail e WhatsApp)
    console.log(`📡 Enriquecendo contatos para ${farmacias.length} farmácias em ${regiao.cidade}...`);
    
    // Processamento em lotes pequenos para respeitar limites de taxa e conexão
    const lote = farmacias.slice(0, 15); // Pega as 15 primeiras de cada região prioritária
    for (const lead of lote) {
      if (lead.website) {
        process.stdout.write(`   🌐 Rastreando site de "${lead.nome.slice(0, 30)}"... `);
        const contatos = await rastrearContatosNoWebsite(lead.website);
        if (contatos.email && !lead.email) {
          lead.email = contatos.email;
          process.stdout.write(`✉️ E-mail: ${lead.email} `);
        }
        if (contatos.whatsapp && !lead.whatsapp) {
          lead.whatsapp = contatos.whatsapp;
          process.stdout.write(`📱 WhatsApp: ${lead.whatsapp} `);
        }
        process.stdout.write('\n');
      }

      // Se não encontrou WhatsApp explicitamente, mas tem telefone fixo/celular
      if (!lead.whatsapp && lead.telefone) {
        lead.whatsapp = lead.telefone;
      }

      if (lead.telefone) totalComTelefone++;
      if (lead.whatsapp) totalComWhatsapp++;
      if (lead.email) totalComEmail++;

      todosLeads.push(lead);
    }
  }

  console.log('\n================================================================');
  console.log('📊 RESUMO DA COLETA DE DADOS:');
  console.log(`- Total de estabelecimentos mapeados: ${todosLeads.length}`);
  console.log(`- Com Telefone: ${totalComTelefone}`);
  console.log(`- Com WhatsApp: ${totalComWhatsapp}`);
  console.log(`- Com E-mail: ${totalComEmail}`);
  console.log('================================================================');

  // Grava todos os leads coletados diretamente no Supabase
  const resultado = await salvarLeadsNoSupabase(todosLeads);

  // Consulta saldo total atualizado no Supabase
  const { count } = await supabase.from('pharmaleads').select('*', { count: 'exact', head: true });
  console.log(`\n🎉 Operação concluída com sucesso! Total no Supabase: ${count} registros.`);
  process.exit(0);
}

executarVarreduraCompleta().catch((err) => {
  console.error('\n❌ Erro durante a execução do scraping:', err);
  process.exit(1);
});

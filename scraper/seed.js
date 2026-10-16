import fs from 'fs';
import path from 'path';
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

async function seedInitialLeads() {
  console.log('🌱 Inicializando sincronização da base de farmácias com o Supabase...');

  // Lê o script.js para extrair a lista leadsData original
  const scriptContent = fs.readFileSync(path.resolve('./script.js'), 'utf-8');
  const match = scriptContent.match(/let leadsData = (\[[\s\S]*?\]);\s*\/\//);

  if (!match || !match[1]) {
    console.error('❌ Não foi possível extrair a lista leadsData do script.js');
    process.exit(1);
  }

  // Avalia com segurança substituindo HOJE_FORMATADO pela data de hoje
  const hoje = new Date().toLocaleDateString('pt-BR');
  const rawJs = match[1].replace(/HOJE_FORMATADO/g, JSON.stringify(hoje));
  const leads = eval(rawJs);

  console.log(`📋 ${leads.length} estabelecimentos qualificados extraídos.`);

  let inseridos = 0;
  let erros = 0;

  for (const lead of leads) {
    // Normaliza para o schema do banco Supabase
    const payload = {
      nome: lead.nome,
      razao_social: lead.razaoSocial,
      cnpj: lead.cnpj,
      uf: lead.uf,
      cidade: lead.cidade,
      bairro: lead.bairro,
      endereco: `${lead.bairro}, ${lead.cidade} - ${lead.uf}`,
      telefone: lead.telefone,
      whatsapp: lead.telefone ? lead.telefone : null,
      email: lead.email,
      website: lead.email ? `https://www.${lead.email.split('@')[1]}` : null,
      cnae: lead.cnae,
      status: lead.status,
      responsavel: lead.responsavel,
      duplicado: lead.duplicado || false,
      observacoes: lead.observacoes,
      historico: lead.historico || []
    };

    const { error } = await supabase.from('pharmaleads').upsert(payload, { onConflict: 'cnpj' });
    if (error) {
      console.warn(`⚠️ Erro ao inserir lead "${lead.nome}":`, error.message);
      erros++;
    } else {
      inseridos++;
    }
  }

  console.log(`✅ Sincronização concluída com sucesso!`);
  console.log(`📊 Inseridos / Atualizados: ${inseridos} | Erros: ${erros}`);
}

seedInitialLeads();

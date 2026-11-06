# Acesso à plataforma

A tela de entrada protege todo o painel. O acesso usa a conta já autorizada no Supabase Auth; não há uma segunda senha de banco no navegador. O UID autorizado e as políticas RLS existentes continuam sendo verificados pelos serviços. Não foram criados usuários nem alteradas tabelas.

A integração de dados é fixa: projeto Supabase e tabela public.pharmaleads. Configurações apenas informa a integração; não oferece login, troca de fonte ou desconexão do banco. Sair da plataforma encerra a sessão do usuário e preserva essa configuração. O login autoriza o uso da plataforma, não configura a conexão do banco.

Sessões salvas são validadas no servidor antes de liberar o painel e renovadas com o refresh token. Falhas temporárias de rede preservam a sessão e permitem tentar novamente. Sessões inválidas retornam à entrada. Nenhum lead ou controle do coletor é carregado pelo painel antes dessa validação. As APIs continuam exigindo JWT e o Supabase mantém as políticas de acesso existentes.

Não é necessária migration ou nova variável de ambiente para esta mudança. Não colocar senha, service_role ou chave secreta em variáveis VITE_*.

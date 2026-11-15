# Integração da Receita Federal e do IBGE

Use os ZIPs de Estabelecimentos e `Municipios.zip` da mesma competência. O IBGE valida nome e UF após o código da Receita ser convertido em nome pela tabela da própria Receita. A procedência e os códigos ficam em `dados_brutos`. O Cron Job de Google Maps segue independente desta carga.

```powershell
python -m scripts.importar_receita_uf --uf DF --competencia 2026-10 --banco dados/receita.sqlite .\Estabelecimentos8.zip
python -m scripts.atualizar_cobertura_ibge --cache-localidades dados/receita.sqlite
python -m scripts.sincronizar_receita --uf DF --competencia 2026-10 --banco dados/receita.sqlite --municipios .\Municipios.zip
```

O último comando simula a carga usando a sessão Supabase configurada e imprime somente os totais. Revise as contagens e execute o mesmo comando com `--aplicar` para gravar. `--limite-novos N` permite limitar as novas inserções em um piloto.

Para uma carga nacional, use `--uf TODAS` na importação e na sincronização. Importe um ZIP por vez no mesmo SQLite. Assim, cada arquivo é lido uma vez para as 27 UFs. Os checkpoints são específicos da competência e do recorte.

Os novos leads precisam ter nome fantasia, podem entrar com o e-mail em branco e recebem a origem **Receita Federal**. CNPJs já presentes são enriquecidos no registro original. O mesmo vale para uma única correspondência forte de nome e endereço. Casos ambíguos ficam de fora da gravação. Um enriquecimento atualiza somente `dados_brutos`, com verificação concorrente, e mantém a chave e os campos do CRM. A inserção ignora chaves Receita já existentes. A carga usa o esquema atual do Supabase.

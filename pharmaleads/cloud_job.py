"""Execução sob demanda no GitHub Actions; cada CSV é salvo em public.pharmaleads."""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

from .banco import Banco
from .config import ErroPharmaLeads
from .gerador import montar_consultas, validar_segmentos

TERMOS_POR_SEGMENTO = {'varejo': 3, 'manipulacao': 1, 'homeopatia': 1,
                       'veterinaria': 1, 'distribuidoras': 2}


def configuracao() -> tuple[list[str], int, bool, bool]:
    locais = [x.strip() for x in os.environ.get('LOCAIS', '').splitlines() if x.strip()]
    segmentos = [x.strip() for x in os.environ.get('SEGMENTOS', '').split(',') if x.strip()]
    try:
        profundidade = int(os.environ.get('PROFUNDIDADE', '1'))
    except ValueError:
        raise ErroPharmaLeads('Profundidade inválida.') from None
    if (not locais or len(locais) > 20 or
            any(len(x) > 100 or '#!#' in x or any(ord(c) < 32 for c in x) for x in locais)):
        raise ErroPharmaLeads('Informe de 1 a 20 locais válidos.')
    validar_segmentos(segmentos)
    if not segmentos or not 1 <= profundidade <= 10:
        raise ErroPharmaLeads('Segmentos ou profundidade inválidos.')
    if len(montar_consultas(locais, segmentos)) > 20:
        raise ErroPharmaLeads('Esta coleta excede 20 buscas.')
    if not all(os.environ.get(x) for x in ('SUPABASE_EMAIL', 'SUPABASE_PASSWORD')):
        raise ErroPharmaLeads('Configure SUPABASE_EMAIL e SUPABASE_PASSWORD em GitHub Actions Secrets.')
    return (montar_consultas(locais, segmentos), profundidade,
            os.environ.get('EMAILS') == 'true', os.environ.get('ENRIQUECER_SITES') == 'true')


def main() -> int:
    try:
        consultas, profundidade, emails, enriquecer = configuracao()
        imagem = os.environ.get('GOSOM_IMAGE', 'gosom/google-maps-scraper:latest')
        with tempfile.TemporaryDirectory(prefix='pharmaleads-cloud-') as tmp:
            base = Path(tmp)
            banco = Banco()
            try:
                # Um único processo mantém o navegador preparado para toda a rodada.
                # O Gosom devolve input_id em cada linha, portanto segmento e local
                # continuam corretos mesmo com várias consultas no mesmo CSV.
                (base / 'input.txt').write_text('\n'.join(consultas) + '\n', encoding='utf-8')
                saida = base / 'results.csv'
                comando = ['docker', 'run', '--rm', '-v', f'{base.resolve()}:/gmapsdata',
                           imagem, '-input', '/gmapsdata/input.txt', '-results',
                           '/gmapsdata/results.csv', '-c', '2', '-depth', str(profundidade),
                           '-lang', 'pt-BR', '-exit-on-inactivity', '3m']
                if emails:
                    comando.append('-email')
                ultimo_erro: Exception | None = None
                print(f'Rodada com {len(consultas)} buscas; concorrência 2.', flush=True)
                for tentativa in range(1, 3):
                    saida.unlink(missing_ok=True)
                    try:
                        subprocess.run(comando, check=True, timeout=900)
                        if not saida.is_file() or saida.stat().st_size < 10:
                            raise ErroPharmaLeads('Gosom retornou um CSV vazio.')
                        novos, existentes = banco.importar_csv(saida)
                        break
                    except (ErroPharmaLeads, OSError, subprocess.CalledProcessError,
                            subprocess.TimeoutExpired) as exc:
                        ultimo_erro = exc
                        if tentativa < 2:
                            print('Resultado inválido; repetindo a rodada uma vez.', flush=True)
                else:
                    raise ErroPharmaLeads(f'Rodada falhou após duas tentativas: {ultimo_erro}')
                enriquecidos = 0
                if enriquecer:
                    from .enriquecedor import enriquecer_sites
                    candidatos = banco.candidatos_enriquecimento(banco.ultimas_chaves_novas)
                    for contato in enriquecer_sites(candidatos):
                        enriquecidos += banco.registrar_enriquecimento(contato)
                pendentes = banco.con.execute('SELECT count(*) FROM sync_pendente').fetchone()[0]
                if pendentes:
                    banco.sincronizar_pendentes(obrigatorio=True)
                print(f'Coleta concluída: {novos} novos, {existentes} atualizados; '
                      f'{enriquecidos} enriquecidos; Supabase sincronizado.', flush=True)
            finally:
                banco.fechar()
        return 0
    except (ErroPharmaLeads, OSError, subprocess.CalledProcessError,
            subprocess.TimeoutExpired) as exc:
        print(f'Coleta falhou: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

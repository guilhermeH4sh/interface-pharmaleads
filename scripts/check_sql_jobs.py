"""Bloqueia a introdução de agendamentos SQL até revisão operacional específica."""
from pathlib import Path
import re

CALL = re.compile(r'\b"?cron"?\s*\.\s*"?(schedule_in_database|schedule|alter_job)"?\s*\(', re.I)


def violations(text: str) -> list[int]:
    # Inclui strings SQL e comentários: exemplos de criação de jobs devem ficar
    # na documentação, e não em arquivos de migração executáveis.
    return [text.count('\n', 0, match.start()) + 1 for match in CALL.finditer(text)]


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    found = []
    for directory in ('supabase', 'scripts'):
        for path in sorted((root / directory).rglob('*')):
            if path.is_file() and path.suffix in {'.sql', '.py', '.ps1', '.js', '.mjs', '.cjs'} and path != Path(__file__).resolve():
                found.extend(f'{path.relative_to(root)}:{line}' for line in violations(path.read_text(encoding='utf-8-sig')))
    if found:
        print('Criação/alteração de jobs SQL bloqueada. Exige revisão operacional e PR específico:')
        print('\n'.join(found))
        return 1
    print('Política SQL: nenhum agendamento novo ou alterado encontrado.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

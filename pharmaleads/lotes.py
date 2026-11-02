"""Estado dos lotes em JSON local, sem tabelas adicionais no Supabase."""
import json
import os
import tempfile
from pathlib import Path

from .config import ErroPharmaLeads


class Lotes:
    def __init__(self, caminho: Path):
        self.caminho = caminho
        try:
            self.dados = json.loads(caminho.read_text(encoding='utf-8')) if caminho.exists() else {}
            if not isinstance(self.dados, dict) or any(not isinstance(v, dict) for v in self.dados.values()):
                raise ValueError()
        except (ValueError, OSError):
            raise ErroPharmaLeads('Não foi possível ler dados/lotes.json. Restaure o arquivo antes de continuar.') from None

    def gravar(self):
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        temporario = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=self.caminho.parent,
                    prefix='lotes-', suffix='.tmp', delete=False) as f:
                temporario = Path(f.name)
                json.dump(self.dados, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temporario, self.caminho)
        finally:
            if temporario and temporario.exists():
                temporario.unlink()

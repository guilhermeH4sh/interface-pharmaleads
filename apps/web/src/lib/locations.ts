const CIDADES_CONHECIDAS = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília", "Salvador", "Fortaleza", "Curitiba", "Manaus", "Recife", "Goiânia", "Belém", "Porto Alegre", "São Luís", "Maceió", "Natal", "Teresina", "Campo Grande", "João Pessoa", "Aracaju", "Florianópolis", "Cuiabá", "Porto Velho", "Macapá", "Boa Vista", "Rio Branco", "Vitória", "Palmas", "Campinas", "Santarém", "Feira de Santana", "Anápolis", "Londrina", "Ribeirão Preto", "Mossoró", "Arapiraca"];

const semAcentos = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

function distancia(a: string, b: string) {
  const anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = anterior[0]; anterior[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const acima = anterior[j];
      anterior[j] = Math.min(anterior[j] + 1, anterior[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1]));
      diagonal = acima;
    }
  }
  return anterior[b.length];
}

export function corrigirLocal(texto: string) {
  const partes = texto.split(",");
  const cidade = semAcentos(partes[0]);
  if (!cidade || cidade.length < 5) return texto.trim();
  const melhor = CIDADES_CONHECIDAS.map(nome => ({ nome, distancia: distancia(cidade, semAcentos(nome)) }))
    .sort((a, b) => a.distancia - b.distancia)[0];
  if (!melhor || melhor.distancia > Math.max(1, Math.floor(cidade.length * 0.22))) return texto.trim();
  return [melhor.nome, partes[1]?.trim().toUpperCase()].filter(Boolean).join(", ");
}

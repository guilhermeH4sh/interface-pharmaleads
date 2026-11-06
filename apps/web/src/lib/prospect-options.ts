export const ESTABLISHMENTS = [
  { value: "varejo", label: "Farmácia de Varejo / Drogaria" },
  { value: "manipulacao", label: "Farmácia de Manipulação" },
  { value: "homeopatia", label: "Farmácia Homeopática" },
  { value: "veterinaria", label: "Farmácia Veterinária" },
  { value: "distribuidoras", label: "Distribuidoras de Medicamentos" },
];
export const STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
].map(([value, label]) => ({ value, label: `${label} (${value})` }));
export const SOURCES = ["Google Maps", "Google Meu Negócio", "Receita Federal", "Outras fontes"].map(value => ({ value, label: value }));

export type FreeDiagnosticResponses = Record<string, unknown>;

export const visaTypeLabels: Record<string, string> = {
  free: 'Descoberta inicial',
  'eb2-niw': 'EB-2 NIW',
  eb1a: 'EB-1A',
  o1a: 'O-1A',
  h1b: 'H-1B',
  l1: 'L-1',
  e2: 'E-2',
  tn: 'TN',
  k1: 'K-1',
  'f1-opt': 'F-1 OPT',
};

export const freeQuestionLabels: Record<string, string> = {
  objetivo: 'Objetivo nos EUA',
  cidadania: 'Pode obter cidadania portuguesa',
  sponsor: 'Tem empresa patrocinadora',
  area: 'Area de atuacao',
  ingles: 'Nivel de ingles',
  escolaridade: 'Escolaridade',
  experiencia: 'Tempo de experiencia',
  reconhecimento: 'Nivel de reconhecimento profissional',
  realizacoes: 'Principais realizacoes',
  investimento: 'Capacidade de investimento',
  vinculo: 'Vinculo com empresa no exterior',
  aceito_eua: 'Aceita trabalhar nos EUA com sponsor',
  intracompany: 'Transferencia intracompany',
  urgencia: 'Urgencia da mudanca',
  visto_anterior: 'Ja teve visto americano',
  familia_dependentes: 'Vai com familia',
  situacao_atual: 'Situacao profissional atual',
  income_range: 'Renda anual aproximada',
  age_range: 'Faixa etaria',
  marital_status: 'Estado civil',
  country_of_origin: 'Pais de origem',
  visited_us: 'Ja visitou os EUA',
  relatives_us: 'Tem parentes nos EUA',
  owns_business: 'Tem empresa propria',
  specific_sector: 'Setor especifico',
};

const valueLabels: Record<string, string> = {
  trabalhar_permanente: 'Trabalhar permanentemente',
  trabalhar_temporario: 'Trabalhar temporariamente',
  estudar: 'Estudar',
  investir_empreender: 'Investir ou empreender',
  morar_familiar: 'Morar com familiar americano',
  explorar: 'Ainda quer explorar opcoes',
  sim: 'Sim',
  nao: 'Nao',
  yes: 'Sim',
  no: 'Nao',
  basico: 'Basico',
  intermediario: 'Intermediario',
  avancado: 'Avancado',
  fluente: 'Fluente',
  ensino_medio: 'Ensino medio',
  graduacao: 'Graduacao',
  pos_graduacao: 'Pos-graduacao',
  mestrado: 'Mestrado',
  doutorado: 'Doutorado',
  ate_50k: 'Ate R$ 50 mil',
  '50k_100k': 'R$ 50 mil a R$ 100 mil',
  '100k_200k': 'R$ 100 mil a R$ 200 mil',
  acima_200k: 'Acima de R$ 200 mil',
  '18_25': '18 a 25 anos',
  '26_35': '26 a 35 anos',
  '36_45': '36 a 45 anos',
  acima_45: 'Acima de 45 anos',
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a) ou uniao estavel',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viuvo(a)',
  empregado_clt: 'Empregado(a)',
  autonomo: 'Autonomo ou freelancer',
  empresario: 'Empresario(a)',
  estudante: 'Estudante',
  desempregado: 'Desempregado(a)',
  sozinho: 'Vai sozinho(a)',
  conjuge: 'Vai com conjuge',
  filhos: 'Vai com filhos',
  familia_completa: 'Vai com conjuge e filhos',
  sim_tenho: 'Ja tem sponsor confirmado',
  nao_por_conta: 'Quer seguir por conta propria',
  buscando: 'Ainda esta buscando sponsor',
};

const incomeMidpoints: Record<string, number> = {
  ate_50k: 25000,
  '50k_100k': 75000,
  '100k_200k': 150000,
  acima_200k: 250000,
};

export function humanizeIdentifier(raw: string | null | undefined) {
  if (!raw) return 'Nao informado';
  const normalized = raw.replace(/[-_]+/g, ' ').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatBusinessStatus(status: string | null | undefined) {
  switch (status) {
    case 'completed':
      return 'Pago';
    case 'refunded':
      return 'Reembolsado';
    case 'refund_pending':
      return 'Reembolso em analise';
    case 'pending':
      return 'Pendente';
    case 'processing':
      return 'Em andamento';
    case 'processed':
      return 'Concluido';
    case 'failed':
      return 'Falhou';
    case 'in_progress':
      return 'Em andamento';
    default:
      return humanizeIdentifier(status ?? '');
  }
}

export function formatBoolean(value: unknown) {
  if (value === true) return 'Sim';
  if (value === false) return 'Nao';
  return null;
}

export function formatAnswer(questionId: string, value: unknown): string {
  const bool = formatBoolean(value);
  if (bool) return bool;

  if (Array.isArray(value)) {
    return value.map((item) => formatAnswer(questionId, item)).join(', ');
  }

  if (typeof value === 'string') {
    return valueLabels[value] ?? humanizeIdentifier(value);
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${humanizeIdentifier(key)}: ${formatAnswer(key, item)}`)
      .join(' | ');
  }

  return 'Nao informado';
}

export function getQuestionLabel(questionId: string) {
  return freeQuestionLabels[questionId] ?? humanizeIdentifier(questionId);
}

export function getIncomeMidpoint(value: unknown) {
  if (typeof value !== 'string') return null;
  return incomeMidpoints[value] ?? null;
}

export function formatCurrencyBRL(valueInReais: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(valueInReais);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Nao informado';
  return new Date(value).toLocaleString('pt-BR');
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Nao informado';
  return new Date(value).toLocaleDateString('pt-BR');
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function summarizeFreeDiagnostic(responses: FreeDiagnosticResponses | null | undefined) {
  if (!responses) return [];

  const importantOrder = [
    'objetivo',
    'area',
    'ingles',
    'escolaridade',
    'income_range',
    'age_range',
    'situacao_atual',
    'familia_dependentes',
    'urgencia',
  ];

  return importantOrder
    .filter((key) => key in responses)
    .map((key) => ({
      id: key,
      label: getQuestionLabel(key),
      value: formatAnswer(key, responses[key]),
      raw: responses[key],
    }));
}

export function normalizeRecommendedVisas(values: unknown) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => (typeof item === 'string' ? visaTypeLabels[item] ?? item.toUpperCase() : null))
    .filter(Boolean) as string[];
}

export function buildResponseList(responses: Array<{ question_id: string; answer: unknown }>) {
  return responses.map((item) => ({
    id: item.question_id,
    label: getQuestionLabel(item.question_id),
    value: formatAnswer(item.question_id, item.answer),
  }));
}


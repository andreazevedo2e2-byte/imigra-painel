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
  status_eua: 'Localização atual',
  sponsor: 'Tem empresa patrocinadora',
  tipo_sponsor: 'Tipo de empresa patrocinadora',
  area: 'Área de atuação',
  ingles: 'Nível de inglês',
  escolaridade: 'Escolaridade',
  experiencia: 'Tempo de experiência',
  reconhecimento: 'Reconhecimento profissional',
  tipo_destaque: 'Tipo de destaque',
  nivel_provas: 'Força das provas',
  impacto_trabalho: 'Impacto do trabalho',
  plano_profissional_eua: 'Plano profissional nos EUA',
  possui_empresa: 'Tem empresa própria',
  transferencia_empresa: 'Possibilidade de transferência',
  papel_empresa: 'Papel na empresa nos EUA',
  investimento: 'Capacidade de investimento',
  origem_investimento: 'Origem do investimento',
  cidadania_estrategica: 'Cidadania estratégica',
  vinculo: 'Vínculo familiar/parceiro',
  aceito_eua: 'Aceitação em instituição dos EUA',
  urgencia: 'Urgência da mudança',
  historico_migratorio: 'Histórico migratório',
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
  fora: 'Fora dos EUA',
  dentro: 'Dentro dos EUA',
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
  tecnologia: 'Tecnologia / TI',
  saude: 'Saude / Medicina',
  engenharia: 'Engenharia',
  ciencias: 'Ciencias / Pesquisa',
  negocios: 'Negocios / Financas',
  artes: 'Artes / Entretenimento',
  educacao: 'Educacao',
  direito: 'Direito',
  outra: 'Outra area',
  '0_2': 'Ate 2 anos',
  '3_5': '3 a 5 anos',
  '6_10': '6 a 10 anos',
  mais_10: 'Mais de 10 anos',
  sim_confirmado: 'Sim, ja esta confirmado',
  negociando: 'Ainda esta negociando',
  empresa_lucrativa: 'Empresa privada comum',
  universidade_pesquisa: 'Universidade, hospital, pesquisa ou sem fins lucrativos',
  startup_pequena: 'Startup pequena ou empresa inicial',
  nao_sei: 'Ainda nao sei',
  nenhum: 'Nenhum',
  algum: 'Alguns sinais de destaque',
  moderado: 'Destaque moderado e comprovavel',
  forte: 'Destaque forte e bem documentado',
  pesquisa_publicacoes: 'Publicacoes, pesquisa, patentes ou citacoes',
  premios_midia: 'Premios, midia, palestras ou visibilidade publica',
  lideranca_resultados: 'Lideranca, salario alto ou resultados fora da curva',
  misto: 'Mistura de varios formatos',
  '1_2': '1 a 2 provas',
  '3_4': '3 a 4 provas',
  '5_mais': '5 ou mais provas',
  alto: 'Alto',
  medio: 'Medio',
  baixo: 'Baixo',
  claro_documentado: 'Claro e documentado',
  ideia_inicial: 'Ideia inicial',
  sim_claro: 'Sim, caminho real',
  talvez: 'Talvez',
  executivo_gerente: 'Executivo, gerente ou lideranca da operacao',
  conhecimento_especializado: 'Conhecimento essencial da empresa',
  socio_fundador: 'Socio ou fundador',
  ate_100k: 'Ate US$ 100 mil',
  '100k_300k': 'US$ 100 mil a US$ 300 mil',
  '300k_800k': 'US$ 300 mil a US$ 800 mil',
  acima_800k: 'Acima de US$ 800 mil',
  documentada: 'Documentada',
  parcial: 'Parcialmente documentada',
  brasil_apenas: 'Apenas Brasil',
  canada_mexico: 'Canada ou Mexico',
  tratado_e2: 'Pais com tratado E-2',
  dupla_cidadania_caminho: 'Tem ou pode buscar cidadania estrategica',
  noivo_cidadao: 'Noivo(a) de cidadao americano',
  conjuge_cidadao: 'Conjuge de cidadao americano',
  conjuge_residente: 'Conjuge de residente permanente',
  filho_cidadao: 'Filho(a) de cidadao americano',
  outro: 'Outro vinculo',
  sim_carta: 'Sim, ja tem carta de aceitacao',
  em_processo: 'Ainda esta em processo',
  menos_6m: 'Menos de 6 meses',
  '6_12m': '6 a 12 meses',
  '1_2a': '1 a 2 anos',
  sem_pressa: 'Sem pressa',
  visto_anterior_ok: 'Ja teve visto americano sem problemas',
  negativa_ou_alerta: 'Ja teve negativa ou ponto de atencao',
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
    'status_eua',
    'area',
    'escolaridade',
    'experiencia',
    'sponsor',
    'tipo_sponsor',
    'reconhecimento',
    'tipo_destaque',
    'nivel_provas',
    'impacto_trabalho',
    'plano_profissional_eua',
    'possui_empresa',
    'transferencia_empresa',
    'papel_empresa',
    'investimento',
    'origem_investimento',
    'cidadania_estrategica',
    'vinculo',
    'aceito_eua',
    'urgencia',
    'historico_migratorio',
    'income_range',
    'age_range',
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

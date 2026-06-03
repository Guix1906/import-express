// Configuração de campos dinâmicos por área jurídica.
// Usado na Triagem para coletar informações estratégicas
// já no primeiro contato com o cliente.

export type DynField =
  | {
      key: string;
      label: string;
      type: "boolean";
      showIf?: { key: string; equals: unknown };
    }
  | {
      key: string;
      label: string;
      type: "text" | "textarea" | "number" | "date";
      placeholder?: string;
      showIf?: { key: string; equals: unknown };
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: string[];
      showIf?: { key: string; equals: unknown };
    };

export type AreaConfig = {
  area: string;
  icon?: string;
  fields: DynField[];
};

export const PRACTICE_AREAS: string[] = [
  "Previdenciário",
  "Trabalhista",
  "Família",
  "Criminal",
  "Cível",
  "Consumidor",
  "Empresarial",
  "Imobiliário",
  "Tributário",
  "Bancário",
  "Saúde",
  "Administrativo",
  "LGPD / Digital",
  "Sucessões / Inventário",
  "Outro",
];

export const UNIVERSAL_FIELDS: DynField[] = [
  {
    key: "urgencia",
    label: "Grau de urgência",
    type: "select",
    options: ["Baixa", "Média", "Alta", "Crítica"],
  },
  {
    key: "origem",
    label: "Como conheceu o escritório?",
    type: "text",
    placeholder: "Indicação, Google, Instagram…",
  },
  { key: "possui_documentos", label: "Possui documentos?", type: "boolean" },
  {
    key: "melhor_horario",
    label: "Melhor horário para contato",
    type: "text",
    placeholder: "Manhã / Tarde / Noite",
  },
  { key: "interesse_principal", label: "Interesse principal do cliente", type: "text" },
];

export const AREA_FIELDS: Record<string, DynField[]> = {
  Previdenciário: [
    { key: "tem_govbr", label: "Possui GOV.br?", type: "boolean" },
    { key: "tem_senha_inss", label: "Possui senha do INSS?", type: "boolean" },
    { key: "recebe_beneficio", label: "Já recebe benefício?", type: "boolean" },
    {
      key: "qual_beneficio",
      label: "Qual benefício?",
      type: "text",
      showIf: { key: "recebe_beneficio", equals: true },
    },
    {
      key: "numero_beneficio",
      label: "Número do benefício",
      type: "text",
      showIf: { key: "recebe_beneficio", equals: true },
    },
    {
      key: "data_concessao",
      label: "Data da concessão",
      type: "date",
      showIf: { key: "recebe_beneficio", equals: true },
    },
    { key: "aposentado", label: "Está aposentado?", type: "boolean" },
    { key: "area_rural", label: "Trabalhou em área rural?", type: "boolean" },
    { key: "tem_laudos", label: "Possui laudos médicos?", type: "boolean" },
    { key: "afastado", label: "Está afastado do trabalho?", type: "boolean" },
    { key: "beneficio_negado", label: "Já teve benefício negado?", type: "boolean" },
    { key: "cnis_atualizado", label: "Possui CNIS atualizado?", type: "boolean" },
  ],
  Trabalhista: [
    { key: "empresa_reclamada", label: "Empresa reclamada", type: "text" },
    { key: "cargo", label: "Cargo exercido", type: "text" },
    { key: "data_admissao", label: "Data admissão", type: "date" },
    { key: "data_demissao", label: "Data demissão", type: "date" },
    { key: "carteira_assinada", label: "Possui carteira assinada?", type: "boolean" },
    { key: "houve_rescisao", label: "Houve rescisão?", type: "boolean" },
    { key: "horas_extras", label: "Recebia horas extras?", type: "boolean" },
    { key: "assedio", label: "Sofreu assédio?", type: "boolean" },
    { key: "tem_provas", label: "Possui provas?", type: "boolean" },
    { key: "tem_testemunhas", label: "Possui testemunhas?", type: "boolean" },
    { key: "sem_registro", label: "Trabalhou sem registro?", type: "boolean" },
    { key: "adicional", label: "Recebia adicional?", type: "boolean" },
    { key: "fgts_depositado", label: "FGTS foi depositado?", type: "boolean" },
  ],
  Família: [
    {
      key: "estado_civil",
      label: "Casado ou união estável?",
      type: "select",
      options: ["Casado", "União estável", "Solteiro", "Divorciado", "Viúvo"],
    },
    { key: "tem_filhos", label: "Possui filhos?", type: "boolean" },
    {
      key: "qtd_filhos",
      label: "Quantos filhos?",
      type: "number",
      showIf: { key: "tem_filhos", equals: true },
    },
    { key: "pensao", label: "Existe pensão alimentícia?", type: "boolean" },
    { key: "guarda_compartilhada", label: "Guarda compartilhada?", type: "boolean" },
    { key: "disputa_bens", label: "Há disputa de bens?", type: "boolean" },
    { key: "medida_protetiva", label: "Existe medida protetiva?", type: "boolean" },
    { key: "deseja_divorcio", label: "Deseja divórcio?", type: "boolean" },
    { key: "acordo_partes", label: "Há acordo entre as partes?", type: "boolean" },
    { key: "ja_existe_processo", label: "Já existe processo?", type: "boolean" },
  ],
  Criminal: [
    { key: "reu_preso", label: "Réu preso?", type: "boolean" },
    {
      key: "unidade_prisional",
      label: "Unidade prisional",
      type: "text",
      showIf: { key: "reu_preso", equals: true },
    },
    {
      key: "cidade_prisao",
      label: "Cidade",
      type: "text",
      showIf: { key: "reu_preso", equals: true },
    },
    {
      key: "numero_processo_preso",
      label: "Número do processo",
      type: "text",
      showIf: { key: "reu_preso", equals: true },
    },
    { key: "audiencia_marcada", label: "Audiência marcada?", type: "boolean" },
    { key: "numero_inquerito", label: "Número do inquérito", type: "text" },
    { key: "delegacia", label: "Delegacia responsável", type: "text" },
    { key: "tipo_acusacao", label: "Tipo de acusação", type: "text" },
    { key: "ja_tem_advogado", label: "Já possui advogado?", type: "boolean" },
    { key: "flagrante", label: "Houve flagrante?", type: "boolean" },
    { key: "medida_cautelar", label: "Existe medida cautelar?", type: "boolean" },
    { key: "antecedentes", label: "Possui antecedentes?", type: "boolean" },
    { key: "urgente", label: "Processo urgente?", type: "boolean" },
  ],
  Cível: [
    { key: "problema_principal", label: "Qual problema principal?", type: "text" },
    { key: "existe_contrato", label: "Existe contrato?", type: "boolean" },
    { key: "prejuizo_financeiro", label: "Houve prejuízo financeiro?", type: "boolean" },
    { key: "tem_provas", label: "Possui provas?", type: "boolean" },
    { key: "tentou_acordo", label: "Tentou acordo?", type: "boolean" },
    { key: "ja_existe_processo", label: "Já existe processo?", type: "boolean" },
    { key: "valor_prejuizo", label: "Qual valor aproximado do prejuízo?", type: "text" },
    { key: "cobranca_indevida", label: "Existe cobrança indevida?", type: "boolean" },
    { key: "parte_contraria", label: "Parte contrária identificada?", type: "text" },
  ],
  Consumidor: [
    { key: "empresa_reclamada", label: "Empresa reclamada", type: "text" },
    { key: "produto_servico", label: "Produto ou serviço?", type: "text" },
    { key: "valor", label: "Valor envolvido", type: "text" },
    { key: "negativacao", label: "Houve negativação?", type: "boolean" },
    { key: "tem_protocolo", label: "Possui protocolo?", type: "text" },
    { key: "tentou_adm", label: "Tentou resolver administrativamente?", type: "boolean" },
    { key: "tem_comprovantes", label: "Possui comprovantes?", type: "boolean" },
    { key: "dano_moral", label: "Houve dano moral?", type: "boolean" },
    { key: "compra_online", label: "Compra online?", type: "boolean" },
  ],
  Empresarial: [
    { key: "tem_cnpj", label: "Empresa possui CNPJ?", type: "boolean" },
    { key: "cnpj", label: "CNPJ", type: "text", showIf: { key: "tem_cnpj", equals: true } },
    { key: "tipo_empresa", label: "Tipo (MEI, LTDA, S.A.)", type: "text" },
    { key: "ramo", label: "Ramo de atuação", type: "text" },
    { key: "qtd_socios", label: "Quantidade de sócios", type: "number" },
    { key: "tem_contrato_social", label: "Possui contrato social?", type: "boolean" },
    { key: "natureza_problema", label: "Natureza do problema", type: "text" },
  ],
  Imobiliário: [
    {
      key: "tipo_imovel",
      label: "Imóvel próprio ou alugado?",
      type: "select",
      options: ["Próprio", "Alugado", "Financiado", "Outro"],
    },
    { key: "existe_contrato", label: "Existe contrato?", type: "boolean" },
    { key: "problema_locacao", label: "Problema com locação?", type: "boolean" },
    { key: "inadimplencia", label: "Existe inadimplência?", type: "boolean" },
    { key: "tem_escritura", label: "Possui escritura?", type: "boolean" },
    { key: "disputa_posse", label: "Há disputa de posse?", type: "boolean" },
    { key: "financiado", label: "Imóvel financiado?", type: "boolean" },
    { key: "acao_judicial", label: "Existe ação judicial?", type: "boolean" },
  ],
  Tributário: [
    {
      key: "pf_pj",
      label: "Pessoa física ou jurídica?",
      type: "select",
      options: ["Pessoa física", "Pessoa jurídica"],
    },
    { key: "divida_fiscal", label: "Existe dívida fiscal?", type: "boolean" },
    { key: "notificacao", label: "Recebeu notificação?", type: "boolean" },
    { key: "parcelamento", label: "Possui parcelamento?", type: "boolean" },
    { key: "execucao_fiscal", label: "Existe execução fiscal?", type: "boolean" },
    { key: "valor_divida", label: "Valor aproximado da dívida", type: "text" },
    { key: "bloqueio", label: "Já houve bloqueio?", type: "boolean" },
  ],
  Bancário: [
    { key: "banco", label: "Banco envolvido", type: "text" },
    { key: "tipo_problema", label: "Tipo de problema", type: "text" },
    { key: "tem_emprestimo", label: "Existe empréstimo?", type: "boolean" },
    { key: "fraude", label: "Houve fraude?", type: "boolean" },
    { key: "negativacao", label: "Existe negativação?", type: "boolean" },
    { key: "tem_contrato", label: "Possui contrato?", type: "boolean" },
    { key: "desconto_indevido", label: "Houve desconto indevido?", type: "boolean" },
    { key: "valor", label: "Valor aproximado", type: "text" },
  ],
  Saúde: [
    { key: "plano_saude", label: "Plano de saúde?", type: "text" },
    { key: "houve_negativa", label: "Houve negativa?", type: "boolean" },
    { key: "procedimento", label: "Qual procedimento?", type: "text" },
    { key: "urgencia_medica", label: "Existe urgência?", type: "boolean" },
    { key: "tem_laudo", label: "Possui laudo médico?", type: "boolean" },
    { key: "contato_plano", label: "Já entrou em contato com o plano?", type: "boolean" },
    { key: "protocolo", label: "Possui protocolo?", type: "text" },
  ],
  Administrativo: [
    { key: "orgao", label: "Órgão público envolvido", type: "text" },
    { key: "processo_adm", label: "Existe processo administrativo?", type: "boolean" },
    { key: "multa", label: "Houve multa?", type: "boolean" },
    { key: "prazo", label: "Existe prazo?", type: "text" },
    { key: "notificacao", label: "Recebeu notificação?", type: "boolean" },
    { key: "deseja_recurso", label: "Deseja recurso?", type: "boolean" },
  ],
  "LGPD / Digital": [
    { key: "vazamento", label: "Vazamento de dados?", type: "boolean" },
    { key: "rede_social", label: "Rede social envolvida?", type: "text" },
    { key: "invasao", label: "Houve invasão?", type: "boolean" },
    { key: "tem_provas", label: "Possui provas?", type: "boolean" },
    { key: "conta_bloqueada", label: "Conta bloqueada?", type: "boolean" },
    { key: "prejuizo_financeiro", label: "Existe prejuízo financeiro?", type: "boolean" },
    { key: "empresa_responsavel", label: "Empresa responsável?", type: "text" },
  ],
  "Sucessões / Inventário": [
    { key: "testamento", label: "Existe testamento?", type: "boolean" },
    { key: "qtd_herdeiros", label: "Quantos herdeiros?", type: "number" },
    { key: "consenso", label: "Há consenso?", type: "boolean" },
    { key: "imoveis", label: "Existem imóveis?", type: "boolean" },
    { key: "inventario_aberto", label: "Existe inventário aberto?", type: "boolean" },
    { key: "falecimento_recente", label: "Falecimento recente?", type: "boolean" },
    { key: "bens_disputa", label: "Há bens em disputa?", type: "boolean" },
  ],
  Outro: [],
};

export function shouldShowField(field: DynField, values: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  return values[field.showIf.key] === field.showIf.equals;
}

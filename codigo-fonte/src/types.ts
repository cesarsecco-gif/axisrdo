export interface DriveFolderOption {
  id: string;
  name: string;
  period?: string; // e.g. "JULHO/2026"
  isDefault?: boolean;
}

export interface PhotoRecord {
  id: string;
  file?: File;
  imageUrl: string;
  tags?: string[];
  originalImageUrl?: string;
  sourcePhotoId?: string;
  stampEdit?: {mode:'band'|'replace';text:string;region:{x:number;y:number;width:number;height:number};editedAt:string;method:string};
  thumbnailUrl?: string;
  driveFileId?: string;
  driveViewLink?: string;
  driveDownloadLink?: string;
  
  // Folder & Report inclusion
  folderId?: string; // ID or key of the folder
  folderName?: string; // Name of the folder (e.g. "07_JULHO_2026")
  includedInReport?: boolean; // Whether this photo is included in the official DER report (defaults to true)
  manualOrder?: number; // Manual sequence in the report (position index); undefined = chronological
  
  // Official DER/PR fields
  data: string; // DD/MM/AAAA
  hora?: string; // HH:MM
  rodovia: string; // Ex: PR-317
  trecho: string; // Ex: Iguaraçu – Maringá
  servico: string; // Ex: Aplicação de malhas para cortina de projetado, muro C7, estaca 4537 a 4538 - LD
  estaca?: string; // Ex: 4537 a 4538
  lado?: 'LD' | 'LE' | 'MD' | 'ME' | 'PISTA' | 'AMBOS' | string;
  categoria?: string; // padronizada pelo catálogo "categorias"
  
  // NoteCam / GPS Watermark info
  latitude?: string;
  longitude?: string;
  elevacao?: string;
  precisao?: string;
  
  // Sync state
  driveStatus: 'pending' | 'uploading' | 'synced' | 'error';
  sheetsStatus: 'pending' | 'syncing' | 'synced' | 'error';
  aiAnalyzed?: boolean;
  contentHash?: string; // SHA-256 do conteúdo: usado para não importar a mesma foto duas vezes
  timestamp: number; // For chronological sorting
  pageNumber?: number; // Calculated or assigned page
}

export interface MudancaFuncao {
  desde: string; // YYYY-MM
  funcao: string;
  anterior: string;
}

export interface EquipeMember {
  id: string;
  matricula?: string;
  ativo?: boolean; // absent = inactive; migrarEquipe writes true for members that predate the field
  equipe?: string; // most recent month's team; suggestion only
  nome: string;
  funcao: string;
  meses?: Record<string, string>; // YYYY-MM -> team in that month
  historicoFuncao?: MudancaFuncao[]; // ascending by desde
}

export interface EquipeConfig {
  members: EquipeMember[];
  efetivo: Record<string, Record<string, number>>; // YYYY-MM-DD -> memberId -> value
}

export interface Equipamento {
  id: string;
  nome: string;
  placa: string;
}

export interface EquipamentosConfig {
  items: Equipamento[];
  efetivo: Record<string, Record<string, number>>; // YYYY-MM-DD -> equipId -> value
}

export interface AcaoCorretiva {
  id: string;
  rnf: string;
  acao: string;
  habilitacao: string; // Date or text
  implementacao: string; // Date or text
}

export interface PluviometriaDia {
  data: string; // YYYY-MM-DD
  manha: string;
  tarde: string;
  noite: string;
  clima?: string; // BOM, INSTÁVEL, CHUVOSO, IMPRATICÁVEL
  precipitacao: string; // mm
  observacao: string;
}

export interface PluviometriaConfig {
  dias: PluviometriaDia[];
  fontePrecipitacao?: string;
  urlPrecipitacao?: string;
}

export type CatalogoId='equipes'|'funcoes'|'equipamentos'|'placas'|'rodovias'|'trechos'
 |'estacas'|'lados'|'categorias'|'servicos'|'acoes';

export interface ReportConfig {
  rdo?: import('./services/rdo').RdoState;
  equipe?: EquipeConfig;
  equipamentos?: EquipamentosConfig;
  acoes?: AcaoCorretiva[];
  pluviometria?: PluviometriaConfig;
  tagCatalog?: string[];
  catalogos?: Partial<Record<CatalogoId, string[]>>;
  contrato: string; // Ex: "Contrato n.º CO141/2025-DT"
  orgaoPrincipal: string; // "ESTADO DO PARANÁ"
  secretaria: string; // "SECRETARIA DE ESTADO DE INFRAESTRUTURA E LOGISTICA"
  departamento: string; // "DEPARTAMENTO DE ESTRADAS DE RODAGEM"
  superintendencia: string; // "– DER/PR SUPERINTENDÊNCIA REGIONAL NOROESTE"
  titulo: string; // "RELATÓRIO FOTOGRÁFICO"
  subtitulo: string; // "REGISTRO FOTOGRÁFICO DOS SERVIÇOS EXECUTADOS – JUNHO/2026"
  mesAno: string; // "JUNHO/2026"
  headerBannerBase64?: string; // Banner de cabeçalho em base64 (White-Label)
  photosPerPage?: 4 | 6; // Layout option for 4 or 6 photos per page
  customTemplateBase64?: string; // @deprecated
  customTemplateMargins?: { top: number, bottom: number, left: number, right: number, horizontalSpacing: number, verticalSpacing: number }; // @deprecated
  rodoviaPadrao: string; // "PR-317"
  trechoPadrao: string; // "Iguaraçu – Maringá"
  driveFolderId: string; // "1iEBAUP5O6kLzC9YOdpfvPALeT7uP4was"
  driveFolderUrl: string;
  selectedDestinationFolderId?: string; // Currently chosen folder for uploading
  availableFolders?: DriveFolderOption[]; // List of available folders
  activeReportFolder?: string; // Filter for active report ("all" or folderId/name)
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  empresaExecutora: string; // "Consórcio Tripoloni / Consol / Weiller"
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  createdTime: string;
  size?: string;
}

export interface AIAnalysisResult {
  data: string;
  hora?: string;
  rodovia: string;
  trecho: string;
  servico: string;
  estaca?: string;
  lado?: string;
  categoria?: string;
  marcaDagua?: {
    latitude?: string;
    longitude?: string;
    elevacao?: string;
    textoDetectado?: string;
  };
  confianca?: 'alta' | 'media' | 'baixa';
}

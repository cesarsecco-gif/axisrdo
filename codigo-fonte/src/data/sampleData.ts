import { PhotoRecord, ReportConfig, DriveFolderOption } from '../types';

export const DEFAULT_FOLDERS: DriveFolderOption[] = [{id:'folder-set-2026',name:'09_SETEMBRO_2026',period:'SETEMBRO/2026',isDefault:true}];

export const DEFAULT_CONFIG: ReportConfig = {
  contrato: 'Contrato n.º 001/2026',
  orgaoPrincipal: 'AXIS CONSULTORIA E PLANEJAMENTO',
  secretaria: 'GERÊNCIA DE GESTÃO DE OBRAS E ENGENHARIA',
  departamento: 'SUPERVISÃO E FISCALIZAÇÃO TÉCNICA',
  superintendencia: 'SISTEMA AXIS RDO',
  titulo: 'RELATÓRIO FOTOGRÁFICO DE OBRAS',
  subtitulo: 'REGISTRO FOTOGRÁFICO DOS SERVIÇOS EXECUTADOS – SETEMBRO/2026',
  mesAno: 'SETEMBRO/2026',
  rodoviaPadrao: 'PR-317',
  trechoPadrao: 'Iguaraçu – Maringá',
  driveFolderId: '',
  driveFolderUrl: '',
  selectedDestinationFolderId: 'folder-set-2026',
  availableFolders: DEFAULT_FOLDERS,
  activeReportFolder: 'folder-set-2026',
  empresaExecutora: 'Consórcio Construtor',
  spreadsheetId: '',
  spreadsheetUrl: '',
};

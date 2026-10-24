import React, { useState } from 'react';
import { X, Save, Settings, Folder, FileText, Check, Image as ImageIcon, LayoutGrid } from 'lucide-react';
import { ReportConfig } from '../types';
import { defaultRdoSettings } from '../services/rdo';
import { CampoCatalogo } from './CampoCatalogo';
import { registrarValores, CatalogoId } from '../services/catalogos';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ReportConfig;
  onSave: (updated: ReportConfig) => void;
  inline?: boolean;
  onAbrirCatalogo?: (c: CatalogoId) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  inline,
  // onAbrirCatalogo is accepted but not used here: switching tabs would discard the unsaved form.
  onAbrirCatalogo
}) => {
  const [form, setForm] = useState<ReportConfig>({ ...config });
  const [rdoSettings, setRdoSettings] = useState(
    config.rdo?.settings ? { ...config.rdo.settings } : { ...defaultRdoSettings }
  );
  const [margins, setMargins] = useState(
    config.customTemplateMargins || { top: 220, bottom: 50, left: 20, right: 20, horizontalSpacing: 10, verticalSpacing: 10 }
  );
  const [photosPerPage, setPhotosPerPage] = useState<4 | 6>(
    config.photosPerPage || 4
  );



  if (!isOpen) return null;

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setForm({ ...form, headerBannerBase64: ev.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedForm = { ...form, customTemplateMargins: margins, photosPerPage };
    if (updatedForm.rdo) {
      updatedForm.rdo = { ...updatedForm.rdo, settings: rdoSettings };
    } else {
      updatedForm.rdo = { settings: rdoSettings, days: [] };
    }
    updatedForm.catalogos = registrarValores(config, [['rodovias', form.rodoviaPadrao], ['trechos', form.trechoPadrao]]).catalogos;
    onSave(updatedForm);
    if (!inline) onClose();
  };

  const content = (
    <div className={`bg-white ${inline ? 'rounded-xl border' : 'rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full my-8'} p-5 sm:p-6 space-y-5`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-700" />
          <h3 className="text-base font-bold text-slate-900">Configurações do Relatório e Contrato</h3>
        </div>
        {!inline && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Contrato & Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Número do Contrato
              </label>
              <input
                type="text"
                value={form.contrato}
                onChange={(e) => setForm({ ...form, contrato: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                placeholder="Ex: Contrato n.º CO141/2025-DT"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Mês / Ano do Relatório
              </label>
              <input
                type="text"
                value={form.mesAno}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({
                    ...form,
                    mesAno: val,
                    subtitulo: `REGISTRO FOTOGRÁFICO DOS SERVIÇOS EXECUTADOS – ${val}`,
                  });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                placeholder="Ex: JUNHO/2026 ou JULHO/2026"
                required
              />
            </div>
          </div>

          {/* Rodovia & Trecho */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoCatalogo catalogo="rodovias" config={config} valor={form.rodoviaPadrao} rotulo="Rodovia Padrão"
              placeholder="Ex: PR-317" inputClassName="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500" rotuloClassName="block text-[11px] font-bold text-slate-700 uppercase"
              onChange={(v) => setForm({ ...form, rodoviaPadrao: v })} />

            <CampoCatalogo catalogo="trechos" config={config} valor={form.trechoPadrao} rotulo="Trecho Padrão"
              placeholder="Ex: Iguaraçu – Maringá" inputClassName="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500" rotuloClassName="block text-[11px] font-bold text-slate-700 uppercase"
              onChange={(v) => setForm({ ...form, trechoPadrao: v })} />
          </div>

          {/* Superintendência ou Órgão */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Superintendência / Órgão ou Cliente
            </label>
            <input
              type="text"
              value={form.superintendencia}
              onChange={(e) => setForm({ ...form, superintendencia: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              placeholder="Ex: FISCALIZAÇÃO REGIONAL ou DIRETORIA DE ENGENHARIA"
            />
          </div>

          {/* Layout: 4 ou 6 fotos */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Layout do Relatório (Fotos por página)
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100">
                <input type="radio" name="layout" value={4} checked={photosPerPage === 4} onChange={() => setPhotosPerPage(4)} className="text-emerald-600 focus:ring-emerald-500" />
                <span className="text-xs font-semibold text-slate-700">4 Fotos por Página</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100">
                <input type="radio" name="layout" value={6} checked={photosPerPage === 6} onChange={() => setPhotosPerPage(6)} className="text-emerald-600 focus:ring-emerald-500" />
                <span className="text-xs font-semibold text-slate-700">6 Fotos por Página</span>
              </label>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 leading-tight">
              A opção de 6 fotos ajusta automaticamente os quadros de imagem para acomodar mais fotos por folha A4.
            </div>
          </div>

          {/* Cabeçalho Personalizado (Banner White-Label) */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Banner de Cabeçalho Personalizado (Logos)
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {form.headerBannerBase64 ? (
                <div className="relative w-full sm:w-1/2 h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1 shadow-sm">
                  <img src={form.headerBannerBase64} alt="Banner" className="max-h-full max-w-full object-contain" />
                  <button type="button" onClick={() => setForm({ ...form, headerBannerBase64: undefined })} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors" title="Remover Banner">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-full sm:w-1/2 flex items-center justify-center">
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-2 pb-2">
                      <p className="text-[10px] text-slate-500 font-semibold"><span className="font-bold text-emerald-600">Clique para anexar</span> ou arraste</p>
                    </div>
                    <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleBannerUpload} />
                  </label>
                </div>
              )}
              <div className="w-full sm:w-1/2 text-[10px] text-slate-500 leading-tight">
                Anexe uma imagem contendo os logos do órgão público, do cliente privado ou da construtora. 
                Se preenchido, esse banner substituirá automaticamente o cabeçalho padrão no topo de todos os relatórios gerados.
              </div>
            </div>
          </div>




          {/* Engenheiros & Responsáveis */}
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-2">
              Dados do RDO (Diário de Obras)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Empresa executora
                </label>
                <input
                  type="text"
                  value={rdoSettings.company}
                  onChange={(e) => setRdoSettings({ ...rdoSettings, company: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome da empresa ou consórcio"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Contrato do RDO
                </label>
                <input
                  type="text"
                  value={rdoSettings.contract}
                  onChange={(e) => setRdoSettings({ ...rdoSettings, contract: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Ex: CO141/2025 - DT"
                  maxLength={85}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Supervisora
                </label>
                <input
                  type="text"
                  value={rdoSettings.supervisor}
                  onChange={(e) => setRdoSettings({ ...rdoSettings, supervisor: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome da empresa de supervisão"
                  maxLength={85}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Gerente de Contrato da Executora
                </label>
                <input
                  type="text"
                  value={rdoSettings.manager}
                  onChange={(e) => setRdoSettings({ ...rdoSettings, manager: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome do Gerente"
                  maxLength={60}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Engenheiro Preposto
                </label>
                <input
                  type="text"
                  value={rdoSettings.preposto}
                  onChange={(e) => setRdoSettings({ ...rdoSettings, preposto: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome do Preposto"
                  maxLength={55}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Engenheiro da Supervisora
                </label>
                <input
                  type="text"
                  value={rdoSettings.supervisorEngineer}
                  onChange={(e) => setRdoSettings({ ...rdoSettings, supervisorEngineer: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome do Supervisão"
                  maxLength={58}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Engenheiro Fiscal do DER
                </label>
                <input
                  type="text"
                  value={rdoSettings.inspector}
                  onChange={(e) => setRdoSettings({ ...rdoSettings, inspector: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome do Fiscal"
                  maxLength={58}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Observações padrão da supervisora
              </label>
              <textarea
                rows={3}
                value={rdoSettings.supervisorNotes}
                onChange={(e) => setRdoSettings({ ...rdoSettings, supervisorNotes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                placeholder="Texto aplicado a todos os RDOs do projeto"
                maxLength={20000}
              />
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Observações padrão do fiscal do DER
              </label>
              <textarea
                rows={3}
                value={rdoSettings.inspectorNotes}
                onChange={(e) => setRdoSettings({ ...rdoSettings, inspectorNotes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                placeholder="Texto aplicado a todos os RDOs do projeto"
                maxLength={20000}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Configurações</span>
            </button>
          </div>
        </form>
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {content}
    </div>
  );
};

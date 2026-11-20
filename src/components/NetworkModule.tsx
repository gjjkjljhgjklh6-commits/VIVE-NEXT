import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Network,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AFFILIATION_PACKAGES, RANK_MAP } from '../data/compensationPlan';
import {
  fetchPartnerPrivateInfo,
  registerPartnerNode,
  updatePartnerPrivateInfo,
} from '../services/firestoreService';
import type { BinaryLeg, PackageTier, Partner, PartnerPrivateInfo } from '../types/vivenext';

interface NetworkModuleProps {
  currentPartner: Partner;
  partners: Partner[];
  currentUserUid: string;
}

export const NetworkModule: React.FC<NetworkModuleProps> = ({
  currentPartner,
  partners,
  currentUserUid,
}) => {
  const [treeView, setTreeView] = useState<'unilevel' | 'binary'>('unilevel');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(currentPartner.id);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    [currentPartner.id]: true,
    vn_root: true,
    vn_p_valeria: true,
    vn_p_carlos: true,
  });

  // Private PII modal/section for own node
  const [privateInfo, setPrivateInfo] = useState<PartnerPrivateInfo | null>(null);
  const [editingPii, setEditingPii] = useState(false);
  const [piiForm, setPiiForm] = useState({
    phone: '',
    ciNumber: '',
    city: '',
    bankName: '',
    bankAccount: '',
  });
  const [piiStatus, setPiiStatus] = useState('');

  // Recruit modal
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [recruitSaving, setRecruitSaving] = useState(false);
  const [recruitError, setRecruitError] = useState('');
  const [recruitForm, setRecruitForm] = useState({
    fullName: '',
    sponsorId: currentPartner.id,
    binaryParentId: currentPartner.id,
    binaryLeg: 'left' as BinaryLeg,
    packageTier: 'emprendedor' as PackageTier,
    email: '',
    phone: '+591 ',
    ciNumber: '',
    city: 'Santa Cruz de la Sierra',
    bankName: 'Banco Mercantil Santa Cruz',
    bankAccount: '',
  });

  useEffect(() => {
    let active = true;
    fetchPartnerPrivateInfo(currentPartner.id)
      .then((info) => {
        if (active && info) {
          setPrivateInfo(info);
          setPiiForm({
            phone: info.phone,
            ciNumber: info.ciNumber,
            city: info.city,
            bankName: info.bankName,
            bankAccount: info.bankAccount,
          });
        }
      })
      .catch(() => {
        // Handled cleanly if missing
      });
    return () => {
      active = false;
    };
  }, [currentPartner.id]);

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) || currentPartner,
    [partners, selectedPartnerId, currentPartner]
  );

  const directReferrals = useMemo(
    () => partners.filter((p) => p.sponsorId === selectedPartner.id),
    [partners, selectedPartner.id]
  );

  const filteredPartners = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.referralCode.toLowerCase().includes(q) ||
        RANK_MAP[p.rankId]?.name.toLowerCase().includes(q)
    );
  }, [partners, searchTerm]);

  const minorCv = Math.min(selectedPartner.leftBranchCv, selectedPartner.rightBranchCv);
  const majorCv = Math.max(selectedPartner.leftBranchCv, selectedPartner.rightBranchCv);
  const eqPercent = majorCv > 0 ? Math.round((minorCv / majorCv) * 1000) / 10 : 100;

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSavePii = async (e: React.FormEvent) => {
    e.preventDefault();
    setPiiStatus('');
    await updatePartnerPrivateInfo(currentPartner.id, piiForm);
    setPrivateInfo((prev) => (prev ? { ...prev, ...piiForm } : prev));
    setEditingPii(false);
    setPiiStatus('Datos personales y bancarios actualizados.');
  };

  const handleRecruitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recruitForm.fullName.trim().length < 2) {
      setRecruitError('Ingresa el nombre del nuevo socio.');
      return;
    }
    setRecruitError('');
    setRecruitSaving(true);
    try {
      const sponsor = partners.find((p) => p.id === recruitForm.sponsorId) || currentPartner;
      const uplines = Array.from(new Set([currentUserUid, sponsor.ownerUid, ...(sponsor.uplineUids || [])]));
      const newId = `vn_p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await registerPartnerNode({
        id: newId,
        ownerUid: currentUserUid,
        fullName: recruitForm.fullName,
        sponsorId: sponsor.id,
        binaryParentId: recruitForm.binaryParentId || sponsor.id,
        binaryLeg: recruitForm.binaryLeg,
        packageTier: recruitForm.packageTier,
        uplineUids: uplines,
        email: recruitForm.email || `${newId}@vivenext.bo`,
        phone: recruitForm.phone,
        ciNumber: recruitForm.ciNumber,
        city: recruitForm.city,
        bankName: recruitForm.bankName,
        bankAccount: recruitForm.bankAccount,
      });
      setShowRecruitModal(false);
      setRecruitForm((prev) => ({ ...prev, fullName: '', email: '', ciNumber: '', bankAccount: '' }));
    } catch (err) {
      setRecruitError(err instanceof Error ? err.message : 'No se pudo registrar el socio.');
    } finally {
      setRecruitSaving(false);
    }
  };

  const renderUnilevelNode = (node: Partner, depth = 0): React.ReactNode => {
    const children = partners.filter((p) => p.sponsorId === node.id);
    const isExpanded = expandedNodes[node.id] ?? depth < 2;
    const isSelected = selectedPartner.id === node.id;

    return (
      <div key={node.id} className={depth > 0 ? 'ml-6 pl-4 border-l border-slate-200' : ''}>
        <div
          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors mb-2 ${
            isSelected
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {children.length > 0 ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className={`p-1 rounded hover:bg-black/10 cursor-pointer ${
                  isSelected ? 'text-white' : 'text-slate-500'
                }`}
                aria-label="Expandir o contraer nivel"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-6 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => setSelectedPartnerId(node.id)}
              className="text-left min-w-0 cursor-pointer"
            >
              <div className="text-sm font-semibold truncate">{node.fullName}</div>
              <div
                className={`text-xs flex items-center gap-1.5 ${
                  isSelected ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                <span>{RANK_MAP[node.rankId]?.name}</span>
                <span aria-hidden="true">·</span>
                <span>{AFFILIATION_PACKAGES[node.packageTier].name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{node.referralCode}</span>
              </div>
            </button>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-mono-num font-semibold">
              {node.personalPv} PV / {node.teamCv.toLocaleString('es-BO')} CV
            </div>
            <div
              className={`text-[11px] font-medium ${
                isSelected
                  ? 'text-slate-300'
                  : node.status === 'activo'
                  ? 'text-[#15803D]'
                  : node.status === 'pendiente'
                  ? 'text-[#B45309]'
                  : 'text-red-600'
              }`}
            >
              {node.status === 'activo'
                ? 'Activo'
                : node.status === 'pendiente'
                ? 'Pendiente'
                : 'Inactivo'}
              {' · '}
              {children.length} directos
            </div>
          </div>
        </div>
        {isExpanded && children.map((child) => renderUnilevelNode(child, depth + 1))}
      </div>
    );
  };

  const renderBinaryTree = (node: Partner | undefined, legLabel: string, depth = 0): React.ReactNode => {
    if (!node) {
      return (
        <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center text-xs text-slate-400 bg-slate-50/50">
          Posición {legLabel} disponible
        </div>
      );
    }
    const leftChild = partners.find((p) => p.binaryParentId === node.id && p.binaryLeg === 'left');
    const rightChild = partners.find((p) => p.binaryParentId === node.id && p.binaryLeg === 'right');

    return (
      <div className="flex flex-col items-center w-full">
        <button
          type="button"
          onClick={() => setSelectedPartnerId(node.id)}
          className={`w-full max-w-[230px] p-3 rounded-lg border text-left transition-colors cursor-pointer ${
            selectedPartner.id === node.id
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="text-[11px] opacity-75 mb-0.5">
            {legLabel} · {AFFILIATION_PACKAGES[node.packageTier].name}
          </div>
          <div className="text-sm font-semibold truncate">{node.fullName}</div>
          <div className="mt-1.5 flex items-center justify-between text-xs font-mono-num">
            <span>{RANK_MAP[node.rankId]?.name}</span>
            <span>{node.personalPv} PV</span>
          </div>
          <div className="mt-1 text-[11px] font-mono-num opacity-80 flex justify-between">
            <span>Izq: {node.leftBranchCv.toLocaleString('es-BO')}</span>
            <span>Der: {node.rightBranchCv.toLocaleString('es-BO')}</span>
          </div>
        </button>

        {depth < 2 && (
          <div className="grid grid-cols-2 gap-3 w-full mt-3 pt-3 border-t border-slate-200">
            <div>{renderBinaryTree(leftChild, 'Izquierda', depth + 1)}</div>
            <div>{renderBinaryTree(rightChild, 'Derecha', depth + 1)}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Red Multinivel y Socios</h1>
          <p className="text-sm text-slate-500">
            Árbol unilevel, estructura binaria izquierda/derecha, referidos directos y perfiles de red.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setTreeView('unilevel')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                treeView === 'unilevel' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Árbol Unilevel
            </button>
            <button
              type="button"
              onClick={() => setTreeView('binary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                treeView === 'binary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Estructura Binaria
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowRecruitModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Afiliar Socio
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Socios en Red</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">{partners.length}</div>
          <div className="text-xs text-slate-500 mt-1">
            {partners.filter((p) => p.status === 'activo').length} activos (≥ 75 PV)
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Rama Izquierda / Derecha</div>
          <div className="text-lg font-bold text-slate-900 font-mono-num mt-1">
            {selectedPartner.leftBranchCv.toLocaleString('es-BO')} /{' '}
            {selectedPartner.rightBranchCv.toLocaleString('es-BO')} CV
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Rama menor: <span className="font-mono-num font-semibold text-slate-800">{minorCv.toLocaleString('es-BO')} CV</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Equilibrio Binario (Garantía C)</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">{eqPercent}%</div>
          <div className={`text-xs font-medium mt-1 ${eqPercent >= 30 ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
            {eqPercent >= 30 ? 'Cumple mínimo ≥ 30%' : 'Requiere balance ≥ 30%'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Tu Código de Patrocinador</div>
          <div className="text-lg font-bold text-slate-900 font-mono-num mt-1">
            {currentPartner.referralCode}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Paquete: {AFFILIATION_PACKAGES[currentPartner.packageTier].name}
          </div>
        </div>
      </div>

      {/* Main Split: Tree + Selected Partner Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              {treeView === 'unilevel' ? (
                <Network className="w-4 h-4 text-[#8B1E24]" />
              ) : (
                <GitBranch className="w-4 h-4 text-[#8B1E24]" />
              )}
              <h2 className="text-base font-semibold text-slate-900">
                {treeView === 'unilevel'
                  ? 'Árbol Jerárquico de Patrocinio'
                  : `Árbol Binario desde ${selectedPartner.fullName}`}
              </h2>
            </div>
            {selectedPartner.id !== currentPartner.id && (
              <button
                type="button"
                onClick={() => setSelectedPartnerId(currentPartner.id)}
                className="text-xs font-medium text-[#8B1E24] hover:underline whitespace-nowrap cursor-pointer"
              >
                Volver a mi nodo
              </button>
            )}
          </div>

          {treeView === 'unilevel' ? (
            <div className="space-y-1">
              {renderUnilevelNode(
                partners.find((p) => p.id === 'vn_root') || currentPartner,
                0
              )}
              {partners
                .filter(
                  (p) =>
                    p.id !== 'vn_root' &&
                    !partners.some((parent) => parent.id === p.sponsorId)
                )
                .map((orphan) => renderUnilevelNode(orphan, 0))}
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              {renderBinaryTree(selectedPartner, 'Nodo Base', 0)}
            </div>
          )}
        </div>

        {/* Selected Node Details & Personal PII */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Detalle del Socio</h3>
              <span
                className={`text-xs font-medium ${
                  selectedPartner.status === 'activo'
                    ? 'text-[#15803D]'
                    : selectedPartner.status === 'pendiente'
                    ? 'text-[#B45309]'
                    : 'text-red-600'
                }`}
              >
                {selectedPartner.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Nombre y Código</div>
                <div className="font-semibold text-slate-900">{selectedPartner.fullName}</div>
                <div className="text-xs font-mono-num text-slate-500">{selectedPartner.referralCode}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Rango Actual</div>
                  <div className="font-semibold text-slate-900">
                    {RANK_MAP[selectedPartner.rankId]?.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Paquete</div>
                  <div className="font-semibold text-slate-900">
                    {AFFILIATION_PACKAGES[selectedPartner.packageTier].name}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 font-mono-num">
                <div>
                  <div className="text-xs text-slate-500 font-sans">PV / CV Personal</div>
                  <div className="font-semibold text-slate-900">
                    {selectedPartner.personalPv} PV / {selectedPartner.personalCv} CV
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-sans">CV Grupal</div>
                  <div className="font-semibold text-slate-900">
                    {selectedPartner.teamCv.toLocaleString('es-BO')} CV
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-1.5">Referidos Directos ({directReferrals.length})</div>
                {directReferrals.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin referidos directos registrados.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {directReferrals.map((d) => (
                      <li key={d.id} className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerId(d.id)}
                          className="text-slate-700 hover:text-[#8B1E24] font-medium truncate cursor-pointer"
                        >
                          {d.fullName}
                        </button>
                        <span className="font-mono-num text-slate-500">{d.personalPv} PV</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Private PII Profile Card for Current User */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#8B1E24]" />
                <h3 className="text-sm font-semibold text-slate-900">Mi Perfil Privado y Cuenta</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPii((v) => !v)}
                className="text-xs font-medium text-[#8B1E24] hover:underline cursor-pointer"
              >
                {editingPii ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            {piiStatus && (
              <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                {piiStatus}
              </div>
            )}
            {editingPii ? (
              <form onSubmit={handleSavePii} className="space-y-3">
                <input
                  type="text"
                  value={piiForm.phone}
                  onChange={(e) => setPiiForm({ ...piiForm, phone: e.target.value })}
                  placeholder="Teléfono"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.ciNumber}
                  onChange={(e) => setPiiForm({ ...piiForm, ciNumber: e.target.value })}
                  placeholder="Cédula de Identidad"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.city}
                  onChange={(e) => setPiiForm({ ...piiForm, city: e.target.value })}
                  placeholder="Ciudad"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.bankName}
                  onChange={(e) => setPiiForm({ ...piiForm, bankName: e.target.value })}
                  placeholder="Banco"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.bankAccount}
                  onChange={(e) => setPiiForm({ ...piiForm, bankAccount: e.target.value })}
                  placeholder="Número de Cuenta"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] cursor-pointer"
                >
                  Guardar Datos
                </button>
              </form>
            ) : (
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Correo:</span>
                  <span className="font-medium text-slate-900">{privateInfo?.email || 'Protegido'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Teléfono:</span>
                  <span className="font-mono-num text-slate-900">{privateInfo?.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ciudad / CI:</span>
                  <span className="text-slate-900">
                    {privateInfo?.city || '—'} · {privateInfo?.ciNumber || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Banco Retiros:</span>
                  <span className="text-slate-900 truncate max-w-[170px]">
                    {privateInfo?.bankName || '—'} ({privateInfo?.bankAccount || '—'})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8B1E24]" />
            <h2 className="text-base font-semibold text-slate-900">Directorio de Socios de la Red</h2>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar socio, código o rango..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#8B1E24]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-3">Socio</th>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Paquete</th>
                <th className="py-2.5 px-3">Rango</th>
                <th className="py-2.5 px-3 text-right">PV Mes</th>
                <th className="py-2.5 px-3 text-right">CV Equipo</th>
                <th className="py-2.5 px-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPartners.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedPartnerId(p.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-slate-900">{p.fullName}</td>
                  <td className="py-2.5 px-3 text-xs font-mono-num text-slate-500">{p.referralCode}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    {AFFILIATION_PACKAGES[p.packageTier].name}
                  </td>
                  <td className="py-2.5 px-3 text-xs font-medium text-slate-800">
                    {RANK_MAP[p.rankId]?.name}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">{p.personalPv}</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                    {p.teamCv.toLocaleString('es-BO')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-medium">
                    <span
                      className={
                        p.status === 'activo'
                          ? 'text-[#15803D]'
                          : p.status === 'pendiente'
                          ? 'text-[#B45309]'
                          : 'text-red-600'
                      }
                    >
                      {p.status === 'activo' ? 'Activo' : p.status === 'pendiente' ? 'Pendiente' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Afiliar Nuevo Socio */}
      {showRecruitModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Afiliar Nuevo Socio</h3>
              <button
                type="button"
                onClick={() => setShowRecruitModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecruitSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={recruitForm.fullName}
                    onChange={(e) => setRecruitForm({ ...recruitForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Ej. Camila Torrez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Patrocinador</label>
                  <select
                    value={recruitForm.sponsorId}
                    onChange={(e) =>
                      setRecruitForm({
                        ...recruitForm,
                        sponsorId: e.target.value,
                        binaryParentId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.referralCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pierna Binaria</label>
                  <select
                    value={recruitForm.binaryLeg}
                    onChange={(e) => setRecruitForm({ ...recruitForm, binaryLeg: e.target.value as BinaryLeg })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="left">Equipo Izquierdo</option>
                    <option value="right">Equipo Derecho</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Paquete</label>
                  <select
                    value={recruitForm.packageTier}
                    onChange={(e) => setRecruitForm({ ...recruitForm, packageTier: e.target.value as PackageTier })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="base">Distribuidor Base (975 Bs)</option>
                    <option value="emprendedor">Emprendedor (1.950 Bs)</option>
                    <option value="elite">Emprendedor Élite (3.900 Bs)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={recruitForm.city}
                    onChange={(e) => setRecruitForm({ ...recruitForm, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={recruitForm.phone}
                    onChange={(e) => setRecruitForm({ ...recruitForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    value={recruitForm.email}
                    onChange={(e) => setRecruitForm({ ...recruitForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="socio@correo.com"
                  />
                </div>
              </div>

              {recruitError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {recruitError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecruitModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={recruitSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] disabled:opacity-50 cursor-pointer"
                >
                  {recruitSaving ? 'Registrando...' : 'Registrar Socio en Red'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

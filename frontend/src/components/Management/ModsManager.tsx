import React, { useEffect, useState } from 'react';
import { modsAPI, Mod, SyncModsResponse } from '../../api/client';
import { useServerStore } from '../../store/serverStore';
import { useI18n } from '../../i18n';
import { 
  Package, RefreshCw, ExternalLink, AlertCircle, Search, 
  Plus, Trash2, Download, Upload, Play, Loader2, Check, X,
  Link, DownloadCloud, ChevronDown, ChevronRight
} from 'lucide-react';

export const ModsManager: React.FC = () => {
  const { t } = useI18n();
  const { selectedServerId, getSelectedServer } = useServerStore();
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMods, setExpandedMods] = useState<Set<number>>(new Set());
  
  // Add mod form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'url' | 'manual'>('url');
  const [addUrl, setAddUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedMod, setParsedMod] = useState<{ workshop_id: string; mod_ids: string[]; name: string | null } | null>(null);
  const [selectedModIds, setSelectedModIds] = useState<string[]>([]);
  const [manualModId, setManualModId] = useState('');
  const [manualWorkshopId, setManualWorkshopId] = useState('');
  const [manualName, setManualName] = useState('');
  
  // Apply state
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  
  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncModsResponse | null>(null);
  const [showSyncResult, setShowSyncResult] = useState(false);

  useEffect(() => {
    if (selectedServerId) {
      loadMods();
    }
  }, [selectedServerId]);

  const loadMods = async () => {
    if (!selectedServerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await modsAPI.list(selectedServerId);
      setMods(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleParseUrl = async () => {
    if (!addUrl.trim()) return;
    
    setParsing(true);
    setError(null);
    setParsedMod(null);
    setSelectedModIds([]);
    
    try {
      const result = await modsAPI.parse(addUrl);
      setParsedMod(result);
      // Pre-select all mod_ids by default
      setSelectedModIds(result.mod_ids);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.parseError'));
    } finally {
      setParsing(false);
    }
  };

  const handleFetchNameByWorkshopId = async () => {
    if (!manualWorkshopId.trim()) return;
    
    setParsing(true);
    setError(null);
    
    try {
      const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${manualWorkshopId.trim()}`;
      const result = await modsAPI.parse(url);
      setManualName(result.name || '');
      // Also fill mod_id if found and not already set
      if (result.mod_ids.length > 0 && !manualModId.trim()) {
        setManualModId(result.mod_ids[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error fetching data');
    } finally {
      setParsing(false);
    }
  };

  const handleAddMod = async () => {
    if (!selectedServerId) return;
    
    if (addMode === 'url') {
      // URL mode - add ONE record with all mod_ids
      if (!parsedMod) return;
      
      // If mod_ids found - use them, if not - use manual input
      const allModIds = parsedMod.mod_ids.length > 0 ? parsedMod.mod_ids : [manualModId.trim()].filter(Boolean);
      
      if (allModIds.length === 0) {
        setError(t('mods.selectOrEnterModId'));
        return;
      }
      
      try {
        // Add ONE record with all mod_ids
        // selectedModIds determines which are enabled
        await modsAPI.add(selectedServerId, {
          workshop_id: parsedMod.workshop_id,
          mod_ids: allModIds,
          enabled_mod_ids: selectedModIds.filter(id => allModIds.includes(id)),
          name: parsedMod.name || undefined,
          is_enabled: selectedModIds.length > 0
        });
        resetAddForm();
        loadMods();
      } catch (err: any) {
        setError(err.response?.data?.detail || t('mods.addError'));
      }
    } else {
      // Manual mode - single mod_id
      const workshopId = manualWorkshopId.trim();
      const modId = manualModId.trim();
      const name = manualName.trim() || undefined;
      
      if (!workshopId) {
        setError(t('mods.workshopIdRequired'));
        return;
      }
      if (!modId) {
        setError(t('mods.modIdRequired'));
        return;
      }
      
      try {
        await modsAPI.add(selectedServerId, {
          workshop_id: workshopId,
          mod_ids: [modId],
          enabled_mod_ids: [],  // Initially disabled
          name: name,
          is_enabled: false
        });
        
        resetAddForm();
        loadMods();
      } catch (err: any) {
        setError(err.response?.data?.detail || t('mods.addError'));
      }
    }
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setAddMode('url');
    setAddUrl('');
    setParsedMod(null);
    setSelectedModIds([]);
    setManualModId('');
    setManualWorkshopId('');
    setManualName('');
  };

  const handleToggleMod = async (mod: Mod) => {
    if (!selectedServerId) return;
    
    try {
      // Toggle all mod_ids - if currently enabled, disable all; if disabled, enable all
      const newEnabledModIds = mod.is_enabled ? [] : [...mod.mod_ids];
      await modsAPI.update(selectedServerId, mod.id, { 
        enabled_mod_ids: newEnabledModIds,
        is_enabled: !mod.is_enabled 
      });
      setMods(mods.map(m => m.id === mod.id ? { 
        ...m, 
        is_enabled: !m.is_enabled,
        enabled_mod_ids: newEnabledModIds
      } : m));
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.updateError'));
    }
  };

  const handleToggleModId = async (mod: Mod, modIdToToggle: string) => {
    if (!selectedServerId) return;
    
    try {
      const isCurrentlyEnabled = mod.enabled_mod_ids.includes(modIdToToggle);
      const newEnabledModIds = isCurrentlyEnabled 
        ? mod.enabled_mod_ids.filter(id => id !== modIdToToggle)
        : [...mod.enabled_mod_ids, modIdToToggle];
      
      await modsAPI.update(selectedServerId, mod.id, { 
        enabled_mod_ids: newEnabledModIds,
        is_enabled: newEnabledModIds.length > 0
      });
      setMods(mods.map(m => m.id === mod.id ? { 
        ...m, 
        enabled_mod_ids: newEnabledModIds,
        is_enabled: newEnabledModIds.length > 0
      } : m));
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.updateError'));
    }
  };

  const handleDeleteMod = async (mod: Mod) => {
    if (!selectedServerId) return;
    if (!confirm(t('mods.deleteConfirm').replace('{name}', mod.name || mod.mod_ids.join(', ')))) return;
    
    try {
      await modsAPI.delete(selectedServerId, mod.id);
      setMods(mods.filter(m => m.id !== mod.id));
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.deleteError'));
    }
  };

  const handleSyncFromServer = async () => {
    if (!selectedServerId) return;
    
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    
    try {
      const result = await modsAPI.sync(selectedServerId);
      setSyncResult(result);
      setShowSyncResult(true);
      loadMods(); // Reload mods after sync
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.syncError'));
    } finally {
      setSyncing(false);
    }
  };

  const handleApplyMods = async () => {
    if (!selectedServerId) return;
    
    setApplying(true);
    setApplyResult(null);
    setError(null);
    
    try {
      const result = await modsAPI.apply(selectedServerId);
      setApplyResult(t('mods.applySuccess').replace('{mods}', String(result.enabled_count)).replace('{workshops}', String(result.workshops_count)));
      setTimeout(() => setApplyResult(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.applyError'));
    } finally {
      setApplying(false);
    }
  };

  const handleExport = async () => {
    if (!selectedServerId) return;
    
    try {
      const data = await modsAPI.export(selectedServerId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename: connection_name_date_time.json
      const server = getSelectedServer();
      const serverName = server?.name?.replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄ]/g, '_') || `server_${selectedServerId}`;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
      a.download = `${serverName}_${dateStr}_${timeStr}.json`;
      
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.exportError'));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedServerId || !e.target.files?.length) return;
    
    const file = e.target.files[0];
    const text = await file.text();
    
    try {
      const data = JSON.parse(text);
      const result = await modsAPI.import(selectedServerId, data);
      alert(t('mods.importedCount').replace('{count}', String(result.imported)) + `, ${t('mods.updated')}: ${result.updated}`);
      loadMods();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.importError'));
    }
    
    e.target.value = '';
  };

  const toggleExpanded = (modId: number) => {
    setExpandedMods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(modId)) {
        newSet.delete(modId);
      } else {
        newSet.add(modId);
      }
      return newSet;
    });
  };

  const filteredMods = mods.filter(mod =>
    mod.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.mod_ids.some(id => id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    mod.workshop_id.includes(searchTerm)
  );

  const enabledCount = mods.reduce((count, m) => count + m.enabled_mod_ids.length, 0);

  if (!selectedServerId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Package className="mb-4" size={48} />
        <p>{t('mods.selectServer')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="text-green-500" />
          {t('mods.title')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus size={18} />
            {t('mods.add')}
          </button>
          <button
            onClick={loadMods}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
            <span className="text-gray-400 text-sm">{t('common.total')}:</span>
            <span className="text-white font-bold ml-2">{mods.length}</span>
          </div>
          <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
            <span className="text-gray-400 text-sm">{t('common.enabled')}:</span>
            <span className="text-green-400 font-bold ml-2">{enabledCount}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncFromServer}
            disabled={syncing}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-3 py-2 rounded-lg transition text-sm"
            title={t('mods.syncTitle')}
          >
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
            {t('mods.syncFromServer')}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition text-sm"
          >
            <Download size={16} />
            {t('common.export')}
          </button>
          <label className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition text-sm cursor-pointer">
            <Upload size={16} />
            {t('common.import')}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={handleApplyMods}
            disabled={applying || enabledCount === 0}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-4 py-2 rounded-lg transition"
          >
            {applying ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {t('common.apply')}
          </button>
        </div>
      </div>

      {/* Apply Result */}
      {applyResult && (
        <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 text-green-200">
          {applyResult}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('mods.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
          <AlertCircle size={20} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Mods List */}
      {!loading && mods.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="bg-gray-700/50 px-4 py-3 border-b border-gray-700 grid grid-cols-12 gap-4 text-sm font-semibold text-gray-400">
            <div className="col-span-1">{t('mods.tableEnabled')}</div>
            <div className="col-span-4">{t('common.name')}</div>
            <div className="col-span-3">{t('mods.modId')}</div>
            <div className="col-span-2">{t('mods.workshopId')}</div>
            <div className="col-span-2">{t('common.actions')}</div>
          </div>
          
          <div className="divide-y divide-gray-700 max-h-[500px] overflow-y-auto">
            {filteredMods.map((mod) => {
              const isExpanded = expandedMods.has(mod.id);
              const hasMultipleModIds = mod.mod_ids.length > 1;
              
              return (
                <div key={mod.id}>
                  {/* Main row */}
                  <div 
                    className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition ${
                      mod.is_enabled ? 'hover:bg-gray-700/30' : 'bg-gray-900/50 opacity-60'
                    }`}
                  >
                    <div className="col-span-1">
                      <button
                        onClick={() => handleToggleMod(mod)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition ${
                          mod.is_enabled 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-gray-600 hover:bg-gray-500'
                        }`}
                        title={mod.is_enabled ? t('common.disable') : t('common.enable')}
                      >
                        {mod.is_enabled && <Check size={14} />}
                      </button>
                    </div>
                    <div className="col-span-4 truncate flex items-center gap-2">
                      {hasMultipleModIds && (
                        <button
                          onClick={() => toggleExpanded(mod.id)}
                          className="text-gray-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}
                      <span className="text-white" title={mod.name || mod.mod_ids.join(', ')}>
                        {mod.name || mod.mod_ids[0]}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <span className="font-mono text-green-400 text-sm">
                        {mod.mod_ids.length === 1 
                          ? mod.mod_ids[0] 
                          : `${mod.enabled_mod_ids.length}/${mod.mod_ids.length}`}
                      </span>
                      {hasMultipleModIds && (
                        <span className="text-gray-500 text-xs ml-1">({t('mods.multipleIds')})</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="font-mono text-blue-400 text-sm">{mod.workshop_id}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      {mod.workshop_url && (
                        <a
                          href={mod.workshop_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                          title={t('mods.openWorkshop')}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteMod(mod)}
                        className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition"
                        title={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded mod_ids list */}
                  {isExpanded && hasMultipleModIds && (
                    <div className="bg-gray-900/50 border-t border-gray-700">
                      <div className="pl-12 pr-4 py-2 space-y-1">
                        <p className="text-xs text-gray-500 mb-2">{t('mods.selectModIds')}:</p>
                        {mod.mod_ids.map((modId) => (
                          <label 
                            key={modId} 
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/30 p-1.5 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={mod.enabled_mod_ids.includes(modId)}
                              onChange={() => handleToggleModId(mod, modId)}
                              className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-green-500"
                            />
                            <span className={`font-mono text-sm ${
                              mod.enabled_mod_ids.includes(modId) ? 'text-green-400' : 'text-gray-400'
                            }`}>
                              {modId}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && mods.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Package className="mx-auto mb-4 opacity-50" size={48} />
          <p>{t('mods.noMods')}</p>
        </div>
      )}

      {/* Add Mod Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="text-green-500" />
              {t('mods.add')}
            </h3>

            {/* Mode Tabs */}
            <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setAddMode('url')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  addMode === 'url'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Link size={16} className="inline mr-2" />
                {t('mods.fromUrl')}
              </button>
              <button
                onClick={() => setAddMode('manual')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  addMode === 'manual'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Plus size={16} className="inline mr-2" />
                {t('mods.manual')}
              </button>
            </div>

            <div className="space-y-4">
              {addMode === 'url' ? (
                <>
                  {/* URL Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Steam Workshop URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addUrl}
                        onChange={(e) => setAddUrl(e.target.value)}
                        placeholder="https://steamcommunity.com/sharedfiles/filedetails?id=..."
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleParseUrl}
                        disabled={parsing || !addUrl.trim()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded transition"
                      >
                        {parsing ? <Loader2 size={18} className="animate-spin" /> : <Link size={18} />}
                        {t('mods.parse')}
                      </button>
                    </div>
                  </div>

                  {/* Parsed Result */}
                  {parsedMod && (
                    <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                      <div>
                        <span className="text-gray-400 text-sm">{t('common.name')}:</span>
                        <span className="text-white ml-2">{parsedMod.name || `(${t('mods.notFound')})`}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">{t('mods.workshopId')}:</span>
                        <span className="text-blue-400 font-mono ml-2">{parsedMod.workshop_id}</span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-400 mb-1">
                          {t('mods.modId')} {parsedMod.mod_ids.length === 0 && <span className="text-yellow-400">({t('mods.notFoundOnPage')})</span>}
                        </span>
                        {parsedMod.mod_ids.length > 0 && (
                          <p className="text-xs text-gray-500 mb-2">{t('mods.checkboxHint')}</p>
                        )}
                        {parsedMod.mod_ids.length > 0 ? (
                          <div className="space-y-2">
                            {parsedMod.mod_ids.map((modId) => (
                              <label key={modId} className="flex items-center gap-2 cursor-pointer hover:bg-gray-600/30 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedModIds.includes(modId)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedModIds([...selectedModIds, modId]);
                                    } else {
                                      setSelectedModIds(selectedModIds.filter(id => id !== modId));
                                    }
                                  }}
                                  className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-green-500"
                                />
                                <span className={`font-mono ${selectedModIds.includes(modId) ? 'text-green-400' : 'text-gray-400'}`}>{modId}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={manualModId}
                            onChange={(e) => setManualModId(e.target.value)}
                            placeholder={t('mods.enterModIdManually')}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-green-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Manual Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      WorkshopId <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualWorkshopId}
                        onChange={(e) => setManualWorkshopId(e.target.value)}
                        placeholder="2917021415"
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-blue-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleFetchNameByWorkshopId}
                        disabled={parsing || !manualWorkshopId.trim()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded transition"
                        title={t('mods.fetchFromSteam')}
                      >
                        {parsing ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      ModId <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualModId}
                      onChange={(e) => setManualModId(e.target.value)}
                      placeholder="vac"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-green-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {manualName && (
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <span className="text-gray-400 text-sm">{t('common.name')}:</span>
                      <span className="text-white ml-2">{manualName}</span>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleAddMod}
                  disabled={
                    addMode === 'url' 
                      ? !parsedMod || (parsedMod.mod_ids.length === 0 && !manualModId.trim())
                      : !manualWorkshopId.trim() || !manualModId.trim()
                  }
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white py-2 rounded transition"
                >
                  {t('common.add')} {addMode === 'url' && parsedMod && parsedMod.mod_ids.length > 0 && `(${parsedMod.mod_ids.length})`}
                </button>
                <button
                  onClick={resetAddForm}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Result Modal */}
      {showSyncResult && syncResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <DownloadCloud className="text-cyan-500" />
                {t('mods.syncResult')}
              </h3>
              <button
                onClick={() => setShowSyncResult(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{syncResult.added}</div>
                <div className="text-sm text-gray-400">{t('mods.added')}</div>
              </div>
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{syncResult.updated}</div>
                <div className="text-sm text-gray-400">{t('mods.updated')}</div>
              </div>
            </div>

            {/* Server info */}
            <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{t('mods.serverModsCount')}:</span>
                <span className="text-white font-mono">{syncResult.server_mods_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('mods.workshopItems')}:</span>
                <span className="text-white font-mono">{syncResult.server_workshops_count}</span>
              </div>
            </div>

            {/* Found mods list */}
            {syncResult.mods_found.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('mods.found')}:</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {syncResult.mods_found.map((mod, idx) => (
                    <div key={idx} className="bg-gray-700/30 rounded px-3 py-2 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white">{mod.name || `Workshop ${mod.workshop_id}`}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          mod.status === 'added' ? 'bg-green-600 text-white' :
                          mod.status === 'updated' ? 'bg-blue-600 text-white' :
                          'bg-gray-600 text-gray-300'
                        }`}>
                          {mod.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Mod IDs: <span className="text-green-400 font-mono">{mod.mod_ids?.join(', ') || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {syncResult.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-400 mb-2">{t('mods.errors')}:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {syncResult.errors.map((err, idx) => (
                    <div key={idx} className="text-sm text-red-300 bg-red-900/30 rounded px-3 py-2">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSyncResult(false)}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg transition"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

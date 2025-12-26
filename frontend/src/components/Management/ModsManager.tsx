import React, { useEffect, useState, useRef } from 'react';
import { modsAPI, Mod, SyncModsResponse } from '../../api/client';
import { useServerStore } from '../../store/serverStore';
import { useI18n } from '../../i18n';
import { 
  Package, RefreshCw, ExternalLink, AlertCircle, Search, 
  Plus, Trash2, Download, Upload, Play, Loader2, Check, X,
  Link, DownloadCloud, ChevronDown, ChevronRight, FileText
} from 'lucide-react';

export const ModsManager: React.FC = () => {
  const { t } = useI18n();
  const { selectedServerId, servers } = useServerStore();
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
  const [disableMissing, setDisableMissing] = useState(true);
  
  // Import from line state
  const [showImportLine, setShowImportLine] = useState(false);
  const [importLineText, setImportLineText] = useState('');
  const [importingFromLine, setImportingFromLine] = useState(false);
  const [importLineProgress, setImportLineProgress] = useState({ current: 0, total: 0, currentId: '' });
  const [importLineResults, setImportLineResults] = useState<Array<{ workshop_id: string; name?: string; mod_ids: string[]; status: 'success' | 'error'; error?: string }>>([]);
  const importAbortRef = useRef(false);

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
    setImportLineResults([]);
    setImportLineProgress({ current: 0, total: 0, currentId: '' });
    importAbortRef.current = false;
    
    try {
      // Step 1: Get workshop IDs from server (only new ones that aren't in DB)
      const serverData = await modsAPI.getServerWorkshopIds(selectedServerId);
      
      if (serverData.new_workshop_ids.length === 0) {
        // No new mods to sync
        const disabledCount = await disableMissingMods(serverData);
        setSyncResult({
          success: true,
          added: 0,
          updated: 0,
          disabled: disabledCount,
          errors: [],
          mods_found: [],
          server_mods_count: serverData.total_on_server,
          server_workshops_count: serverData.total_on_server
        });
        setShowSyncResult(true);
        setSyncing(false);
        loadMods(); // Reload mods to update UI
        return;
      }
      
      // Step 2: Process new workshop IDs with progress
      const workshopIds = serverData.new_workshop_ids;
      setImportLineProgress({ current: 0, total: workshopIds.length, currentId: '' });
      setShowSyncResult(true);
      
      const results: typeof importLineResults = [];
      
      for (let i = 0; i < workshopIds.length; i++) {
        if (importAbortRef.current) break;
        
        const workshopId = workshopIds[i];
        setImportLineProgress({ current: i + 1, total: workshopIds.length, currentId: workshopId });
        
        try {
          // Parse workshop page
          const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`;
          const parsed = await modsAPI.parse(url);
          
          // Get the mod_id from server mapping if available
          const serverModId = serverData.workshop_to_mod[workshopId];
          const modIds = parsed.mod_ids.length > 0 ? parsed.mod_ids : (serverModId ? [serverModId] : ['unknown']);
          const enabledModIds = serverModId ? [serverModId] : [];
          
          // Add mod to database
          await modsAPI.add(selectedServerId, {
            workshop_id: parsed.workshop_id,
            mod_ids: modIds,
            enabled_mod_ids: enabledModIds,
            name: parsed.name || undefined,
            is_enabled: enabledModIds.length > 0
          });
          
          results.push({
            workshop_id: workshopId,
            name: parsed.name || undefined,
            mod_ids: modIds,
            status: 'success'
          });
        } catch (err: any) {
          results.push({
            workshop_id: workshopId,
            mod_ids: [],
            status: 'error',
            error: err.response?.data?.detail || err.message || 'Unknown error'
          });
        }
        
        setImportLineResults([...results]);
        
        // Delay between requests
        if (i < workshopIds.length - 1 && !importAbortRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Update sync result
      const disabledCount = await disableMissingMods(serverData);
      
      setSyncResult({
        success: true,
        added: results.filter(r => r.status === 'success').length,
        updated: 0,
        disabled: disabledCount,
        errors: results.filter(r => r.status === 'error').map(r => `${r.workshop_id}: ${r.error}`),
        mods_found: results.filter(r => r.status === 'success').map(r => ({
          workshop_id: r.workshop_id,
          mod_ids: r.mod_ids,
          enabled_mod_ids: [],
          name: r.name || null,
          status: 'added'
        })),
        server_mods_count: serverData.total_on_server,
        server_workshops_count: serverData.total_on_server
      });
      
      loadMods();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mods.syncError'));
      setShowSyncResult(false);
    } finally {
      setSyncing(false);
    }
  };

  const handleCancelSync = () => {
    importAbortRef.current = true;
  };

  // Disable mods that are not on server (if option enabled)
  const disableMissingMods = async (serverData: { existing_workshop_ids: string[]; new_workshop_ids: string[] }): Promise<number> => {
    if (!disableMissing || !selectedServerId) return 0;
    
    // All workshop IDs that are on server
    const serverWorkshopIds = new Set([...serverData.existing_workshop_ids, ...serverData.new_workshop_ids]);
    
    // Find mods in our list that are NOT on server and are currently enabled
    const modsToDisable = mods.filter(mod => 
      !serverWorkshopIds.has(mod.workshop_id) && mod.is_enabled
    );
    
    let disabledCount = 0;
    for (const mod of modsToDisable) {
      try {
        await modsAPI.update(selectedServerId, mod.id, {
          enabled_mod_ids: [],
          is_enabled: false
        });
        disabledCount++;
      } catch (err) {
        console.error(`Failed to disable mod ${mod.workshop_id}:`, err);
      }
    }
    
    return disabledCount;
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
      const jsonStr = JSON.stringify(data, null, 2);
      
      const server = servers.find(s => s.id === selectedServerId);
      const serverName = server?.name?.replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄ_-]/g, '_') || `server_${selectedServerId}`;
      const now = new Date();
      const filename = `${serverName}_${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}.json`;
      
      // Check if running in pywebview (exe mode) or browser
      const isExeMode = !!(window as any).pywebview;
      
      if (isExeMode) {
        // Exe mode: save to local exports folder
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/export-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ filename, content: jsonStr })
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(t('mods.exportSuccess') || `Exported to: ${result.path}`);
        } else {
          const errorText = await response.text();
          console.error('Export error:', response.status, errorText);
          throw new Error(errorText || 'Export failed');
        }
      } else {
        // Browser mode: download via blob
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('Export exception:', err);
      setError(err.message || err.response?.data?.detail || t('mods.exportError'));
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

  const handleImportFromLine = async () => {
    if (!selectedServerId || !importLineText.trim()) return;
    
    // Parse workshop IDs from the line
    // Supports formats:
    // WorkshopItems=123;456;789
    // 123;456;789
    // 123, 456, 789
    let text = importLineText.trim();
    
    // Remove "WorkshopItems=" prefix if present
    if (text.toLowerCase().includes('workshopitems')) {
      text = text.replace(/^.*workshopitems\s*[=:]\s*["']?/i, '').replace(/["']?\s*$/, '');
    }
    
    // Split by semicolon or comma
    const workshopIds = text
      .split(/[;,]/)
      .map(id => id.trim())
      .filter(id => /^\d+$/.test(id));
    
    if (workshopIds.length === 0) {
      setError(t('mods.importLine.noIdsFound'));
      return;
    }
    
    setImportingFromLine(true);
    setImportLineResults([]);
    setImportLineProgress({ current: 0, total: workshopIds.length, currentId: '' });
    importAbortRef.current = false;
    
    const results: typeof importLineResults = [];
    
    for (let i = 0; i < workshopIds.length; i++) {
      if (importAbortRef.current) break;
      
      const workshopId = workshopIds[i];
      setImportLineProgress({ current: i + 1, total: workshopIds.length, currentId: workshopId });
      
      try {
        // Parse workshop page to get mod info
        const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`;
        const parsed = await modsAPI.parse(url);
        
        // Add mod to database in disabled state
        await modsAPI.add(selectedServerId, {
          workshop_id: parsed.workshop_id,
          mod_ids: parsed.mod_ids.length > 0 ? parsed.mod_ids : ['unknown'],
          enabled_mod_ids: [],  // Disabled by default
          name: parsed.name || undefined,
          is_enabled: false
        });
        
        results.push({
          workshop_id: workshopId,
          name: parsed.name || undefined,
          mod_ids: parsed.mod_ids,
          status: 'success'
        });
      } catch (err: any) {
        results.push({
          workshop_id: workshopId,
          mod_ids: [],
          status: 'error',
          error: err.response?.data?.detail || err.message || 'Unknown error'
        });
      }
      
      setImportLineResults([...results]);
      
      // Delay between requests (1 second) to avoid rate limiting
      if (i < workshopIds.length - 1 && !importAbortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setImportingFromLine(false);
    loadMods();
  };

  const handleCancelImportLine = () => {
    importAbortRef.current = true;
  };

  const resetImportLine = () => {
    setShowImportLine(false);
    setImportLineText('');
    setImportLineResults([]);
    setImportLineProgress({ current: 0, total: 0, currentId: '' });
    importAbortRef.current = false;
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
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer" title={t('mods.sync.disableMissingHint')}>
            <input
              type="checkbox"
              checked={disableMissing}
              onChange={(e) => setDisableMissing(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-cyan-500"
            />
            {t('mods.sync.disableMissing')}
          </label>
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
            onClick={() => setShowImportLine(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg transition text-sm"
            title={t('mods.importLine.title')}
          >
            <FileText size={16} />
            {t('mods.importLine.button')}
          </button>
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
          
          <div className="divide-y divide-gray-700">
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
      {showSyncResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <DownloadCloud className="text-cyan-500" />
                {t('mods.syncResult')}
              </h3>
              {!syncing && (
                <button
                  onClick={() => setShowSyncResult(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              )}
            </div>

            {/* Progress during sync */}
            {syncing && importLineProgress.total > 0 && (
              <div className="space-y-4 mb-4">
                <div className="text-center">
                  <Loader2 size={48} className="animate-spin text-cyan-500 mx-auto mb-4" />
                  <p className="text-white text-lg mb-2">
                    {t('mods.importLine.processing')} {importLineProgress.current} / {importLineProgress.total}
                  </p>
                  <p className="text-gray-400 text-sm font-mono">
                    Workshop ID: {importLineProgress.currentId}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-cyan-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(importLineProgress.current / importLineProgress.total) * 100}%` }}
                  />
                </div>

                <button
                  onClick={handleCancelSync}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition"
                >
                  {t('common.cancel')}
                </button>

                {/* Real-time results */}
                {importLineResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {importLineResults.map((result, idx) => (
                      <div 
                        key={idx} 
                        className={`rounded px-3 py-2 text-sm flex items-center justify-between ${
                          result.status === 'success' 
                            ? 'bg-green-900/30 border border-green-700/50' 
                            : 'bg-red-900/30 border border-red-700/50'
                        }`}
                      >
                        <span className="font-mono text-sm">{result.workshop_id}</span>
                        <span className={result.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                          {result.name || result.error || 'OK'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Results after sync completes */}
            {!syncing && syncResult && (
              <>
                {/* Stats */}
                <div className={`grid gap-3 mb-4 ${syncResult.disabled > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{syncResult.added}</div>
                    <div className="text-sm text-gray-400">{t('mods.added')}</div>
                  </div>
                  <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-400">{syncResult.server_workshops_count - syncResult.added}</div>
                    <div className="text-sm text-gray-400">{t('mods.skipped')}</div>
                  </div>
                  {syncResult.disabled > 0 && (
                    <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-amber-400">{syncResult.disabled}</div>
                      <div className="text-sm text-gray-400">{t('mods.disabled')}</div>
                    </div>
                  )}
                </div>

                {/* Server info */}
                <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('mods.workshopItems')} ({t('mods.syncFromServer')}):</span>
                    <span className="text-white font-mono">{syncResult.server_workshops_count}</span>
                  </div>
                </div>

                {/* Found mods list */}
                {syncResult.mods_found.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('mods.added')}:</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {syncResult.mods_found.map((mod, idx) => (
                        <div key={idx} className="bg-gray-700/30 rounded px-3 py-2 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white">{mod.name || `Workshop ${mod.workshop_id}`}</span>
                            <span className="text-xs px-2 py-1 rounded bg-green-600 text-white">
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
              </>
            )}

            {/* No new mods message */}
            {!syncing && syncResult && syncResult.added === 0 && syncResult.mods_found.length === 0 && (
              <div className="text-center py-4 text-gray-400">
                <Check size={48} className="mx-auto mb-2 text-green-400" />
                <p>{t('mods.sync.allUpToDate')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import from Line Modal */}
      {showImportLine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-amber-500" />
                {t('mods.importLine.title')}
              </h3>
              <button
                onClick={resetImportLine}
                disabled={importingFromLine}
                className="text-gray-400 hover:text-white disabled:opacity-50"
              >
                <X size={24} />
              </button>
            </div>

            {!importingFromLine && importLineResults.length === 0 && (
              <>
                <p className="text-gray-400 text-sm mb-4">{t('mods.importLine.description')}</p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('mods.importLine.inputLabel')}
                  </label>
                  <textarea
                    value={importLineText}
                    onChange={(e) => {
                      setImportLineText(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 400) + 'px';
                    }}
                    placeholder="WorkshopItems=3627047348;3494474677;2875848298..."
                    className="w-full min-h-[80px] px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none overflow-hidden"
                    style={{ height: 'auto' }}
                  />
                </div>

                <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-sm text-gray-400">
                  <p className="mb-1">{t('mods.importLine.supportedFormats')}:</p>
                  <code className="block text-amber-400 text-xs">WorkshopItems=123;456;789</code>
                  <code className="block text-amber-400 text-xs">123;456;789</code>
                  <code className="block text-amber-400 text-xs">123, 456, 789</code>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleImportFromLine}
                    disabled={!importLineText.trim()}
                    className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white py-2 rounded-lg transition"
                  >
                    <Play size={18} />
                    {t('mods.importLine.start')}
                  </button>
                  <button
                    onClick={resetImportLine}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </>
            )}

            {/* Progress */}
            {importingFromLine && (
              <div className="space-y-4">
                <div className="text-center">
                  <Loader2 size={48} className="animate-spin text-amber-500 mx-auto mb-4" />
                  <p className="text-white text-lg mb-2">
                    {t('mods.importLine.processing')} {importLineProgress.current} / {importLineProgress.total}
                  </p>
                  <p className="text-gray-400 text-sm font-mono">
                    Workshop ID: {importLineProgress.currentId}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-amber-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(importLineProgress.current / importLineProgress.total) * 100}%` }}
                  />
                </div>

                <button
                  onClick={handleCancelImportLine}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}

            {/* Results */}
            {importLineResults.length > 0 && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {importLineResults.filter(r => r.status === 'success').length}
                    </div>
                    <div className="text-sm text-gray-400">{t('mods.importLine.success')}</div>
                  </div>
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">
                      {importLineResults.filter(r => r.status === 'error').length}
                    </div>
                    <div className="text-sm text-gray-400">{t('mods.importLine.errors')}</div>
                  </div>
                </div>

                {/* Results list */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {importLineResults.map((result, idx) => (
                    <div 
                      key={idx} 
                      className={`rounded-lg px-3 py-2 text-sm ${
                        result.status === 'success' 
                          ? 'bg-green-900/30 border border-green-700' 
                          : 'bg-red-900/30 border border-red-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-blue-400">{result.workshop_id}</span>
                        {result.status === 'success' ? (
                          <Check size={16} className="text-green-400" />
                        ) : (
                          <X size={16} className="text-red-400" />
                        )}
                      </div>
                      {result.status === 'success' && (
                        <div className="text-gray-300 text-xs mt-1">
                          {result.name || 'Unknown'} 
                          {result.mod_ids.length > 0 && (
                            <span className="text-green-400 ml-2">({result.mod_ids.join(', ')})</span>
                          )}
                        </div>
                      )}
                      {result.status === 'error' && (
                        <div className="text-red-300 text-xs mt-1">{result.error}</div>
                      )}
                    </div>
                  ))}
                </div>

                {!importingFromLine && (
                  <button
                    onClick={resetImportLine}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg transition"
                  >
                    {t('common.close')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

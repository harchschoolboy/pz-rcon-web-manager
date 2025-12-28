import React, { useEffect, useState } from 'react';
import { optionsAPI, commandAPI, ServerOptionsResponse } from '../../api/client';
import { useServerStore } from '../../store/serverStore';
import { useI18n } from '../../i18n';
import { Settings, RefreshCw, Search, AlertCircle, Check, X, Loader2 } from 'lucide-react';

// Determine value type
type ValueType = 'boolean' | 'number' | 'string';

const getValueType = (value: string): ValueType => {
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  return 'string';
};

// Editable Option Row Component
interface OptionRowProps {
  optionKey: string;
  value: string;
  serverId: number;
  onUpdate: (key: string, newValue: string) => void;
}

const OptionRow: React.FC<OptionRowProps> = ({ optionKey, value, serverId, onUpdate }) => {
  const { t } = useI18n();
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const valueType = getValueType(value);
  const hasChanges = editValue !== value;

  // Reset edit value when original value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Value is always passed in quotes: changeoption key "value"
      const result = await commandAPI.execute(serverId, { 
        command: `changeoption ${optionKey} "${editValue}"` 
      });
      
      if (result.success) {
        onUpdate(optionKey, editValue);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || t('error.saving'));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || t('error.saving'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasChanges) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700/30 transition">
      {/* Key */}
      <span className="text-gray-300 font-mono text-sm flex-shrink-0 w-1/3 truncate" title={optionKey}>
        {optionKey}
      </span>
      
      {/* Value Editor */}
      <div className="flex-1 flex items-center gap-2">
        {valueType === 'boolean' ? (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={`flex-1 px-2 py-1 bg-gray-700 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              hasChanges ? 'border-yellow-500' : 'border-gray-600'
            } ${editValue === 'true' ? 'text-green-400' : 'text-red-400'}`}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : valueType === 'number' ? (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`flex-1 px-2 py-1 bg-gray-700 border rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              hasChanges ? 'border-yellow-500' : 'border-gray-600'
            }`}
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`flex-1 px-2 py-1 bg-gray-700 border rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              hasChanges ? 'border-yellow-500' : 'border-gray-600'
            }`}
          />
        )}
        
        {/* Action Buttons */}
        {hasChanges && (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded transition"
              title={t('settings.saveTitle')}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded transition"
              title={t('settings.cancelTitle')}
            >
              <X size={16} />
            </button>
          </>
        )}
        
        {/* Success indicator */}
        {success && !hasChanges && (
          <span className="text-green-400 text-xs">✓ {t('settings.saved')}</span>
        )}
      </div>
      
      {/* Error */}
      {error && (
        <span className="text-red-400 text-xs">{error}</span>
      )}
    </div>
  );
};

export const ServerSettings: React.FC = () => {
  const { t } = useI18n();
  const { selectedServerId } = useServerStore();
  const [options, setOptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedServerId) {
      loadOptions();
    }
  }, [selectedServerId]);

  const loadOptions = async () => {
    if (!selectedServerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data: ServerOptionsResponse = await optionsAPI.get(selectedServerId);
      setOptions(data.options);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('settings.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOptionUpdate = (key: string, newValue: string) => {
    setOptions(prev => ({ ...prev, [key]: newValue }));
  };

  const filteredOptions = Object.entries(options).filter(([key, value]) => 
    key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!selectedServerId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Settings className="mb-4" size={48} />
        <p>{t('settings.selectServer')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="text-blue-500" />
          {t('settings.title')}
        </h2>
        <button
          onClick={loadOptions}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg transition"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-sm text-blue-200">
        {t('settings.info')} <code className="bg-blue-900 px-1 rounded">changeoption key "value"</code>.
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('settings.searchPlaceholder')}
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
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Options list */}
      {!loading && filteredOptions.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-700/50">
            {filteredOptions.map(([key, value]) => (
              <OptionRow
                key={key}
                optionKey={key}
                value={value}
                serverId={selectedServerId}
                onUpdate={handleOptionUpdate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && Object.keys(options).length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>{t('settings.notLoaded')}</p>
        </div>
      )}

      {/* Stats */}
      {!loading && Object.keys(options).length > 0 && (
        <div className="text-sm text-gray-500 text-right">
          {t('settings.showing').replace('{filtered}', String(filteredOptions.length)).replace('{total}', String(Object.keys(options).length))}
        </div>
      )}
    </div>
  );
};

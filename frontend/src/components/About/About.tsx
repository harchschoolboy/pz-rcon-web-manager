import React from 'react';
import { useI18n } from '../../i18n';
import { Info, Github, Container, Check, X, ExternalLink } from 'lucide-react';

const APP_VERSION = '1.3.0';

export const About: React.FC = () => {
  const { t } = useI18n();

  const canDo = [
    t('about.can.rcon'),
    t('about.can.commands'),
    t('about.can.modLists'),
    t('about.can.syncMods'),
    t('about.can.autoSync'),
    t('about.can.serverVersion'),
    t('about.can.applyMods'),
    t('about.can.exportImport'),
    t('about.can.multiServer'),
    t('about.can.workshopMods'),
    t('about.can.dependencies'),
    t('about.can.collections'),
  ];

  const cannotDo = [
    t('about.cannot.downloadMods'),
    t('about.cannot.editFiles'),
    t('about.cannot.uploadContent'),
    t('about.cannot.noRcon'),
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
            <Info size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">PZ Rcon Manager</h1>
            <p className="text-gray-400">{t('about.subtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full border border-blue-600/30">
            v{APP_VERSION}
          </span>
          <span className="text-gray-500">GPL-3.0 License</span>
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-2 gap-4">
        <a
          href="https://github.com/harchschoolboy/pz-rcon-web-manager"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition flex items-center gap-3"
        >
          <Github size={24} className="text-white" />
          <div>
            <div className="text-white font-medium">GitHub</div>
            <div className="text-gray-500 text-sm">{t('about.sourceCode')}</div>
          </div>
          <ExternalLink size={16} className="text-gray-500 ml-auto" />
        </a>

        <a
          href="https://hub.docker.com/r/harchschoolboy/pz-rcon-server-manager"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition flex items-center gap-3"
        >
          <Container size={24} className="text-blue-400" />
          <div>
            <div className="text-white font-medium">Docker Hub</div>
            <div className="text-gray-500 text-sm">{t('about.dockerImage')}</div>
          </div>
          <ExternalLink size={16} className="text-gray-500 ml-auto" />
        </a>
      </div>

      {/* Capabilities */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Can Do */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
            <Check size={20} />
            {t('about.canDo')}
          </h2>
          <ul className="space-y-2">
            {canDo.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-gray-300">
                <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cannot Do */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <X size={20} />
            {t('about.cannotDo')}
          </h2>
          <ul className="space-y-2">
            {cannotDo.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-gray-300">
                <X size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
        <h3 className="text-yellow-400 font-medium mb-2">⚠️ {t('about.disclaimer')}</h3>
        <p className="text-gray-400 text-sm">
          {t('about.disclaimerText')}
        </p>
      </div>
    </div>
  );
};

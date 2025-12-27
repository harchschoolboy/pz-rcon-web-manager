import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { Terminal, LogOut, User, Settings, Package, Info } from 'lucide-react';
import { LanguageSwitcher } from '../UI/LanguageSwitcher';
import { ServerSidebar } from './ServerSidebar';
import { useWebSocket } from '../../hooks/useWebSocket';

export const Layout: React.FC = () => {
  // Initialize WebSocket connection for real-time updates
  useWebSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAuthStore();
  const { t } = useI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/console', label: t('sidebar.console'), icon: Terminal },
    { path: '/settings', label: t('sidebar.settings'), icon: Settings },
    { path: '/mods', label: t('sidebar.mods'), icon: Package },
    { path: '/about', label: t('sidebar.about'), icon: Info },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-white flex items-center gap-2">
                <Terminal className="text-blue-500" />
                PZ Rcon Manager
              </Link>

              <nav className="hidden md:flex gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <div className="flex items-center gap-2 text-gray-300">
                <User size={18} />
                <span className="text-sm">{username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Server Sidebar */}
        <ServerSidebar 
          collapsed={sidebarCollapsed} 
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-800/30">
        <div className="px-4 py-4">
          <p className="text-center text-gray-500 text-sm">
            PZ Rcon Manager © 2025 | Project Zomboid Server Management
          </p>
        </div>
      </footer>
    </div>
  );
};
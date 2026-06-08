import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Calendar, Package, Bell, User, Users, RotateCcw, Database } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { type ViewType } from '../../types';
import { formatFullDateChinese, getToday } from '../../utils/dateUtils';
import { getStorageInfo } from '../../utils/storage';
import { clsx } from 'clsx';

export const Header: React.FC = () => {
  const { currentView, setCurrentView, warnings, setShowWarningPanel, resetToDefault } = useAppStore();
  const [showStorageMenu, setShowStorageMenu] = useState(false);
  const [storageInfo, setStorageInfo] = useState(getStorageInfo());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowStorageMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setStorageInfo(getStorageInfo());
  }, [showStorageMenu]);
  const unresolvedWarnings = warnings.filter((w) => !w.isResolved);
  const criticalCount = unresolvedWarnings.filter((w) => w.level === 'critical').length;

  const views: { type: ViewType; label: string; icon: React.ReactNode }[] = [
    { type: 'kanban', label: '看板视图', icon: <LayoutDashboard size={18} /> },
    { type: 'calendar', label: '日历视图', icon: <Calendar size={18} /> },
    { type: 'delivery', label: '客户交付', icon: <Users size={18} /> },
  ];

  return (
    <header className="bg-incense-800 text-incense-50 shadow-incense-lg sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sandal-500 rounded-full flex items-center justify-center">
                <span className="font-song text-xl font-bold text-incense-900">香</span>
              </div>
              <div>
                <h1 className="font-song text-xl font-bold tracking-wider">香韵坊</h1>
                <p className="text-xs text-incense-300">生产排期管理系统</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-incense-900/50 rounded-lg p-1">
              {views.map((view) => (
                <button
                  key={view.type}
                  onClick={() => setCurrentView(view.type)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm',
                    currentView === view.type
                      ? 'bg-incense-600 text-white shadow-sm'
                      : 'text-incense-300 hover:text-white hover:bg-incense-700/50'
                  )}
                >
                  {view.icon}
                  <span>{view.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm text-incense-200">{formatFullDateChinese(getToday())}</p>
            </div>

            <button
              onClick={() => setShowWarningPanel(true)}
              className="relative p-2 rounded-lg hover:bg-incense-700 transition-colors"
            >
              <Bell size={20} />
              {unresolvedWarnings.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-warning-critical text-white text-xs rounded-full flex items-center justify-center warning-pulse">
                  {unresolvedWarnings.length}
                </span>
              )}
            </button>

            <button className="p-2 rounded-lg hover:bg-incense-700 transition-colors">
              <Package size={20} />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowStorageMenu(!showStorageMenu)}
                className="p-2 rounded-lg hover:bg-incense-700 transition-colors"
                title="数据管理"
              >
                <Database size={20} />
              </button>

              {showStorageMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-incense-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-incense-100">
                    <p className="text-sm font-medium text-incense-800">数据状态</p>
                    <p className="text-xs text-incense-500 mt-1">
                      版本: v{storageInfo.version}
                      {storageInfo.hasData && storageInfo.savedAt && (
                        <span className="ml-2">
                          保存于: {new Date(storageInfo.savedAt).toLocaleString('zh-CN')}
                        </span>
                      )}
                    </p>
                    {!storageInfo.hasData && (
                      <p className="text-xs text-incense-400 mt-1">使用默认mock数据</p>
                    )}
                  </div>
                  <div className="px-2 py-1">
                    <button
                      onClick={() => {
                        const confirmed = window.confirm(
                          '确定要恢复默认数据吗？\n\n这将清除所有本地保存的订单、生产进度、预警处理状态和视图偏好，恢复为初始mock数据。\n\n此操作不可撤销！'
                        );
                        if (confirmed) {
                          resetToDefault();
                          setShowStorageMenu(false);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-warning-critical hover:bg-warning-50 rounded-md transition-colors text-left"
                    >
                      <RotateCcw size={16} />
                      <span>恢复默认数据</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-incense-700">
              <div className="w-8 h-8 bg-incense-600 rounded-full flex items-center justify-center">
                <User size={16} />
              </div>
              <span className="text-sm hidden md:block">管理员</span>
            </div>
          </div>
        </div>
      </div>

      {criticalCount > 0 && (
        <div className="bg-gradient-to-r from-warning-critical to-red-600 text-white py-2 px-4 warning-pulse">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} />
              <span className="text-sm font-medium">
                有 {criticalCount} 个紧急预警需要处理，请及时关注！
              </span>
            </div>
            <button
              onClick={() => setShowWarningPanel(true)}
              className="text-sm underline hover:no-underline"
            >
              查看详情
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { Save, Bell, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { adminGetConfig, adminUpdateConfig } from '../lib/api';
import type { SystemConfig } from '../types';

export const AdminConfig: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>({ announcement: '', maintenance_mode: false, maintenance_message: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminGetConfig().then(setConfig).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminUpdateConfig(config);
      setMessage('配置已保存');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setMessage('保存失败: ' + (e.message || ''));
    }
    setSaving(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">系统配置</h1>
        <p className="text-on-surface-variant font-medium opacity-70">管理公告、维护模式等系统设置</p>
      </header>

      {message && (
        <div className={cn("mb-6 px-5 py-4 rounded-xl text-sm font-medium", message.includes('失败') ? 'bg-error-container/40 text-on-error-container' : 'bg-secondary-container/40 text-on-secondary-container')}>
          {message}
        </div>
      )}

      <div className="space-y-8">
        <section className="bg-surface-container-low rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">全局公告</h2>
              <p className="text-sm text-outline">显示在所有用户仪表盘顶部的横幅消息</p>
            </div>
          </div>
          <textarea
            className="w-full bg-surface-container-highest border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/20 resize-none text-base"
            rows={4}
            placeholder="输入公告内容，留空则不显示公告..."
            value={config.announcement}
            onChange={e => setConfig({...config, announcement: e.target.value})}
          />
          <p className="text-xs text-outline mt-2">
            {config.announcement ? '公告已启用' : '未设置公告'}
          </p>
        </section>

        <section className="bg-surface-container-low rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">维护模式</h2>
              <p className="text-sm text-outline">开启后，用户将无法正常使用系统</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className={cn("w-5 h-5", config.maintenance_mode ? 'text-error' : 'text-outline')} />
              <div>
                <p className="font-bold text-on-surface">{config.maintenance_mode ? '维护模式已开启' : '维护模式已关闭'}</p>
                <p className="text-xs text-outline">开启后仅管理员可访问系统</p>
              </div>
            </div>
            <button
              onClick={() => setConfig({...config, maintenance_mode: !config.maintenance_mode})}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors",
                config.maintenance_mode ? 'bg-error' : 'bg-outline-variant'
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                config.maintenance_mode ? 'translate-x-6' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          {config.maintenance_mode && (
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">维护提示信息</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20"
                placeholder="系统正在维护中，请稍后再试..."
                value={config.maintenance_message}
                onChange={e => setConfig({...config, maintenance_message: e.target.value})}
              />
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white px-10 py-3.5 rounded-full font-bold flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
};

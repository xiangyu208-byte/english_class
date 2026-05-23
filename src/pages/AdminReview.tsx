import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { listContributions, approveContribution, rejectContribution } from '../lib/api';
import type { ContributionItem } from '../types';

const contribStatusTabs = [
  { key: '待审核', label: '待审核', color: 'text-amber-600 bg-amber-50' },
  { key: '已通过', label: '已通过', color: 'text-secondary bg-secondary/10' },
  { key: '已驳回', label: '已驳回', color: 'text-error bg-error/10' },
];

export const AdminReview: React.FC = () => {
  const [contribItems, setContribItems] = useState<ContributionItem[]>([]);
  const [contribTotal, setContribTotal] = useState(0);
  const [contribPage, setContribPage] = useState(1);
  const [pageSize] = useState(20);
  const [contribStatusFilter, setContribStatusFilter] = useState('待审核');
  const [contribLoading, setContribLoading] = useState(false);

  const loadContribData = async () => {
    setContribLoading(true);
    try {
      const res = await listContributions({ status: contribStatusFilter, page: contribPage, page_size: pageSize });
      setContribItems(res.items);
      setContribTotal(res.total);
    } catch (e) { console.error(e); }
    setContribLoading(false);
  };

  useEffect(() => { setContribPage(1); loadContribData(); }, [contribStatusFilter]);
  useEffect(() => { loadContribData(); }, [contribPage]);

  const contribTotalPages = Math.ceil(contribTotal / pageSize);

  const handleContribApprove = async (item: ContributionItem) => {
    try {
      await approveContribution(item.word, item.creator, item.meaning, item.example, item.pos);
      loadContribData();
    } catch (e: any) { alert('审核失败: ' + (e.message || '')); }
  };

  const handleContribReject = async (item: ContributionItem) => {
    try {
      await rejectContribution(item.word, item.creator);
      loadContribData();
    } catch (e: any) { alert('驳回失败: ' + (e.message || '')); }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">审核中心</h1>
        <p className="text-on-surface-variant font-medium opacity-70">审核用户贡献的单词，确保词库质量</p>
      </header>

      <div className="flex gap-2 mb-6">
        {contribStatusTabs.map(tab => (
          <button key={tab.key} onClick={() => setContribStatusFilter(tab.key)} className={cn("px-5 py-2.5 rounded-full font-bold text-sm transition-all", contribStatusFilter === tab.key ? tab.color + ' shadow-sm' : 'text-outline bg-surface-container-low hover:bg-surface-container-highest')}>
            {tab.label} {contribStatusFilter === tab.key && `(${contribTotal})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {contribItems.map((item, idx) => (
          <div key={item.word + item.creator + idx} className={cn("bg-surface-container-low rounded-2xl p-6 flex items-start gap-4 transition-all hover:shadow-sm", contribStatusFilter === '待审核' && 'border-l-4 border-secondary')}>
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center text-xl font-bold flex-shrink-0">
              {(item.word || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-primary">{item.word}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">贡献</span>
                  </div>
                  <p className="font-bold text-secondary mt-0.5">{item.meaning}</p>
                </div>
                {contribStatusFilter === '待审核' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleContribApprove(item)} className="bg-secondary text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:shadow-lg transition-all">
                      <CheckCircle className="w-4 h-4" /> 通过并加入词典
                    </button>
                    <button onClick={() => handleContribReject(item)} className="bg-error-container text-on-error-container px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:shadow-lg transition-all">
                      <XCircle className="w-4 h-4" /> 驳回
                    </button>
                  </div>
                )}
              </div>
              {item.example && (
                <p className="text-sm text-outline italic mt-3 bg-surface-container-highest/50 rounded-xl px-4 py-3">
                  "{item.example}"
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-outline">
                <span className="font-medium">贡献者: {item.creator}</span>
                {item.pos && <span>词性: {item.pos}</span>}
                <span className={cn("px-2 py-0.5 rounded-full", item.status === '已通过' ? 'bg-secondary/10 text-secondary' : item.status === '已驳回' ? 'bg-error/10 text-error' : 'bg-amber-50 text-amber-700')}>
                  {item.status === '待审核' ? '待审核' : item.status === '已通过' ? '已通过（已加入词典）' : '已驳回'}
                </span>
              </div>
            </div>
          </div>
        ))}
        {contribItems.length === 0 && (
          <div className="text-center py-16 text-outline">
            <Globe className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="font-bold">{contribLoading ? '加载中...' : contribStatusFilter === '待审核' ? '暂无待审核贡献' : '暂无记录'}</p>
          </div>
        )}
      </div>

      {contribTotalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button onClick={() => setContribPage(p => Math.max(1, p - 1))} disabled={contribPage <= 1} className="p-2 rounded-lg hover:bg-surface-container-low disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm font-bold text-on-surface">{contribPage} / {contribTotalPages}</span>
          <button onClick={() => setContribPage(p => Math.min(contribTotalPages, p + 1))} disabled={contribPage >= contribTotalPages} className="p-2 rounded-lg hover:bg-surface-container-low disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Globe, CheckCircle, Loader2, BookOpen } from 'lucide-react';
import { submitContribution } from '../lib/api';
import { User } from '../types';

interface ContributePageProps {
  user: User;
}

export const ContributePage: React.FC<ContributePageProps> = ({ user }) => {
  const [english, setEnglish] = useState('');
  const [chinese, setChinese] = useState('');
  const [example, setExample] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!english.trim() || !chinese.trim()) return;
    setSaving(true);
    setMessage('');
    setSuccess(false);
    try {
      await submitContribution({
        word: english.trim(),
        meaning: chinese.trim(),
        example: example.trim(),
        creator: user?.username || user?.id || '',
      });
      setEnglish('');
      setChinese('');
      setExample('');
      setSuccess(true);
      setMessage('提交成功！等待管理员审核通过后，该单词将加入全局词典。');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setMessage('提交失败: ' + (err.message || '未知错误'));
      setSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2 flex items-center gap-3">
          <Globe className="w-9 h-9 text-primary" />
          最新单词上传
        </h1>
        <p className="text-on-surface-variant font-medium opacity-70">
          上传你认为值得加入全局词典的最新单词，管理员审核通过后，所有用户都能查看到该词条。
        </p>
      </header>

      <div className="grid grid-cols-12 gap-8 items-start">
        <section className="col-span-12 lg:col-span-7 bg-surface-container-low rounded-[2rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-8 bg-secondary rounded-full"></div>
            <h2 className="text-xl font-bold text-secondary">单词信息</h2>
          </div>

          {message && (
            <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${success ? 'bg-secondary-container/40 text-on-secondary-container' : 'bg-error-container/40 text-on-error-container'}`}>
              {success && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">英文单词</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-secondary/20 transition-all"
                placeholder="例如：Cryptocurrency"
                type="text"
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">中文释义</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-secondary/20 transition-all"
                placeholder="例如：加密货币"
                type="text"
                value={chinese}
                onChange={(e) => setChinese(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">例句（可选）</label>
              <textarea
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-secondary/20 transition-all resize-none"
                placeholder="提供一个包含该单词的例句..."
                rows={4}
                value={example}
                onChange={(e) => setExample(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="bg-secondary text-white px-10 py-3 rounded-full font-bold hover:shadow-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                {saving ? '提交中...' : '提交审核'}
              </button>
            </div>
          </form>
        </section>

        <section className="col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-secondary-container/30 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-6 h-6 text-secondary" />
              <h3 className="text-lg font-bold text-secondary">说明</h3>
            </div>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="text-secondary font-bold mt-0.5">1.</span>
                <span>提交的单词将进入审核流程，由管理员审核</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary font-bold mt-0.5">2.</span>
                <span>审核通过的单词会自动加入全局词典，所有用户均可查询</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary font-bold mt-0.5">3.</span>
                <span>请确保提交的单词拼写正确、释义准确</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary font-bold mt-0.5">4.</span>
                <span>此功能与"词条录入"不同：词条录入用于记录个人词汇，此处用于贡献全局词典</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

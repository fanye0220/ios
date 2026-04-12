import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Tag, Play, CheckCircle2, Loader2, AlertCircle, Pause, Square, PlayCircle } from 'lucide-react';
import { getCharacters, saveCharacter } from '../lib/db';
import { generateTagsForCharacters } from '../lib/ai';
import { motion } from 'framer-motion';

export function AutoTagger({ onClose, onOpenSettings }: { onClose: () => void, onOpenSettings: () => void }) {
  const [characters, setCharacters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTagging, setIsTagging] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [logs, setLogs] = useState<{ id: string; name: string; status: 'success' | 'failed' | 'pending'; tags?: string[]; errorMsg?: string }[]>([]);
  
  const [batchSize, setBatchSize] = useState<number>(10);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    setIsLoading(true);
    const response = await getCharacters(1, 10000, 'all');
    const allChars = response.characters;
    // Only select characters that don't have tags or have empty tags
    const untaggedChars = allChars.filter(c => {
      const data = c.data?.data || c.data;
      return !data.tags || data.tags.length === 0;
    });
    setCharacters(untaggedChars);
    setIsLoading(false);
  };

  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
  };

  const stopTagging = () => {
    stopRequestedRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
  };

  const startTagging = async () => {
    if (characters.length === 0) return;
    
    setIsTagging(true);
    isPausedRef.current = false;
    setIsPaused(false);
    stopRequestedRef.current = false;
    
    const charsToProcess = batchSize === 0 ? characters : characters.slice(0, batchSize);
    setProgress({ current: 0, total: charsToProcess.length, success: 0, failed: 0 });
    
    const newLogs = charsToProcess.map(c => ({
      id: c.id,
      name: c.data?.data?.name || c.data?.name || '未知角色',
      status: 'pending' as const
    }));
    setLogs(newLogs);

    const API_BATCH_SIZE = 5;

    for (let i = 0; i < charsToProcess.length; i += API_BATCH_SIZE) {
      if (stopRequestedRef.current) break;
      
      while (isPausedRef.current) {
        if (stopRequestedRef.current) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (stopRequestedRef.current) break;

      const batch = charsToProcess.slice(i, i + API_BATCH_SIZE);
      const batchData = batch.map(c => c.data?.data || c.data);
      
      try {
        const tagsList = await generateTagsForCharacters(batchData);

        for (let j = 0; j < batch.length; j++) {
          const char = batch[j];
          const tags = tagsList[j];

          if (tags && tags.length > 0) {
            // Update character
            const updatedChar = { ...char };
            if (updatedChar.data.data) {
              updatedChar.data.data.tags = tags;
            } else {
              updatedChar.data.tags = tags;
            }
            await saveCharacter(updatedChar);
            
            setProgress(p => ({ ...p, current: p.current + 1, success: p.success + 1 }));
            setLogs(prev => prev.map(l => l.id === char.id ? { ...l, status: 'success', tags } : l));
          } else {
            setProgress(p => ({ ...p, current: p.current + 1, failed: p.failed + 1 }));
            setLogs(prev => prev.map(l => l.id === char.id ? { ...l, status: 'failed', errorMsg: 'AI未返回有效标签' } : l));
          }
        }
      } catch (error: any) {
        if (error.message === "API_KEY_MISSING") {
          setApiKeyMissing(true);
          setIsTagging(false);
          return; // Stop the loop
        }
        console.error(`Failed to tag batch starting at ${i}:`, error);
        for (let j = 0; j < batch.length; j++) {
          setProgress(p => ({ ...p, current: p.current + 1, failed: p.failed + 1 }));
          setLogs(prev => prev.map(l => l.id === batch[j].id ? { ...l, status: 'failed', errorMsg: error.message || String(error) } : l));
        }
      }
      
      // Small delay to avoid hitting rate limits too hard
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    setIsTagging(false);
    setIsPaused(false);
    loadCharacters(); // Refresh list to show remaining untagged
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <header className="sticky top-0 p-4 sm:p-6 flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 z-20">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            批量自动打标
          </h1>
          <p className="text-sm text-white/50 mt-1">使用 AI 自动识别角色设定并生成标签</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {apiKeyMissing && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-red-400 flex items-start gap-4 shadow-lg shadow-red-500/5">
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">未配置 API Key</h3>
                <p className="text-sm opacity-80 mt-1 mb-3">使用自动打标功能需要配置自定义 API。您的 Key 仅保存在本地浏览器中，不会上传到任何服务器。</p>
                <button 
                  onClick={onOpenSettings}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition"
                >
                  去配置 API Key
                </button>
              </div>
            </div>
          )}

          {/* Status Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-white/50">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                正在扫描角色库...
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">扫描完成</h2>
                  <p className="text-white/60">
                    发现 <span className="text-purple-400 font-bold text-xl mx-1">{characters.length}</span> 个未打标的角色卡。
                  </p>
                  {!isTagging && characters.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-white/60">单次打标数量:</span>
                      <select 
                        value={batchSize} 
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
                      >
                        <option value={5}>5 个</option>
                        <option value={10}>10 个</option>
                        <option value={20}>20 个</option>
                        <option value={50}>50 个</option>
                        <option value={0}>全部打标</option>
                      </select>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  {!isTagging ? (
                    <button
                      onClick={startTagging}
                      disabled={characters.length === 0}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                        characters.length === 0
                          ? 'bg-white/10 text-white/40 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white shadow-lg shadow-purple-500/25'
                      }`}
                    >
                      <Play className="w-5 h-5" />
                      开始自动打标
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={togglePause}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-all border border-amber-500/30"
                      >
                        {isPaused ? <PlayCircle className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                        {isPaused ? '继续' : '暂停'}
                      </button>
                      <button
                        onClick={stopTagging}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all border border-red-500/30"
                      >
                        <Square className="w-5 h-5" />
                        停止
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Progress Section */}
          {logs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">处理进度</span>
                <div className="flex gap-4">
                  <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> 成功: {progress.success}</span>
                  <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> 失败: {progress.failed}</span>
                </div>
              </div>
              
              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isPaused ? 'bg-amber-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto p-4 space-y-2 font-mono text-sm">
                  {logs.map((log, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={i} 
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        log.status === 'success' ? 'bg-green-500/10 border-green-500/20' :
                        log.status === 'failed' ? 'bg-red-500/10 border-red-500/20' :
                        'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="mt-0.5">
                        {log.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        {log.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-400" />}
                        {log.status === 'pending' && <Loader2 className="w-4 h-4 text-white/40 animate-spin" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {log.name}
                          {log.status === 'pending' && <span className="text-xs text-white/40 font-normal">正在阅读设定...</span>}
                        </div>
                        {log.tags && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {log.tags.map((tag, j) => (
                              <span key={j} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs border border-purple-500/30">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {log.errorMsg && (
                          <div className="text-xs text-red-400 mt-1">
                            错误: {log.errorMsg}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

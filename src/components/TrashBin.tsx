import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { CharacterCard, getTrashedCharacters, restoreCharacter, deleteCharacter, emptyTrash, cleanupOldTrash } from '../lib/db';

interface Props {
  onClose: () => void;
}

const TrashedCharacterCard = ({ char, onRestore, onHardDelete }: { key?: React.Key, char: CharacterCard, onRestore: (id: string) => void, onHardDelete: (id: string) => void }) => {
  const [avatarUrl, setAvatarUrl] = useState<string>(char.avatarUrlFallback);

  useEffect(() => {
    if (char.avatarBlob) {
      const url = URL.createObjectURL(char.avatarBlob);
      setAvatarUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [char.avatarBlob]);

  const daysLeft = Math.ceil((7 * 24 * 60 * 60 * 1000 - (Date.now() - (char.deletedAt || 0))) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl group transition-colors hover:bg-white/10">
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-black/50 shadow-lg ring-1 ring-white/10">
        <img 
          src={avatarUrl} 
          alt={char.name} 
          className="w-full h-full object-cover" 
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white truncate text-base">{char.name}</h3>
        <p className="text-xs text-red-400/80 mt-1 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{daysLeft} 天后永久删除</span>
        </p>
      </div>
      <div className="flex flex-row sm:flex-col gap-2.5 shrink-0">
        <button
          onClick={() => onRestore(char.id)}
          className="p-3 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-xl transition-all active:scale-90 shadow-sm"
          title="恢复"
        >
          <RotateCcw className="w-5 h-5 sm:w-4.5 sm:h-4.5" />
        </button>
        <button
          onClick={() => onHardDelete(char.id)}
          className="p-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-all active:scale-90 shadow-sm"
          title="永久删除"
        >
          <Trash2 className="w-5 h-5 sm:w-4.5 sm:h-4.5" />
        </button>
      </div>
    </div>
  );
};

export function TrashBin({ onClose }: Props) {
  const [trashedCharacters, setTrashedCharacters] = useState<CharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadTrash = async () => {
    setLoading(true);
    await cleanupOldTrash();
    const data = await getTrashedCharacters();
    setTrashedCharacters(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (id: string) => {
    await restoreCharacter(id);
    loadTrash();
  };

  const handleHardDelete = async (id: string) => {
    if (confirm('确定要永久删除此角色吗？此操作不可恢复。')) {
      await deleteCharacter(id);
      loadTrash();
    }
  };

  const handleEmptyTrash = async () => {
    if (confirm('确定要清空回收站吗？所有角色将被永久删除。')) {
      await emptyTrash();
      loadTrash();
    }
  };

  const totalPages = Math.ceil(trashedCharacters.length / pageSize);
  const paginatedChars = trashedCharacters.slice((page - 1) * pageSize, page * pageSize);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl text-red-400 shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white truncate">回收站</h2>
              <p className="text-xs sm:text-sm text-white/50 truncate">已删除的角色将在此保留7天</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {trashedCharacters.length > 0 && !loading && (
              <button
                onClick={handleEmptyTrash}
                className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition font-semibold text-xs sm:text-sm whitespace-nowrap"
              >
                清空列表
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p>加载中...</p>
            </div>
          ) : trashedCharacters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <Trash2 className="w-16 h-16 mb-4 opacity-50" />
              <p>回收站是空的</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paginatedChars.map(char => (
                  <TrashedCharacterCard 
                    key={char.id} 
                    char={char} 
                    onRestore={handleRestore} 
                    onHardDelete={handleHardDelete} 
                  />
                ))}
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/10">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5 rounded-lg text-sm transition"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-white/60">
                    {page} / {totalPages}
                  </span>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5 rounded-lg text-sm transition"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

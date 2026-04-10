import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { CharacterCard, getTrashedCharacters, restoreCharacter, deleteCharacter, emptyTrash, cleanupOldTrash } from '../lib/db';

interface Props {
  onClose: () => void;
}

export function TrashBin({ onClose }: Props) {
  const [trashedCharacters, setTrashedCharacters] = useState<CharacterCard[]>([]);

  const loadTrash = async () => {
    await cleanupOldTrash();
    const data = await getTrashedCharacters();
    setTrashedCharacters(data);
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl text-red-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">回收站</h2>
              <p className="text-sm text-white/50">已删除的角色将在此保留7天</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {trashedCharacters.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition font-medium text-sm"
              >
                清空回收站
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {trashedCharacters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <Trash2 className="w-16 h-16 mb-4 opacity-50" />
              <p>回收站是空的</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trashedCharacters.map(char => {
                const daysLeft = Math.ceil((7 * 24 * 60 * 60 * 1000 - (Date.now() - (char.deletedAt || 0))) / (1000 * 60 * 60 * 24));
                return (
                  <div key={char.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-black/50">
                      <img src={char.avatarUrlFallback} alt={char.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{char.name}</h3>
                      <p className="text-xs text-red-400/80 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {daysLeft} 天后永久删除
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleRestore(char.id)}
                        className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-xl transition"
                        title="恢复"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleHardDelete(char.id)}
                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition"
                        title="永久删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

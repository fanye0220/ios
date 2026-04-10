import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Trash2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CharacterCard, DuplicateGroup, findDuplicates, deleteCharacter } from '../lib/db';

interface Props {
  onClose: () => void;
}

export function DuplicateDetector({ onClose }: Props) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDuplicates = async () => {
    setLoading(true);
    const groups = await findDuplicates();
    setDuplicateGroups(groups);
    setLoading(false);
  };

  useEffect(() => {
    loadDuplicates();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此重复角色吗？')) {
      await deleteCharacter(id);
      loadDuplicates();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
              <Copy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">重复卡检测</h2>
              <p className="text-sm text-white/50">基于开场白、设定和世界书进行对比</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p>正在扫描重复卡片...</p>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <CheckCircle2 className="w-16 h-16 mb-4 opacity-50 text-green-400" />
              <p>太棒了！没有发现重复卡片</p>
            </div>
          ) : (
            duplicateGroups.map((group, index) => (
              <div key={group.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4 text-orange-400">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-medium">发现 {group.characters.length} 张疑似重复卡片</h3>
                  <span className="text-xs px-2 py-1 bg-orange-500/20 rounded-md ml-2">
                    原因: {group.reason}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.characters.map(char => (
                    <div key={char.id} className="flex flex-col p-4 bg-black/20 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-black/50">
                          <img src={char.avatarUrlFallback} alt={char.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white truncate">{char.name}</h4>
                          <p className="text-xs text-white/40 mt-0.5">
                            导入于: {new Date(char.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDelete(char.id)}
                        className="mt-auto w-full py-2 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除此卡
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

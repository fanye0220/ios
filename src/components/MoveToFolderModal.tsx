import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder as FolderIcon, X } from 'lucide-react';
import { getFolders, Folder } from '../lib/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}

export function MoveToFolderModal({ isOpen, onClose, onMove }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    if (isOpen) {
      getFolders().then(f => setFolders(f.sort((a, b) => b.createdAt - a.createdAt)));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">移动到文件夹</h3>
            <button onClick={onClose} className="p-1 text-white/50 hover:text-white rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="overflow-y-auto p-2">
            <button
              onClick={() => onMove(null)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/50">
                <FolderIcon className="w-5 h-5" />
              </div>
              <span className="font-medium text-white">主页 (移除文件夹)</span>
            </button>
            
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => onMove(folder.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <FolderIcon className="w-5 h-5" />
                </div>
                <span className="font-medium text-white">{folder.name}</span>
              </button>
            ))}
            
            {folders.length === 0 && (
              <div className="p-8 text-center text-white/40 text-sm">
                暂无其他文件夹，请先在侧边栏创建
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
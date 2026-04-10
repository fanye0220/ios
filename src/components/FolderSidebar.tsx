import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Folder as FolderIcon, Plus, MoreVertical, Edit2, Trash2, Home, X, Check, Copy, Trash } from 'lucide-react';
import { Folder, getFolders, saveFolder, deleteFolder } from '../lib/db';

interface Props {
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onClose: () => void;
}

export function FolderSidebar({ selectedFolderId, onSelectFolder, onClose }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadFolders = async () => {
    const data = await getFolders();
    setFolders(data.sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const handleCreateFolder = async () => {
    if (!editName.trim()) {
      setIsCreating(false);
      return;
    }
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name: editName.trim(),
      createdAt: Date.now(),
    };
    await saveFolder(newFolder);
    setEditName('');
    setIsCreating(false);
    loadFolders();
  };

  const handleUpdateFolder = async (folder: Folder) => {
    if (!editName.trim()) {
      setEditingFolderId(null);
      return;
    }
    await saveFolder({ ...folder, name: editName.trim() });
    setEditingFolderId(null);
    setEditName('');
    loadFolders();
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (confirm(`确定要删除文件夹 "${name}" 吗？\n文件夹内的角色不会被删除，它们将回到主页。`)) {
      await deleteFolder(id);
      if (selectedFolderId === id) {
        onSelectFolder(null);
      }
      loadFolders();
    }
  };

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      className="fixed top-0 left-0 bottom-0 w-72 bg-slate-900/95 border-r border-white/10 flex flex-col backdrop-blur-xl z-50 shadow-2xl"
    >
      <div className="p-6 flex items-center justify-between border-b border-white/5">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Tavern Folders
        </h1>
        <button 
          onClick={onClose}
          className="p-2 -mr-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Tools Section */}
        <div>
          <div className="flex items-center justify-between px-4 mb-2">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">工具</h2>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => {
                onSelectFolder('duplicates');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${selectedFolderId === 'duplicates' ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
            >
              <Copy className="w-5 h-5" />
              <span>重复卡检测</span>
            </button>
            <button
              onClick={() => {
                onSelectFolder('trash');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${selectedFolderId === 'trash' ? 'bg-red-500/20 text-red-400 font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
            >
              <Trash className="w-5 h-5" />
              <span>回收站</span>
            </button>
          </div>
        </div>

        {/* Folders Section */}
        <div>
          <div className="flex items-center justify-between px-4 mb-2">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">文件夹</h2>
          </div>

          <div className="space-y-1">
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;

              return (
                <div key={folder.id} className="relative group flex items-center">
                  <button
                    onClick={() => {
                      onSelectFolder(folder.id);
                      onClose();
                    }}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'text-white/80 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <FolderIcon className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-white/50'}`} />
                    <span className="font-medium truncate text-left flex-1">{folder.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
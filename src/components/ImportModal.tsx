import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, FileJson, Image as ImageIcon, Folder } from 'lucide-react';
import { extractTavernData } from '../lib/png';
import { saveCharacter, CharacterCard, getFolders, saveFolder, Folder as DBFolder } from '../lib/db';
import { parseTavernCard } from '../types/tavern';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  folderId?: string | null;
}

export function ImportModal({ isOpen, onClose, onImported, folderId }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const getOrCreateFolder = async (folderName: string): Promise<string> => {
    const folders = await getFolders();
    const existingFolder = folders.find(f => f.name === folderName);
    if (existingFolder) {
      return existingFolder.id;
    }
    const newFolder: DBFolder = {
      id: crypto.randomUUID(),
      name: folderName,
      createdAt: Date.now(),
    };
    await saveFolder(newFolder);
    return newFolder.id;
  };

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files).filter(f => 
      f.type === 'image/png' || f.name.endsWith('.png') || 
      f.type === 'application/json' || f.name.endsWith('.json')
    );

    if (fileArray.length === 0) {
      setError("No valid PNG or JSON files found.");
      return;
    }

    setProgress({ current: 0, total: fileArray.length });
    let successCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        let data: any = null;
        let avatarBlob: Blob | undefined;
        let avatarUrlFallback = '';
        let targetFolderId = folderId || undefined;
        let charName = 'Unknown';

        if (file.type === 'image/png' || file.name.endsWith('.png')) {
          const buffer = await file.arrayBuffer();
          data = extractTavernData(buffer);
          if (!data) {
            throw new Error("非酒馆卡或预设格式：未找到Tavern角色数据。");
          }
          avatarBlob = file;
          charName = data.name || data.data?.name || 'Unknown Character';
        } else {
          const text = await file.text();
          data = JSON.parse(text);
          
          const isTheme = data.blur_strength !== undefined || data.main_text_color !== undefined || data.chat_display !== undefined;
          const isAIPreset = data.temperature !== undefined || data.prompts !== undefined || data.top_p !== undefined;
          const isCharacter = !isTheme && !isAIPreset && !!(data.name || data.data?.name);
          
          if (!isCharacter && !isTheme && !isAIPreset) {
             throw new Error("非酒馆卡或预设格式：无法识别的数据结构。");
          }
          
          if (isTheme) {
            targetFolderId = await getOrCreateFolder('美化');
            charName = data.name || file.name.replace(/\.[^/.]+$/, "");
          } else if (isAIPreset) {
            targetFolderId = await getOrCreateFolder('预设');
            charName = data.name || file.name.replace(/\.[^/.]+$/, "");
          } else if (isCharacter) {
            charName = data.name || data.data?.name || 'Unknown Character';
          }

          avatarUrlFallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${charName}`;
        }

        const newChar: CharacterCard = {
          id: crypto.randomUUID(),
          name: charName,
          avatarBlob,
          avatarUrlFallback,
          data: data, // store raw data to preserve preset structure
          originalFile: (file.type === 'image/png' || file.name.endsWith('.png')) ? file : undefined,
          createdAt: Date.now(),
          folderId: targetFolderId,
        };

        await saveCharacter(newChar);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to import ${file.name}:`, err);
        setError(err.message || `导入 ${file.name} 失败`);
      }
      setProgress({ current: i + 1, total: fileArray.length });
    }

    setProgress(null);
    if (successCount === 0) {
      setError("Failed to import any characters.");
    } else {
      onImported();
      onClose();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={progress ? undefined : onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl z-50 text-white"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                导入角色卡
              </h2>
              {!progress && (
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {progress ? (
              <div className="py-8 flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
                <p className="text-lg font-medium">导入中...</p>
                <p className="text-slate-400">{progress.current} / {progress.total}</p>
                <div className="w-full bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragging ? 'border-purple-500 bg-purple-500/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                  }`}
                >
                  <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? 'text-purple-400' : 'text-slate-400'}`} />
                  <p className="text-center font-medium mb-1">点击上传或拖拽文件到此处</p>
                  <p className="text-center text-sm text-slate-400">支持多个 PNG/JSON 格式的酒馆卡或预设</p>
                  
                  <div className="flex gap-4 mt-6 text-slate-500">
                    <div className="flex items-center gap-1 text-xs"><ImageIcon className="w-4 h-4" /> PNG</div>
                    <div className="flex items-center gap-1 text-xs"><FileJson className="w-4 h-4" /> JSON</div>
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-sm text-slate-300"
                  >
                    <Folder className="w-4 h-4" />
                    导入文件夹
                  </button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              accept=".png,.json,image/png,application/json"
              className="hidden"
              multiple
            />
            <input
              type="file"
              ref={folderInputRef}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as any)}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

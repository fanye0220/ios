import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Trash2, X, AlertTriangle, CheckCircle2, Merge, MessageSquarePlus, Link, FileText } from 'lucide-react';
import { CharacterCard, DuplicateGroup, findDuplicates, deleteCharacter, saveCharacter } from '../lib/db';

interface Props {
  onClose: () => void;
  onSelectChar: (id: string) => void;
}

export function DuplicateDetector({ onClose, onSelectChar }: Props) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  const handleMergeAndKeep = async (keptChar: CharacterCard, group: DuplicateGroup) => {
    if (!confirm('确定要保留此卡，合并其他卡片的快捷回复(QR)、来源链接和标签，并删除其他卡片吗？')) return;

    const otherChars = group.characters.map(c => c.char).filter(c => c.id !== keptChar.id);
    let updatedData = { ...keptChar.data };
    let targetData = updatedData.data ? updatedData.data : updatedData;

    // Initialize extensions if not present
    if (!targetData.extensions) targetData.extensions = {};

    let mergedQRs = [...(targetData.extensions.quick_replies || [])];
    let mergedSource = targetData.extensions.source || targetData.source || '';
    let mergedTags = [...(targetData.tags || [])];
    let mergedQrFilename = targetData.extensions.qr_filename || '';

    for (const other of otherChars) {
      const otherTarget = other.data.data ? other.data.data : other.data;
      
      // Merge QRs
      const otherQRs = otherTarget.extensions?.quick_replies || [];
      for (const qr of otherQRs) {
        // Avoid exact duplicates
        if (!mergedQRs.some(q => q.message === qr.message)) {
          mergedQRs.push(qr);
        }
      }

      // Merge QR Filename
      const otherQrFilename = otherTarget.extensions?.qr_filename;
      if (!mergedQrFilename && otherQrFilename) {
        mergedQrFilename = otherQrFilename;
      }

      // Merge Source
      const otherSource = otherTarget.extensions?.source || otherTarget.source;
      if (!mergedSource && otherSource) {
        mergedSource = otherSource;
      }

      // Merge Tags
      const otherTags = otherTarget.tags || [];
      for (const tag of otherTags) {
        if (!mergedTags.includes(tag)) {
          mergedTags.push(tag);
        }
      }
    }

    targetData.extensions.quick_replies = mergedQRs;
    targetData.extensions.source = mergedSource;
    targetData.tags = mergedTags;
    if (mergedQrFilename) {
      targetData.extensions.qr_filename = mergedQrFilename;
    }
    
    if (!updatedData.data) {
      updatedData.source = mergedSource;
      updatedData.tags = mergedTags;
    }

    const finalChar = { ...keptChar, data: updatedData };
    await saveCharacter(finalChar);

    for (const other of otherChars) {
      await deleteCharacter(other.id);
    }

    loadDuplicates();
  };

  const totalPages = Math.ceil(duplicateGroups.length / pageSize);
  const paginatedGroups = duplicateGroups.slice((page - 1) * pageSize, page * pageSize);

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
            <div className="space-y-8">
              {paginatedGroups.map((group, index) => (
                <div key={group.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4 text-orange-400">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-medium">发现 {group.characters.length} 张疑似重复卡片</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.characters.map(dupChar => {
                      const char = dupChar.char;
                      const reason = dupChar.reason;
                      const targetData = char.data.data ? char.data.data : char.data;
                      const hasQR = targetData.extensions?.quick_replies?.length > 0;
                      const hasSource = !!(targetData.extensions?.source || targetData.source);
                      const hasNotes = !!targetData.creator_notes;
                      const modifiedDate = char.originalFile?.lastModified 
                        ? new Date(char.originalFile.lastModified) 
                        : new Date(char.updatedAt || char.createdAt);

                      return (
                      <div key={char.id} className="flex flex-col p-4 bg-black/20 rounded-xl border border-white/5">
                        <div 
                          className="flex items-start gap-3 mb-3 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-lg transition"
                          onClick={() => onSelectChar(char.id)}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-black/50 mt-1">
                            <img 
                              src={char.avatarBlob ? URL.createObjectURL(char.avatarBlob) : char.avatarUrlFallback} 
                              alt={char.name} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{char.name}</h4>
                            <p className="text-[10px] text-white/40 mt-1">
                              修改于: {modifiedDate.toLocaleDateString()} {modifiedDate.toLocaleTimeString()}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded font-medium">
                                {reason}
                              </span>
                              {hasQR && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded flex items-center gap-1"><MessageSquarePlus className="w-2.5 h-2.5"/> QR</span>}
                              {hasSource && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded flex items-center gap-1"><Link className="w-2.5 h-2.5"/> 来源</span>}
                              {hasNotes && <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded flex items-center gap-1"><FileText className="w-2.5 h-2.5"/> 备注</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-auto flex flex-col gap-2">
                          <button
                            onClick={() => handleMergeAndKeep(char, group)}
                            className="w-full py-2 flex items-center justify-center gap-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg transition text-sm font-medium"
                          >
                            <Merge className="w-4 h-4" />
                            保留并合并其他
                          </button>
                          <button
                            onClick={() => handleDelete(char.id)}
                            className="w-full py-2 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition text-sm font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            删除此卡
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              ))}

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

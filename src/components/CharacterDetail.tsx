import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, Trash2, Book, MessageSquare, User, FileJson, ChevronRight, Plus, Edit2, Power, X as XIcon, ChevronDown, ChevronUp, ExternalLink, Check, Upload } from 'lucide-react';
import { getCharacter, deleteCharacter, saveCharacter, CharacterCard, getFolders } from '../lib/db';
import { parseTavernCard } from '../types/tavern';
import { injectTavernData } from '../lib/png';
import { AvatarViewer } from './AvatarViewer';
import { QuickRepliesSection } from './QuickRepliesSection';
import JSZip from 'jszip';

interface Props {
  id: string;
  onBack: () => void;
}

export function CharacterDetail({ id, onBack }: Props) {
  const [character, setCharacter] = useState<CharacterCard | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'greetings' | 'worldbook'>('profile');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportAlert, setShowExportAlert] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tempTags, setTempTags] = useState<string>('');
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [tempSource, setTempSource] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const savePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    getCharacter(id).then(char => {
      setCharacter(char);
      if (char) {
        setEditNameValue(char.name);
        if (char.avatarBlob) {
          const url = URL.createObjectURL(char.avatarBlob);
          setAvatarUrl(url);
        } else {
          setAvatarUrl(char.avatarUrlFallback || '');
        }
      }
    });
  }, [id]);

  const handleNameSave = async () => {
    if (!editNameValue.trim() || !character) return;
    
    const updatedChar = { ...character, name: editNameValue.trim() };
    if (updatedChar.data.data) {
      updatedChar.data.data.name = editNameValue.trim();
    } else {
      updatedChar.data.name = editNameValue.trim();
    }
    
    const promise = saveCharacter(updatedChar);
    savePromiseRef.current = promise;
    await promise;
    setCharacter(updatedChar);
    setIsEditingName(false);
  };

  useEffect(() => {
    return () => {
      if (avatarUrl && avatarUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [avatarUrl]);

  const handleUpdateTags = async (tagsStr: string) => {
    setIsEditingTags(false);
    if (!character) return;
    const newTags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
    
    let updatedData = { ...character.data };
    if (updatedData.data) {
      updatedData.data = { ...updatedData.data, tags: newTags };
    } else {
      updatedData.tags = newTags;
    }

    const updatedChar = { 
      ...character, 
      data: updatedData 
    };
    const promise = saveCharacter(updatedChar);
    savePromiseRef.current = promise;
    await promise;
    setCharacter(updatedChar);
  };

  const handleUpdateSource = async (sourceStr: string) => {
    setIsEditingSource(false);
    if (!character) return;
    
    let updatedData = { ...character.data };
    if (updatedData.data) {
      updatedData.data = {
        ...updatedData.data,
        extensions: { ...(updatedData.data.extensions || {}), source: sourceStr }
      };
    } else {
      updatedData.extensions = { ...(updatedData.extensions || {}), source: sourceStr };
      updatedData.source = sourceStr; // Fallback for V1
    }

    const updatedChar = { 
      ...character, 
      data: updatedData 
    };
    const promise = saveCharacter(updatedChar);
    savePromiseRef.current = promise;
    await promise;
    setCharacter(updatedChar);
  };

  const updateField = async (field: string, value: any) => {
    if (!character) return;
    const updatedChar = { ...character };
    let targetData = updatedChar.data.data ? updatedChar.data.data : updatedChar.data;
    targetData[field] = value;
    const promise = saveCharacter(updatedChar);
    savePromiseRef.current = promise;
    await promise;
    setCharacter(updatedChar);
  };

  const handleBack = async () => {
    if (isEditingTags) await handleUpdateTags(tempTags);
    if (isEditingSource) await handleUpdateSource(tempSource);
    if (isEditingName) await handleNameSave();

    if (savePromiseRef.current) {
      await savePromiseRef.current;
    }
    onBack();
  };

  if (!character) return null;

  const card = parseTavernCard(character.data);
  const data = card.data;
  const rawData = character.data;
  const isPreset = !!(rawData.prompts || rawData.temperature !== undefined || rawData.top_p !== undefined);

  const getSafeFilename = (name: string) => {
    return name.replace(/[\\/:*?"<>|]/g, '_') || 'character';
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(character.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getSafeFilename(character.name)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = async () => {
    if (character.originalFile) {
      try {
        const blob = character.originalFile;
        const safeName = getSafeFilename(character.name);
        const exportFileName = `${safeName}.png`;
        
        const targetData = character.data.data ? character.data.data : character.data;
        const hasQR = targetData.extensions?.quick_replies && targetData.extensions.quick_replies.length > 0;
        const hasAvatars = character.avatarHistory && character.avatarHistory.length > 0;
        
        if (hasQR || hasAvatars) {
          const zip = new JSZip();
          
          zip.file(exportFileName, blob);
          
          if (hasQR) {
            const qrFileName = targetData.extensions?.qr_filename || `${safeName}_qr.json`;
            zip.file(qrFileName, JSON.stringify(targetData.extensions.quick_replies, null, 2));
          }
          
          if (hasAvatars) {
            const avatarsFolder = zip.folder('替换卡面');
            if (avatarsFolder) {
              character.avatarHistory!.forEach((avatarBlob, index) => {
                let ext = 'png';
                let fileName = `替换卡面_${index + 1}.${ext}`;
                if (avatarBlob instanceof File) {
                  fileName = avatarBlob.name;
                } else {
                  if (avatarBlob.type === 'image/jpeg') ext = 'jpg';
                  else if (avatarBlob.type === 'image/webp') ext = 'webp';
                  fileName = `替换卡面_${index + 1}.${ext}`;
                }
                avatarsFolder.file(fileName, avatarBlob);
              });
            }
          }
          
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${safeName}.zip`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }

        // Fallback to just PNG if no QR/Avatars
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportFileName;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Failed to export PNG", e);
        setShowExportAlert(true);
        handleExportJson();
      }
    } else {
      setShowExportAlert(true);
      handleExportJson();
    }
  };

  const handleDelete = async () => {
    await deleteCharacter(id);
    onBack();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black text-white overflow-y-auto z-50"
    >
      {/* Blurred Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-30 blur-3xl scale-110"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 p-4 flex items-center justify-between bg-black/20 backdrop-blur-xl border-b border-white/10 z-20">
          <button onClick={handleBack} className="p-2 rounded-full hover:bg-white/10 transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-2">
            <button onClick={handleExportPng} className="p-2 rounded-full hover:bg-white/10 transition" title="导出 PNG">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-full hover:bg-red-500/20 text-red-400 transition" title="删除">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Alerts & Modals */}
        <AnimatePresence>
          {showExportAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-4 py-2 rounded-full text-sm backdrop-blur-md z-50 flex items-center gap-2 shadow-xl"
            >
              <span>未找到原始 PNG 文件，已导出为 JSON。</span>
              <button onClick={() => setShowExportAlert(false)} className="ml-2 hover:text-white">✕</button>
            </motion.div>
          )}

          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              >
                <h3 className="text-xl font-bold mb-2">删除角色？</h3>
                <p className="text-slate-400 mb-6">确定要将 {character.name} 移至回收站吗？</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition shadow-lg shadow-red-500/20"
                  >
                    删除
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Avatar & Name */}
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          <motion.img
            layoutId={`avatar-${id}`}
            src={avatarUrl}
            alt={character.name}
            onClick={() => setShowAvatarViewer(true)}
            className="w-32 h-32 rounded-full object-cover border-4 border-white/20 shadow-2xl cursor-pointer hover:scale-105 transition-transform"
          />
          {isEditingName ? (
            <div className="flex items-center gap-2 mt-4">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  if (e.key === 'Escape') {
                    setIsEditingName(false);
                    setEditNameValue(character.name);
                  }
                }}
                className="bg-black/40 border border-white/20 rounded-lg px-3 py-1 text-2xl font-bold text-center w-48 focus:outline-none focus:border-purple-500"
                autoFocus
              />
              <button 
                onClick={handleNameSave}
                className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition"
              >
                <Check className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  setIsEditingName(false);
                  setEditNameValue(character.name);
                }}
                className="p-1.5 bg-white/10 text-white/60 rounded-lg hover:bg-white/20 transition"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-4">
              <h1 className="text-3xl font-bold text-center">{character.name}</h1>
              <button 
                onClick={() => setIsEditingName(true)}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-white/60 text-sm mt-1">v{data.character_version || '1.0'} • {data.creator || 'Unknown Creator'}</p>
          
          {/* Metadata Drawer */}
          <div className="w-full max-w-md mt-4">
            <button
              onClick={() => setIsMetadataOpen(!isMetadataOpen)}
              className="w-full flex items-center justify-center gap-2 py-2 text-white/50 hover:text-white/80 transition-colors"
            >
              <div className="h-1 w-12 bg-white/20 rounded-full" />
            </button>
            <AnimatePresence>
              {isMetadataOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                  className="overflow-hidden"
                >
                  <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 mt-2 border border-white/5 space-y-3 shadow-inner">
                    <div className="flex flex-col gap-1 items-center text-center">
                      <div className="text-xs text-white/40 font-medium uppercase tracking-wider">
                        导入时间 (IMPORTED)
                      </div>
                      <div className="text-sm text-white/80 font-mono">
                        {new Date(character?.createdAt || Date.now()).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 items-center text-center">
                      <div className="text-xs text-white/40 font-medium uppercase tracking-wider">
                        本地修改时间 (MODIFIED)
                      </div>
                      <div className="text-sm text-white/80 font-mono">
                        {character?.originalFile?.lastModified ? new Date(character.originalFile.lastModified).toLocaleString() : '未知'}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/40 font-medium uppercase tracking-wider flex items-center gap-1">
                          标签 (TAGS)
                        </div>
                        <button onClick={() => {
                          if (isEditingTags) {
                            handleUpdateTags(tempTags);
                          } else {
                            setTempTags((data.tags || []).join(', '));
                            setIsEditingTags(true);
                          }
                        }}>
                          {isEditingTags ? <Check className="w-3 h-3 text-green-400"/> : <Edit2 className="w-3 h-3 text-white/40 hover:text-white"/>}
                        </button>
                      </div>
                      {isEditingTags ? (
                        <div className="flex items-center gap-2">
                          <input 
                            value={tempTags} 
                            onChange={e => {
                              // If user typed a space, replace it with a comma and space
                              const val = e.target.value;
                              if (val.endsWith(' ') && !val.endsWith(', ')) {
                                setTempTags(val.slice(0, -1) + ', ');
                              } else {
                                setTempTags(val);
                              }
                            }} 
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
                            placeholder="输入标签，用逗号或空格分隔"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleUpdateTags(tempTags)}
                          />
                          <button onClick={() => handleUpdateTags(tempTags)} className="p-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setIsEditingTags(false)} className="p-2 bg-white/10 text-white/60 rounded-xl hover:bg-white/20 transition shrink-0">
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white/80 min-h-[36px] flex flex-wrap gap-1">
                          {data.tags && data.tags.length > 0 ? (
                            data.tags.map((tag: string, i: number) => (
                              <span key={i} className="bg-white/10 px-2 py-0.5 rounded-md text-xs">{tag}</span>
                            ))
                          ) : (
                            <span className="text-white/30">无标签</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/40 font-medium uppercase tracking-wider flex items-center gap-1">
                          来源链接 (SOURCE)
                        </div>
                        <button onClick={() => {
                          if (isEditingSource) {
                            handleUpdateSource(tempSource);
                          } else {
                            setTempSource(data.extensions?.source || data.source || '');
                            setIsEditingSource(true);
                          }
                        }}>
                          {isEditingSource ? <Check className="w-3 h-3 text-green-400"/> : <Edit2 className="w-3 h-3 text-white/40 hover:text-white"/>}
                        </button>
                      </div>
                      {isEditingSource ? (
                        <div className="flex items-center gap-2">
                          <input 
                            value={tempSource} 
                            onChange={e => setTempSource(e.target.value)} 
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
                            placeholder="https://..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleUpdateSource(tempSource)}
                          />
                          <button onClick={() => handleUpdateSource(tempSource)} className="p-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setIsEditingSource(false)} className="p-2 bg-white/10 text-white/60 rounded-xl hover:bg-white/20 transition shrink-0">
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white/80 min-h-[36px] truncate flex items-center justify-between">
                          {data.extensions?.source || data.source ? (
                            <a 
                              href={data.extensions?.source || data.source} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 truncate"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{data.extensions?.source || data.source}</span>
                            </a>
                          ) : (
                            <span className="text-white/30">无链接</span>
                          )}
                        </div>
                      )}
                    </div>

                    {data.creator_notes && (
                      <div className="flex flex-col gap-1">
                        <div className="text-xs text-white/40 font-medium uppercase tracking-wider flex items-center gap-1">
                          作者备注 (CREATOR'S NOTES)
                        </div>
                        <div className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white/80 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {data.creator_notes}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-2 mb-4 overflow-x-auto hide-scrollbar">
          {[
            { id: 'profile', icon: User, label: isPreset ? '预设条目' : '档案' },
            ...(!isPreset ? [
              { id: 'greetings', icon: MessageSquare, label: '开场白' },
              { id: 'worldbook', icon: Book, label: '世界书' },
            ] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area - Glassmorphism Card */}
        <div className="flex-1 px-4 pb-8">
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl min-h-[50vh]">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {isPreset ? (
                    <div className="space-y-6">
                      {rawData.prompts && rawData.prompts.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">提示词条目 (Prompts)</h3>
                          {rawData.prompts.map((prompt: any, i: number) => (
                            <div key={i} className="mb-4">
                              <TextPreview title={prompt.name || prompt.identifier || `Prompt ${i+1}`} content={prompt.content || ''} />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {rawData.system_prompt && <Section title="系统提示词 (System Prompt)" content={rawData.system_prompt} />}
                      {rawData.post_history_instructions && <Section title="历史后提示词 (Post History Instructions)" content={rawData.post_history_instructions} />}
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">生成参数 (Generation Settings)</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                          {rawData.temperature !== undefined && <div><span className="text-white/50">Temperature:</span> {rawData.temperature}</div>}
                          {rawData.top_p !== undefined && <div><span className="text-white/50">Top P:</span> {rawData.top_p}</div>}
                          {rawData.top_k !== undefined && <div><span className="text-white/50">Top K:</span> {rawData.top_k}</div>}
                          {rawData.rep_pen !== undefined && <div><span className="text-white/50">Rep Pen:</span> {rawData.rep_pen}</div>}
                          {rawData.presence_penalty !== undefined && <div><span className="text-white/50">Presence Pen:</span> {rawData.presence_penalty}</div>}
                          {rawData.frequency_penalty !== undefined && <div><span className="text-white/50">Frequency Pen:</span> {rawData.frequency_penalty}</div>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Section title="描述" content={data.description} onSave={(val) => updateField('description', val)} />
                      
                      {character && (
                        <QuickRepliesSection 
                          character={character} 
                          onUpdate={setCharacter} 
                        />
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {activeTab === 'greetings' && (
                <motion.div
                  key="greetings"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <Section title="首条消息" content={data.first_mes} onSave={(val) => updateField('first_mes', val)} />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-lg font-semibold text-white/90">备用开场白</h3>
                      <button 
                        onClick={() => {
                          const newGreetings = [...(data.alternate_greetings || []), ""];
                          updateField('alternate_greetings', newGreetings);
                        }} 
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm bg-purple-500/10 px-2 py-1 rounded-lg"
                      >
                        <Plus className="w-4 h-4" /> 添加
                      </button>
                    </div>
                    <div className="space-y-4">
                      {data.alternate_greetings && data.alternate_greetings.length > 0 ? (
                        data.alternate_greetings.map((msg: string, i: number) => (
                          <div key={i} className="relative group">
                            <TextPreview 
                              title={`备用开场白 ${i + 1}`} 
                              content={msg} 
                              onSave={(val) => {
                                const newGreetings = [...data.alternate_greetings];
                                newGreetings[i] = val;
                                updateField('alternate_greetings', newGreetings);
                              }}
                              initialEditMode={msg === ""}
                            />
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('确定要删除这条备用开场白吗？')) {
                                   const newGreetings = data.alternate_greetings.filter((_: any, idx: number) => idx !== i);
                                   updateField('alternate_greetings', newGreetings);
                                }
                              }}
                              className="absolute top-2 right-2 p-1.5 text-white/20 hover:text-red-400 hover:bg-white/10 rounded-lg transition-all z-10"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-white/30 text-sm italic">暂无备用开场白</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'worldbook' && (
                <motion.div
                  key="worldbook"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {data.character_book || data.extensions?.character_book ? (
                    <WorldbookViewer 
                      book={data.character_book || data.extensions?.character_book} 
                      onUpdate={(newBook) => {
                        const updatedChar = { ...character };
                        let targetData = updatedChar.data.data ? updatedChar.data.data : updatedChar.data;
                        
                        if (targetData.character_book) {
                          targetData.character_book = newBook;
                        } else {
                          targetData.extensions = { ...(targetData.extensions || {}), character_book: newBook };
                        }
                        
                        saveCharacter(updatedChar).then(() => setCharacter(updatedChar));
                      }}
                      onDelete={() => {
                        if (confirm('确定要删除整个世界书吗？此操作不可恢复。')) {
                          const updatedChar = { ...character };
                          let targetData = updatedChar.data.data ? updatedChar.data.data : updatedChar.data;
                          
                          if (targetData.character_book) delete targetData.character_book;
                          if (targetData.extensions?.character_book) delete targetData.extensions.character_book;
                          
                          saveCharacter(updatedChar).then(() => setCharacter(updatedChar));
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-white/40">
                      <Book className="w-12 h-12 mb-2 opacity-50" />
                      <p>未包含世界书数据</p>
                      <div className="flex gap-3 mt-4">
                        <button 
                          onClick={() => {
                            const newBook = { name: '新世界书', description: '', entries: [] };
                            const updatedChar = { ...character };
                            let targetData = updatedChar.data.data ? updatedChar.data.data : updatedChar.data;
                            
                            targetData.extensions = { ...(targetData.extensions || {}), character_book: newBook };
                            
                            saveCharacter(updatedChar).then(() => setCharacter(updatedChar));
                          }}
                          className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> 创建世界书
                        </button>
                        <label className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition flex items-center gap-2 cursor-pointer">
                          <Upload className="w-4 h-4" /> 导入世界书
                          <input 
                            type="file" 
                            accept=".json" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const text = await file.text();
                                const json = JSON.parse(text);
                                
                                // Handle both array format and object format (like the provided example)
                                let entries = [];
                                if (Array.isArray(json.entries)) {
                                  entries = json.entries;
                                } else if (json.entries && typeof json.entries === 'object') {
                                  entries = Object.values(json.entries);
                                } else if (Array.isArray(json)) {
                                  entries = json;
                                }

                                const newBook = { 
                                  name: json.name || file.name.replace('.json', ''), 
                                  description: json.description || '', 
                                  entries: entries 
                                };

                                const updatedChar = { ...character };
                                let targetData = updatedChar.data.data ? updatedChar.data.data : updatedChar.data;
                                
                                targetData.extensions = { ...(targetData.extensions || {}), character_book: newBook };
                                
                                await saveCharacter(updatedChar);
                                setCharacter(updatedChar);
                              } catch (err) {
                                alert('导入失败：不是有效的 JSON 文件');
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAvatarViewer && character && (
          <AvatarViewer
            character={character}
            onClose={() => setShowAvatarViewer(false)}
            onUpdate={(updatedCharacter) => {
              setCharacter(updatedCharacter);
              if (updatedCharacter.avatarBlob) {
                const url = URL.createObjectURL(updatedCharacter.avatarBlob);
                setAvatarUrl(url);
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FullScreenTextModal({ 
  title, 
  content, 
  onClose,
  onSave,
  initialEditMode = false
}: { 
  title: string; 
  content: string; 
  onClose: () => void;
  onSave?: (val: string) => void;
  initialEditMode?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [editValue, setEditValue] = useState(content);

  const handleSave = () => {
    if (onSave) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-[100] bg-slate-900 flex flex-col"
    >
      <header className="sticky top-0 p-4 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 z-20">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold truncate">{title}</h2>
        {onSave && (
          isEditing ? (
            <button onClick={handleSave} className="ml-auto p-2 text-green-400 font-medium hover:bg-green-400/10 rounded-lg transition">
              保存
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)} className="ml-auto p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition">
              <Edit2 className="w-5 h-5" />
            </button>
          )
        )}
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 hide-scrollbar bg-slate-900 flex flex-col">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          {isEditing ? (
            <textarea 
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="w-full flex-1 bg-black/40 border border-white/20 rounded-xl p-4 text-white/90 text-base sm:text-lg leading-relaxed sm:leading-loose focus:outline-none focus:border-purple-500 resize-none"
              autoFocus
            />
          ) : (
            <p className="text-white/90 whitespace-pre-wrap text-base sm:text-lg leading-relaxed sm:leading-loose">
              {content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TextPreview({ title, content, onSave, initialEditMode }: { title: string; content: string; onSave?: (val: string) => void; initialEditMode?: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(initialEditMode || false);

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="group relative cursor-pointer bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors"
      >
        <div className="text-white/70 text-sm line-clamp-2 pr-8">
          {content || <span className="text-white/30 italic">空内容...</span>}
        </div>
        <div className="mt-1.5 text-purple-400 text-xs font-medium flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <span>阅读全文</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <FullScreenTextModal 
            title={title} 
            content={content} 
            onClose={() => setIsModalOpen(false)} 
            onSave={onSave}
            initialEditMode={initialEditMode && !content}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ title, content, onSave }: { title: string; content?: string; onSave?: (val: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <h3 className="text-lg font-semibold text-white/90">{title}</h3>
        {(!content || content.trim() === '') && onSave && (
          <button onClick={() => setIsAdding(true)} className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm bg-purple-500/10 px-2 py-1 rounded-lg transition">
            <Plus className="w-4 h-4" /> 添加
          </button>
        )}
      </div>
      {content && content.trim() !== '' ? (
        <TextPreview title={title} content={content} onSave={onSave} />
      ) : (
        <p className="text-white/30 text-sm italic">暂无内容</p>
      )}

      <AnimatePresence>
        {isAdding && (
          <FullScreenTextModal
            title={`添加 ${title}`}
            content=""
            onClose={() => setIsAdding(false)}
            onSave={(val) => {
              if (onSave) onSave(val);
              setIsAdding(false);
            }}
            initialEditMode={true}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WorldbookViewer({ book, onUpdate, onDelete }: { book: any, onUpdate: (newBook: any) => void, onDelete: () => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [showControls, setShowControls] = useState(false);
  const [viewingEntryIndex, setViewingEntryIndex] = useState<number | null>(null);

  if (!book || !book.entries) return null;
  
  const entries = book.entries || [];

  const handleEdit = (index: number) => {
    const entry = entries[index];
    setEditForm({
      ...entry,
      keys: Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.keys,
      enabled: entry.enabled !== false // default true
    });
    setEditingIndex(index);
  };

  const handleAdd = () => {
    setEditForm({
      comment: '',
      keys: '',
      content: '',
      insertion_order: 50,
      enabled: true
    });
    setEditingIndex(-1);
  };

  const handleSave = () => {
    const newEntries = [...entries];
    const formattedForm = {
      ...editForm,
      keys: typeof editForm.keys === 'string' 
        ? editForm.keys.split(',').map((k: string) => k.trim()).filter(Boolean) 
        : editForm.keys,
      insertion_order: parseInt(editForm.insertion_order) || 50
    };

    if (editingIndex === -1) {
      newEntries.push(formattedForm);
    } else if (editingIndex !== null) {
      newEntries[editingIndex] = formattedForm;
    }
    onUpdate({ ...book, entries: newEntries });
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    if (confirm('确定要删除这条世界书记录吗？')) {
      const newEntries = [...entries];
      newEntries.splice(index, 1);
      onUpdate({ ...book, entries: newEntries });
    }
  };

  const handleToggleEnable = (index: number) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], enabled: newEntries[index].enabled === false ? true : false };
    onUpdate({ ...book, entries: newEntries });
  };

  if (editingIndex !== null) {
    return (
      <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{editingIndex === -1 ? '新增世界书条目' : '编辑世界书条目'}</h3>
          <button onClick={() => setEditingIndex(null)} className="p-1 hover:bg-white/10 rounded-full">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div>
          <label className="block text-xs text-white/60 mb-1">标题 / 备注 (Comment)</label>
          <input 
            type="text" 
            value={editForm.comment || editForm.name || ''} 
            onChange={e => setEditForm({...editForm, comment: e.target.value})}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            placeholder="例如: 角色背景、设定1"
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">关键词 (用逗号分隔)</label>
          <input 
            type="text" 
            value={editForm.keys} 
            onChange={e => setEditForm({...editForm, keys: e.target.value})}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            placeholder="例如: 酒馆, 老板, 饮料"
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">内容</label>
          <textarea 
            value={editForm.content} 
            onChange={e => setEditForm({...editForm, content: e.target.value})}
            className="w-full h-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
            placeholder="条目内容..."
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-white/60 mb-1">插入顺序 (Insertion Order)</label>
            <input 
              type="number" 
              value={editForm.insertion_order} 
              onChange={e => setEditForm({...editForm, insertion_order: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={editForm.enabled} 
                onChange={e => setEditForm({...editForm, enabled: e.target.checked})}
                className="rounded border-white/10 bg-black/40 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm">启用 (Enabled)</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setEditingIndex(null)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition">取消</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm transition">保存</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold">{book.name || '世界书'}</h3>
          {book.description && <p className="text-white/60 text-sm mt-1">{book.description}</p>}
        </div>
        <button 
          onClick={() => setShowControls(!showControls)}
          className={`p-2 rounded-full transition ${showControls ? 'bg-purple-500 text-white' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'}`}
          title="管理世界书"
        >
          <Edit2 className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-3 overflow-hidden mb-4"
          >
            <button 
              onClick={handleAdd}
              className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> 添加条目
            </button>
            <button 
              onClick={onDelete}
              className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> 删除世界书
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-center text-white/40 py-8">暂无条目。</p>
        ) : (
          entries.map((entry: any, i: number) => {
            const isEnabled = entry.enabled !== false;
            const title = entry.comment || entry.name || (Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.keys) || '无标题';
            const keysDisplay = Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.keys;

            return (
              <div key={i} className={`bg-white/5 p-3 rounded-xl border ${isEnabled ? 'border-white/10' : 'border-white/5 opacity-60'} flex gap-3 transition-opacity`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap sm:flex-nowrap justify-between items-start gap-2 mb-1">
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 className="font-semibold text-purple-300 truncate">
                        {title}
                      </h4>
                      {keysDisplay && keysDisplay !== title && (
                        <p className="text-xs text-white/40 truncate mt-0.5">
                          关键词: {keysDisplay}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => handleToggleEnable(i)}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full transition whitespace-nowrap ${isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}
                      >
                        {isEnabled ? '已启用' : '已禁用'}
                      </button>
                      <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full text-white/60 whitespace-nowrap">
                        顺序: {entry.insertion_order || 50}
                      </span>
                      <button onClick={() => handleEdit(i)} className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white transition">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div 
                    className="group cursor-pointer mt-2"
                    onClick={() => setViewingEntryIndex(i)}
                  >
                    <div className="text-white/70 text-sm line-clamp-2">{entry.content}</div>
                    <div className="mt-1.5 text-purple-400 text-xs font-medium flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>阅读全文</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {viewingEntryIndex !== null && (
          <FullScreenTextModal 
            title={Array.isArray(entries[viewingEntryIndex].keys) ? entries[viewingEntryIndex].keys.join(', ') : entries[viewingEntryIndex].keys || '无关键词'} 
            content={entries[viewingEntryIndex].content} 
            onClose={() => setViewingEntryIndex(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useRef } from 'react';
import { Upload, FileJson, QrCode } from 'lucide-react';
import { CharacterCard, saveCharacter } from '../lib/db';

interface Props {
  character: CharacterCard;
  onUpdate: (updatedCharacter: CharacterCard) => void;
}

export function QuickRepliesSection({ character, onUpdate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasQuickReplies = character.data.extensions?.quick_replies && character.data.extensions.quick_replies.length > 0;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Basic validation for quick replies format (array of objects or similar)
        // Adjust based on actual SillyTavern quick replies format
        const quickReplies = Array.isArray(json) ? json : json.quick_replies || [];

        const updatedChar = { ...character };
        if (!updatedChar.data.extensions) {
          updatedChar.data.extensions = {};
        }
        updatedChar.data.extensions.quick_replies = quickReplies;

        await saveCharacter(updatedChar);
        onUpdate(updatedChar);
      } catch (error) {
        console.error("Failed to parse Quick Replies JSON", error);
        alert("无效的 JSON 文件");
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4 text-white/80">
        <QrCode className="w-5 h-5" />
        <h3 className="text-lg font-semibold uppercase tracking-wider text-sm">快速回复按钮 (QUICK REPLIES)</h3>
      </div>

      <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 flex flex-col items-center justify-center bg-white/5 relative overflow-hidden group transition-colors hover:border-white/30 hover:bg-white/10">
        {hasQuickReplies ? (
          <div className="text-center w-full">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileJson className="w-8 h-8" />
            </div>
            <p className="text-white/60 mb-6">已导入 {character.data.extensions.quick_replies.length} 个快速回复配置</p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition flex items-center gap-2 shadow-lg"
              >
                <Upload className="w-4 h-4" /> 重新导入
              </button>
              <button 
                onClick={async () => {
                  if (confirm('确定要清除快速回复配置吗？')) {
                    const updatedChar = { ...character };
                    if (updatedChar.data.extensions) {
                      delete updatedChar.data.extensions.quick_replies;
                    }
                    await saveCharacter(updatedChar);
                    onUpdate(updatedChar);
                  }
                }}
                className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition shadow-lg"
              >
                清除
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 group-hover:text-white transition-colors shadow-inner">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-white/60 mb-6 font-medium">未导入快速回复配置</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition flex items-center gap-2 shadow-lg mx-auto"
            >
              <FileJson className="w-4 h-4" /> 导入 JSON
            </button>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".json" 
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CharacterList } from './components/CharacterList';
import { CharacterDetail } from './components/CharacterDetail';
import { ImportModal } from './components/ImportModal';
import { FolderSidebar } from './components/FolderSidebar';
import { TrashBin } from './components/TrashBin';
import { DuplicateDetector } from './components/DuplicateDetector';
import { AutoTagger } from './components/AutoTagger';
import { AIRecommender } from './components/AIRecommender';
import { SettingsModal } from './components/SettingsModal';
import { migrateDatabase } from './lib/db';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [isMigrating, setIsMigrating] = useState(true);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    migrateDatabase((current, total) => {
      setMigrationProgress({ current, total });
    }).then(() => {
      setIsMigrating(false);
    });
  }, []);

  if (isMigrating && migrationProgress.total > 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold mb-2">正在优化数据库...</h2>
        <p className="text-slate-400 mb-6 text-center max-w-md">
          检测到您有大量角色卡，系统正在进行底层存储优化以提升加载速度。这可能需要几分钟时间，请勿关闭页面。
        </p>
        <p className="font-mono text-purple-400 font-bold text-lg mb-2">
          {migrationProgress.current} / {migrationProgress.total}
        </p>
        <div className="w-full max-w-md bg-white/10 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
            style={{ width: `${(migrationProgress.current / migrationProgress.total) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-white bg-slate-900 h-screen flex overflow-hidden relative">
      
      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            
            <FolderSidebar 
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onClose={() => setIsSidebarOpen(false)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div id="main-scroll-container" className="flex-1 relative overflow-y-auto flex flex-col w-full h-full">
        {selectedFolderId === 'trash' ? (
          <TrashBin onClose={() => { setSelectedFolderId(null); setRefreshKey(prev => prev + 1); }} />
        ) : selectedFolderId === 'duplicates' ? (
          <DuplicateDetector 
            onClose={() => { setSelectedFolderId(null); setRefreshKey(prev => prev + 1); }} 
            onSelectChar={setSelectedCharId}
          />
        ) : selectedFolderId === 'autotagger' ? (
          <AutoTagger onClose={() => { setSelectedFolderId(null); setRefreshKey(prev => prev + 1); }} onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : selectedFolderId === 'recommender' ? (
          <AIRecommender 
            onClose={() => { setSelectedFolderId(null); setRefreshKey(prev => prev + 1); }} 
            onSelectChar={(id) => { setSelectedFolderId(null); setSelectedCharId(id); }}
            onOpenSettings={() => setIsSettingsOpen(true)} 
          />
        ) : (
          <CharacterList
            key={selectedFolderId}
            folderId={selectedFolderId}
            onSelect={setSelectedCharId}
            onImport={() => setIsImportModalOpen(true)}
            onSelectFolder={setSelectedFolderId}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            refreshTrigger={refreshKey}
          />
        )}

        <AnimatePresence>
          {selectedCharId && (
            <CharacterDetail
              id={selectedCharId}
              onBack={() => {
                setSelectedCharId(null);
                setRefreshKey(prev => prev + 1);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={() => setRefreshKey(prev => prev + 1)}
        folderId={selectedFolderId}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

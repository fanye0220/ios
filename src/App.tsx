/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CharacterList } from './components/CharacterList';
import { CharacterDetail } from './components/CharacterDetail';
import { ImportModal } from './components/ImportModal';
import { FolderSidebar } from './components/FolderSidebar';
import { TrashBin } from './components/TrashBin';
import { DuplicateDetector } from './components/DuplicateDetector';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
        ) : (
          <CharacterList
            key={`${refreshKey}-${selectedFolderId}`}
            folderId={selectedFolderId}
            onSelect={setSelectedCharId}
            onImport={() => setIsImportModalOpen(true)}
            onSelectFolder={setSelectedFolderId}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />
        )}

        <AnimatePresence>
          {selectedCharId && (
            <CharacterDetail
              id={selectedCharId}
              onBack={() => setSelectedCharId(null)}
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
    </div>
  );
}

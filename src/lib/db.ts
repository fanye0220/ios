import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface CharacterCard {
  id: string;
  name: string;
  avatarBlob?: Blob;
  avatarUrlFallback?: string;
  avatarHistory?: Blob[]; // Store historical avatars
  data: any; // The parsed JSON data
  originalFile?: File; // The original PNG file if available
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
  folderId?: string;
}

interface TavernDB extends DBSchema {
  characters: {
    key: string;
    value: CharacterCard;
    indexes: { 'by-date': number; 'by-folder': string };
  };
  folders: {
    key: string;
    value: Folder;
    indexes: { 'by-date': number };
  };
}

let dbPromise: Promise<IDBPDatabase<TavernDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<TavernDB>('tavern-manager-v2', 2, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('characters', { keyPath: 'id' });
          store.createIndex('by-date', 'createdAt');
        }
        if (oldVersion < 2) {
          const charStore = transaction.objectStore('characters');
          charStore.createIndex('by-folder', 'folderId');
          
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('by-date', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function getFolders(): Promise<Folder[]> {
  const db = await initDB();
  return db.getAllFromIndex('folders', 'by-date');
}

export async function saveFolder(folder: Folder): Promise<void> {
  const db = await initDB();
  await db.put('folders', folder);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(['folders', 'characters'], 'readwrite');
  
  await tx.objectStore('folders').delete(id);
  
  const charStore = tx.objectStore('characters');
  const index = charStore.index('by-folder');
  let cursor = await index.openCursor(id);
  
  while (cursor) {
    const char = cursor.value;
    delete char.folderId;
    await cursor.update(char);
    cursor = await cursor.continue();
  }
  
  await tx.done;
}

export type SortOption = 'newest_import' | 'oldest_import' | 'recently_modified' | 'a_z' | 'z_a';

export async function getCharacters(
  page: number, 
  pageSize: number, 
  folderId?: string | null, 
  searchQuery: string = '', 
  tags: string[] = [],
  sortBy: SortOption = 'newest_import'
): Promise<{ characters: CharacterCard[], total: number }> {
  const db = await initDB();
  const tx = db.transaction('characters', 'readonly');
  const store = tx.store;
  
  let allCharacters = await store.getAll();
  
  // Filter out soft-deleted characters
  allCharacters = allCharacters.filter(c => !c.deletedAt);
  
  // Apply sorting
  allCharacters.sort((a, b) => {
    switch (sortBy) {
      case 'newest_import':
        return b.createdAt - a.createdAt;
      case 'oldest_import':
        return a.createdAt - b.createdAt;
      case 'recently_modified':
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      case 'a_z':
        return a.name.localeCompare(b.name, 'zh-CN');
      case 'z_a':
        return b.name.localeCompare(a.name, 'zh-CN');
      default:
        return b.createdAt - a.createdAt;
    }
  });

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    allCharacters = allCharacters.filter(c => {
      const charTags = c.data?.tags || c.data?.data?.tags;
      return c.name.toLowerCase().includes(query) || 
        (charTags && charTags.some((t: string) => t.toLowerCase().includes(query)));
    });
  }

  if (tags.length > 0) {
    allCharacters = allCharacters.filter(c => {
      const charTags = c.data?.tags || c.data?.data?.tags;
      return charTags && tags.every(t => charTags.includes(t));
    });
  }

  if (folderId === null) {
    // Only filter to root characters if we are NOT searching or filtering by tags
    if (!searchQuery && tags.length === 0) {
      allCharacters = allCharacters.filter(c => !c.folderId);
    }
  } else if (folderId && folderId !== 'all') {
    allCharacters = allCharacters.filter(c => c.folderId === folderId);
  }
  
  const total = allCharacters.length;
  const characters = allCharacters.slice((page - 1) * pageSize, page * pageSize);
  
  return { characters, total };
}

export async function getAllTags(): Promise<string[]> {
  const db = await initDB();
  const characters = await db.getAll('characters');
  const tags = new Set<string>();
  characters.forEach(c => {
    if (c.deletedAt) return;
    const charTags = c.data?.tags || c.data?.data?.tags;
    if (charTags && Array.isArray(charTags)) {
      charTags.forEach((t: string) => tags.add(t));
    }
  });
  return Array.from(tags).sort();
}

export async function renameTag(oldTag: string, newTag: string): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('characters', 'readwrite');
  const store = tx.store;
  const characters = await store.getAll();
  
  for (const char of characters) {
    const charTags = char.data?.tags || char.data?.data?.tags;
    if (charTags && Array.isArray(charTags) && charTags.includes(oldTag)) {
      const newTags = charTags.map((t: string) => t === oldTag ? newTag : t);
      if (char.data?.data) {
        char.data.data.tags = Array.from(new Set(newTags));
      } else {
        char.data.tags = Array.from(new Set(newTags));
      }
      await store.put(char);
    }
  }
  await tx.done;
}

export async function deleteTag(tagToDelete: string): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('characters', 'readwrite');
  const store = tx.store;
  const characters = await store.getAll();
  
  for (const char of characters) {
    const charTags = char.data?.tags || char.data?.data?.tags;
    if (charTags && Array.isArray(charTags) && charTags.includes(tagToDelete)) {
      const newTags = charTags.filter((t: string) => t !== tagToDelete);
      if (char.data?.data) {
        char.data.data.tags = newTags;
      } else {
        char.data.tags = newTags;
      }
      await store.put(char);
    }
  }
  await tx.done;
}

export async function getCharacter(id: string): Promise<CharacterCard | undefined> {
  const db = await initDB();
  return db.get('characters', id);
}

export async function saveCharacter(character: CharacterCard): Promise<void> {
  const db = await initDB();
  const existing = await db.get('characters', character.id);
  if (existing) {
    character.updatedAt = Date.now();
  }
  await db.put('characters', character);
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await initDB();
  const char = await db.get('characters', id);
  if (char) {
    if (char.deletedAt) {
      // Hard delete if already in trash
      await db.delete('characters', id);
    } else {
      // Soft delete
      char.deletedAt = Date.now();
      await db.put('characters', char);
    }
  }
}

export async function restoreCharacter(id: string): Promise<void> {
  const db = await initDB();
  const char = await db.get('characters', id);
  if (char && char.deletedAt) {
    delete char.deletedAt;
    await db.put('characters', char);
  }
}

export async function getTrashedCharacters(): Promise<CharacterCard[]> {
  const db = await initDB();
  const allCharacters = await db.getAll('characters');
  return allCharacters.filter(c => c.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
}

export async function emptyTrash(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('characters', 'readwrite');
  const store = tx.store;
  const allCharacters = await store.getAll();
  
  for (const char of allCharacters) {
    if (char.deletedAt) {
      await store.delete(char.id);
    }
  }
  await tx.done;
}

export async function cleanupOldTrash(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('characters', 'readwrite');
  const store = tx.store;
  const allCharacters = await store.getAll();
  
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  for (const char of allCharacters) {
    if (char.deletedAt && (now - char.deletedAt > SEVEN_DAYS_MS)) {
      await store.delete(char.id);
    }
  }
  await tx.done;
}

export interface DuplicateGroup {
  id: string;
  characters: CharacterCard[];
  reason: string;
}

export async function findDuplicates(): Promise<DuplicateGroup[]> {
  const db = await initDB();
  const allCharacters = await db.getAll('characters');
  const activeCharacters = allCharacters.filter(c => !c.deletedAt);
  
  const groups: DuplicateGroup[] = [];
  const processedIds = new Set<string>();
  
  for (let i = 0; i < activeCharacters.length; i++) {
    const charA = activeCharacters[i];
    if (processedIds.has(charA.id)) continue;
    
    const duplicates: CharacterCard[] = [charA];
    let duplicateReason = '';
    
    const aData = charA.data || {};
    const aFirstMes = aData.first_mes || aData.data?.first_mes;
    const aDesc = aData.description || aData.data?.description;
    const aScenario = aData.scenario || aData.data?.scenario;

    for (let j = i + 1; j < activeCharacters.length; j++) {
      const charB = activeCharacters[j];
      if (processedIds.has(charB.id)) continue;
      
      const bData = charB.data || {};
      const bFirstMes = bData.first_mes || bData.data?.first_mes;
      const bDesc = bData.description || bData.data?.description;
      const bScenario = bData.scenario || bData.data?.scenario;
      
      if (aFirstMes && bFirstMes && aFirstMes === bFirstMes && aFirstMes.length > 20) {
        duplicates.push(charB);
        processedIds.add(charB.id);
        duplicateReason = '开场白相同';
      } else if (aDesc && bDesc && aDesc === bDesc && aDesc.length > 50) {
        duplicates.push(charB);
        processedIds.add(charB.id);
        duplicateReason = '设定(Description)相同';
      } else if (aScenario && bScenario && aScenario === bScenario && aScenario.length > 20) {
        duplicates.push(charB);
        processedIds.add(charB.id);
        duplicateReason = '世界书/场景(Scenario)相同';
      }
    }
    
    if (duplicates.length > 1) {
      processedIds.add(charA.id);
      groups.push({
        id: crypto.randomUUID(),
        characters: duplicates,
        reason: duplicateReason
      });
    }
  }
  
  return groups;
}

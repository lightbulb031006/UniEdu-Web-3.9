/**
 * database.js - Database abstraction layer
 * Supports: Supabase (cloud), IndexedDB (local), localStorage (fallback)
 */

(function() {
    'use strict';

    const DB_NAME = 'UnicornsEdu';
    const DB_VERSION = 1;
    const STORE_NAME = 'appData';
    const BACKUP_KEY = 'unicorns.backup';
    const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    let db = null;
    let useIndexedDB = false;
    let useSupabase = false;
    let unsubscribeSupabaseRealtime = null;
    let realtimeRefreshTimer = null;
    let realtimeUiTimer = null;
    const realtimeTables = new Set();
    let supabaseInitPromise = null;

    const SUPABASE_REALTIME_CONFIG = {
        students: { key: 'students', id: 'id' },
        teachers: { key: 'teachers', id: 'id' },
        classes: { key: 'classes', id: 'id' },
        sessions: {
            key: 'sessions',
            id: 'id',
            sort: (a, b) => {
                const dateA = a?.date || '';
                const dateB = b?.date || '';
                if (dateA === dateB) return (b?.startTime || '').localeCompare(a?.startTime || '');
                return dateB.localeCompare(dateA);
            }
        },
        attendance: { key: 'attendance', id: 'id' },
        payments: { key: 'payments', id: 'id' },
        wallet_transactions: { 
            key: 'walletTransactions', 
            id: 'id',
            sort: (a, b) => {
                const dateA = a?.date || '';
                const dateB = b?.date || '';
                if (dateA === dateB) {
                    const timeA = a?.createdAt || '';
                    const timeB = b?.createdAt || '';
                    return timeB.localeCompare(timeA); // Newest first
                }
                return dateB.localeCompare(dateA); // Newest first
            }
        },
        categories: {
            key: 'categories',
            id: 'id',
            sort: (a, b) => (a?.name || '').localeCompare(b?.name || '')
        },
        documents: {
            key: 'documents',
            id: 'id',
            sort: (a, b) => {
                const dateA = a?.createdAt || '';
                const dateB = b?.createdAt || '';
                return dateB.localeCompare(dateA); // Newest first
            }
        },
        lesson_plans: { key: 'lessonPlans', id: 'id' },
        lesson_resources: { key: 'lessonResources', id: 'id' },
        lesson_tasks: { key: 'lessonTasks', id: 'id' },
        lesson_outputs: { key: 'lessonOutputs', id: 'id' }
    };

    function triggerRealtimeUiRefresh() {
        if (realtimeUiTimer) return;
        const callback = () => {
            realtimeUiTimer = null;
            if (!window.UniUI) return;
            try {
                if (typeof window.UniUI.refreshNavigation === 'function') {
                    window.UniUI.refreshNavigation();
                }
            } catch (e) {
                console.error('Failed to refresh navigation after realtime update:', e);
            }
            try {
                if (typeof window.UniUI.refreshCurrentPage === 'function') {
                    window.UniUI.refreshCurrentPage();
                }
            } catch (e) {
                console.error('Failed to refresh current page after realtime update:', e);
            }
        };
        if (typeof window.requestAnimationFrame === 'function') {
            realtimeUiTimer = window.requestAnimationFrame(callback);
        } else {
            realtimeUiTimer = setTimeout(callback, 16);
        }
    }

    function ensureFinanceForData(data) {
        if (!data) return data;
        if (window.UniData && typeof window.UniData.ensureStudentFinanceDefaults === 'function') {
            try {
                return window.UniData.ensureStudentFinanceDefaults(data);
            } catch (err) {
                console.warn('Failed to ensure student finance defaults:', err);
            }
        }
        return data;
    }

    function getNowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function logMutationDuration(label, startedAt) {
        if (!label) return;
        try {
            const elapsed = getNowMs() - startedAt;
            const formatted = Number.isFinite(elapsed) ? `${elapsed.toFixed(1)}ms` : 'n/a';
            console.log(`${label} completed in ${formatted}`);
        } catch (err) {
            console.log(label);
        }
    }

    function applyRemoteSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;
        if (!window.demo || typeof window.demo !== 'object') {
            window.demo = Array.isArray(snapshot) ? [...snapshot] : { ...snapshot };
            ensureFinanceForData(window.demo);
            return;
        }
        const existingKeys = Object.keys(window.demo);
        existingKeys.forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
                delete window.demo[key];
            }
        });
        Object.entries(snapshot).forEach(([key, value]) => {
            window.demo[key] = value;
        });
        ensureFinanceForData(window.demo);
    }

    async function refetchFromSupabase() {
        if (!window.SupabaseAdapter || typeof window.SupabaseAdapter.load !== 'function') {
            return;
        }
        try {
            const ready = await ensureSupabaseInitialized();
            if (!ready) return;
            const latest = await window.SupabaseAdapter.load();
            if (latest) {
                const ensured = ensureFinanceForData(latest);
                applyRemoteSnapshot(ensured);
                triggerRealtimeUiRefresh();
            }
        } catch (err) {
            console.warn('Failed to refetch from Supabase after save:', err);
        }
    }

    function getRealtimeNormalizer(tableName) {
        if (window.SupabaseAdapter && typeof window.SupabaseAdapter.normalizeRow === 'function') {
            return (row) => window.SupabaseAdapter.normalizeRow(tableName, row);
        }
        return (row) => row;
    }

    function normalizeRealtimeCategory(raw) {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === 'string') {
            const name = raw.trim();
            return name ? { id: null, name } : null;
        }
        if (typeof raw === 'object') {
            const name = (raw.name ?? raw.value ?? raw.label ?? '').trim();
            if (!name) return null;
            const id = raw.id !== undefined ? raw.id : (raw.ID !== undefined ? raw.ID : null);
            return { id: id === undefined ? null : id, name };
        }
        const name = String(raw).trim();
        return name ? { id: null, name } : null;
    }

    function applyCategoriesRealtime(payload, eventType) {
        const currentSource = Array.isArray(window.demo?.categories) ? window.demo.categories : [];
        const current = currentSource.map(normalizeRealtimeCategory).filter(Boolean);
        const oldCat = normalizeRealtimeCategory(payload?.old);
        const newCat = normalizeRealtimeCategory(payload?.new);

        const findIndex = (catObj) => {
            if (!catObj) return -1;
            if (catObj.id !== null && catObj.id !== undefined) {
                const idx = current.findIndex(cat => cat && cat.id === catObj.id);
                if (idx !== -1) return idx;
            }
            if (catObj.name) {
                return current.findIndex(cat => (cat?.name || '') === catObj.name);
            }
            return -1;
        };

        let changed = false;
        if (eventType === 'DELETE') {
            const idx = findIndex(oldCat);
            if (idx !== -1) {
                current.splice(idx, 1);
                changed = true;
            }
        } else {
            if (oldCat) {
                const idx = findIndex(oldCat);
                if (idx !== -1) {
                    if (newCat && newCat.name) {
                        current[idx] = { id: newCat.id ?? oldCat.id ?? null, name: newCat.name };
                    } else {
                        current.splice(idx, 1);
                    }
                    changed = true;
                }
            }
            if (newCat && newCat.name) {
                const idx = findIndex(newCat);
                if (idx === -1) {
                    current.push({ id: newCat.id ?? null, name: newCat.name });
                    changed = true;
                } else {
                    const existing = current[idx];
                    const nextId = newCat.id ?? existing.id ?? null;
                    if (existing.id !== nextId || existing.name !== newCat.name) {
                        current[idx] = { id: nextId, name: newCat.name };
                        changed = true;
                    }
                }
            }
        }

        if (!changed) return false;

        let normalized = current;
        if (window.UniData && typeof window.UniData.normalizeCategories === 'function') {
            normalized = window.UniData.normalizeCategories(current);
        } else {
            const seen = new Set();
            normalized = current.filter(cat => {
                const key = `${cat.id ?? ''}::${(cat.name || '').toLowerCase()}`;
                if (!cat.name || seen.has(key)) return false;
                seen.add(key);
                return true;
            }).map(cat => ({ id: cat.id ?? null, name: cat.name }));
        }

        window.demo.categories = normalized;
        if (window.AppStore && typeof window.AppStore.setCategoriesSilently === 'function') {
            window.AppStore.setCategoriesSilently(normalized);
        }
        return true;
    }

    function applyRealtimePayload(payload) {
        if (!payload || !payload.table) return false;
        const tableName = payload.table;
        const config = SUPABASE_REALTIME_CONFIG[tableName];
        if (!config || !config.key) return false;

        if (config.key === 'categories') {
            const eventType = (payload.eventType || '').toUpperCase();
            return applyCategoriesRealtime(payload, eventType);
        }

        if (!window.demo || typeof window.demo !== 'object') {
            window.demo = {};
        }

        const normalize = getRealtimeNormalizer(tableName);
        const idField = config.id || 'id';
        const eventType = (payload.eventType || '').toUpperCase();
        const baseCollection = Array.isArray(window.demo[config.key]) ? [...window.demo[config.key]] : [];
        let nextCollection = baseCollection;
        let handled = false;

        const locateId = (record) => {
            if (!record) return null;
            if (record[idField] !== undefined && record[idField] !== null) {
                return record[idField];
            }
            return payload.old && payload.old[idField] !== undefined ? payload.old[idField] : null;
        };

        switch (eventType) {
            case 'INSERT':
            case 'UPDATE':
            case 'UPSERT': {
                const normalized = normalize(payload.new || payload.old || null);
                const targetId = locateId(normalized);
                if (targetId === null) return false;
                const idx = baseCollection.findIndex(item => item && item[idField] === targetId);
                if (idx === -1) {
                    baseCollection.push({ ...normalized });
                } else {
                    baseCollection[idx] = { ...baseCollection[idx], ...normalized };
                }
                nextCollection = baseCollection;
                handled = true;
                break;
            }
            case 'DELETE': {
                const normalized = normalize(payload.old || payload.new || null);
                const targetId = locateId(normalized);
                if (targetId === null) return false;
                const filtered = baseCollection.filter(item => item && item[idField] !== targetId);
                if (filtered.length === baseCollection.length) {
                    return false;
                }
                nextCollection = filtered;
                handled = true;
                break;
            }
            default:
                return false;
        }

        if (!handled) return false;

        if (config.sort && Array.isArray(nextCollection)) {
            nextCollection.sort(config.sort);
        }

        window.demo[config.key] = nextCollection;

        if (config.key === 'categories' && window.AppStore && typeof window.AppStore.setCategoriesSilently === 'function') {
            window.AppStore.setCategoriesSilently(nextCollection);
        }

        return true;
    }

    function scheduleFullRealtimeReload(meta) {
        if (meta?.table) {
            realtimeTables.add(meta.table);
        }
        if (realtimeRefreshTimer) {
            clearTimeout(realtimeRefreshTimer);
        }
        realtimeRefreshTimer = setTimeout(async () => {
            realtimeRefreshTimer = null;
            try {
                const latest = await DatabaseAdapter.load({ preferLocal: false });
                if (!latest) return;
                applyRemoteSnapshot(latest);
                if (Array.isArray(latest.categories) && window.AppStore && typeof window.AppStore.setCategoriesSilently === 'function') {
                    window.AppStore.setCategoriesSilently(latest.categories);
                }
                triggerRealtimeUiRefresh();
                realtimeTables.clear();
            } catch (err) {
                console.error('Failed to refresh data after Supabase change:', err);
            }
        }, 150);
    }

    async function setupSupabaseRealtime() {
        if (!window.SupabaseAdapter || typeof window.SupabaseAdapter.subscribeToChanges !== 'function') return;
        if (unsubscribeSupabaseRealtime) return;
        try {
            const ready = await ensureSupabaseInitialized();
            if (!ready) return;
            const unsub = await window.SupabaseAdapter.subscribeToChanges((payload) => {
                const handled = applyRealtimePayload(payload || {});
                if (handled) {
                    triggerRealtimeUiRefresh();
                } else {
                    scheduleFullRealtimeReload(payload || {});
                }
            });
            if (typeof unsub === 'function') {
                unsubscribeSupabaseRealtime = unsub;
            }
        } catch (err) {
            console.error('Failed to subscribe to Supabase realtime updates:', err);
        }
    }

    /**
     * Initialize IndexedDB
     */
    function initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB not supported, falling back to localStorage');
                resolve(false);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.warn('IndexedDB open failed, falling back to localStorage');
                resolve(false);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                useIndexedDB = true;
                console.log('IndexedDB initialized successfully');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    /**
     * Check if Supabase is enabled
     */
    function checkSupabase() {
        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
            useSupabase = true;
            console.log('Supabase adapter detected');
            return true;
        }
        return false;
    }

    async function ensureSupabaseInitialized(force = false) {
        if (!window.SupabaseAdapter || !window.SupabaseAdapter.isEnabled) {
            return false;
        }
        if (!supabaseInitPromise || force) {
            if (typeof window.SupabaseAdapter.init === 'function') {
                supabaseInitPromise = window.SupabaseAdapter.init();
            } else {
                supabaseInitPromise = Promise.resolve(true);
            }
        }
        try {
            const result = await supabaseInitPromise;
            if (result === false) {
                throw new Error('Supabase init returned false');
            }
            useSupabase = true;
            return true;
        } catch (error) {
            console.error('Supabase initialization failed:', error);
            supabaseInitPromise = null;
            return false;
        }
    }

    /**
     * Compress data using simple JSON compression
     */
    function compress(data) {
        try {
            const json = JSON.stringify(data);
            return json.replace(/\s+/g, ' ').trim();
        } catch (e) {
            console.error('Compression failed:', e);
            return JSON.stringify(data);
        }
    }

    /**
     * Decompress data
     */
    function decompress(compressed) {
        try {
            return JSON.parse(compressed);
        } catch (e) {
            console.error('Decompression failed:', e);
            return null;
        }
    }

    /**
     * Save data to IndexedDB
     */
    function saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('IndexedDB not initialized'));
                return;
            }

            const compressed = compress(data);
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(compressed, 'main');

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(new Error('Failed to save to IndexedDB'));
        });
    }

    /**
     * Load data from IndexedDB
     */
    function loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('IndexedDB not initialized'));
                return;
            }

            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('main');

            request.onsuccess = () => {
                const compressed = request.result;
                if (compressed) {
                    const data = decompress(compressed);
                    resolve(data);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(new Error('Failed to load from IndexedDB'));
        });
    }

    /**
     * Save data to localStorage (fallback)
     */
    function saveToLocalStorage(data) {
        try {
            const compressed = compress(data);
            localStorage.setItem('unicorns.data', compressed);
            return true;
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            try {
                localStorage.setItem('unicorns.data', JSON.stringify(data));
                return true;
            } catch (e2) {
                console.error('Failed to save even without compression:', e2);
                return false;
            }
        }
    }

    /**
     * Load data from localStorage (fallback)
     */
    function loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('unicorns.data');
            if (stored) {
                return decompress(stored);
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }
        return null;
    }

    /**
     * Create backup of current data
     */
    function createBackup(data) {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                data: data,
                version: DB_VERSION
            };
            const backupJson = JSON.stringify(backup);
            localStorage.setItem(BACKUP_KEY, backupJson);
            
            if (useIndexedDB && db) {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.put(backupJson, 'backup');
            }
            
            console.log('Backup created:', backup.timestamp);
            return true;
        } catch (e) {
            console.error('Failed to create backup:', e);
            return false;
        }
    }

    /**
     * Load backup
     */
    function loadBackup() {
        try {
            const backupJson = localStorage.getItem(BACKUP_KEY);
            if (backupJson) {
                const backup = JSON.parse(backupJson);
                return backup.data;
            }
        } catch (e) {
            console.error('Failed to load backup:', e);
        }
        return null;
    }

    async function loadLocalSnapshot() {
        if (useIndexedDB && db) {
            try {
                const data = await loadFromIndexedDB();
                if (data) return data;
            } catch (err) {
                console.warn('Failed to load from IndexedDB snapshot:', err);
            }
        }
        const fromLocalStorage = loadFromLocalStorage();
        if (fromLocalStorage) return fromLocalStorage;
        return loadBackup();
    }

    /**
     * Database Adapter - Main interface
     */
    const DatabaseAdapter = {
        /**
         * Save data
         */
        async save(data, options = {}) {
            const skipSupabase = options && options.skipSupabase === true;
            const supabaseEntities = (options && typeof options.supabaseEntities === 'object') ? options.supabaseEntities : null;
            const supabaseDeletes = (options && typeof options.supabaseDeletes === 'object') ? options.supabaseDeletes : null;
            const forceRefetch = options && options.forceRefetch === true;
            const skipRefetchFlag = options && options.skipRefetch === true;
            const hasPartialMutation = !!(
                (supabaseEntities && Object.keys(supabaseEntities).length > 0) ||
                (supabaseDeletes && Object.keys(supabaseDeletes).length > 0)
            );
            const shouldRefetchAfterSupabase = !skipRefetchFlag && (forceRefetch || (!hasPartialMutation));
            try {
                // Priority 1: Supabase (if enabled)
                if (!skipSupabase && window.SupabaseAdapter) {
                    const supabaseReady = await ensureSupabaseInitialized();
                    if (supabaseReady) {
                        let success = false;
                        let mutationLabel = '';
                        if ((supabaseEntities && Object.keys(supabaseEntities).length > 0) || (supabaseDeletes && Object.keys(supabaseDeletes).length > 0)) {
                            mutationLabel = `[Supabase] saveEntities(${Object.keys(supabaseEntities || {}).join(',') || 'deletes'})`;
                            const startedAt = getNowMs();
                            success = await window.SupabaseAdapter.saveEntities(supabaseEntities || {}, { deletes: supabaseDeletes || {} });
                            logMutationDuration(mutationLabel, startedAt);
                        } else {
                            mutationLabel = '[Supabase] save(full-dataset)';
                            const startedAt = getNowMs();
                            success = await window.SupabaseAdapter.save(data);
                            logMutationDuration(mutationLabel, startedAt);
                        }
                        if (success) {
                            console.log('Saved to Supabase');
                            // Also save locally for offline access
                            if (useIndexedDB && db) {
                                await saveToIndexedDB(data).catch(() => {});
                            } else {
                                saveToLocalStorage(data);
                            }
                            if (shouldRefetchAfterSupabase) {
                                refetchFromSupabase();
                            } else {
                                triggerRealtimeUiRefresh();
                            }
                            return true;
                        }
                    } else {
                        console.warn('Supabase not ready; skipping remote save.');
                    }
                }

                // Priority 2: IndexedDB / local cache
                if (useIndexedDB && db) {
                    await saveToIndexedDB(data);
                } else {
                    saveToLocalStorage(data);
                }
                
                // Create backup periodically
                const lastBackup = localStorage.getItem('unicorns.lastBackup');
                const now = Date.now();
                if (!lastBackup || (now - parseInt(lastBackup)) > BACKUP_INTERVAL) {
                    createBackup(data);
                    localStorage.setItem('unicorns.lastBackup', now.toString());
                }
                
                return true;
            } catch (e) {
                console.error('Save failed, trying localStorage fallback:', e);
                return saveToLocalStorage(data);
            }
        },

        /**
         * Load data
         */
        async load(options = {}) {
            const preferLocal = options.preferLocal !== false; // default true
            const skipRemote = options.skipRemote === true;
            const skipLocal = options.skipLocal === true;
            const tablesFilter = Array.isArray(options.tables) ? options.tables : null;
            try {
                // If preferLocal is false, prioritize Supabase and skip local cache check
                if (!preferLocal && !skipRemote && window.SupabaseAdapter) {
                    const supabaseReady = await ensureSupabaseInitialized();
                    if (supabaseReady) {
                        try {
                            const remote = await window.SupabaseAdapter.load({ tables: tablesFilter });
                            if (remote) {
                                const ensuredRemote = ensureFinanceForData(remote);
                                console.log('✅ Loaded fresh data from Supabase (bypassing cache)');
                                if (!skipLocal && !tablesFilter) {
                                    if (useIndexedDB && db) {
                                        await saveToIndexedDB(ensuredRemote).catch(() => {});
                                    } else {
                                        saveToLocalStorage(ensuredRemote);
                                    }
                                }
                                return ensuredRemote;
                            }
                        } catch (remoteError) {
                            console.warn('Failed to load from Supabase, falling back to cache:', remoteError);
                        }
                    }
                }

                let localSnapshot = null;
                if (!skipLocal) {
                    localSnapshot = await loadLocalSnapshot();
                    if (localSnapshot && preferLocal) {
                        return ensureFinanceForData(localSnapshot);
                    }
                }

                if (!skipRemote && window.SupabaseAdapter) {
                    const supabaseReady = await ensureSupabaseInitialized();
                    if (supabaseReady) {
                        const remote = await window.SupabaseAdapter.load({ tables: tablesFilter });
                        if (remote) {
                            const ensuredRemote = ensureFinanceForData(remote);
                            console.log('✅ Loaded from Supabase');
                            if (!skipLocal && !tablesFilter) {
                                if (useIndexedDB && db) {
                                    await saveToIndexedDB(ensuredRemote).catch(() => {});
                                } else {
                                    saveToLocalStorage(ensuredRemote);
                                }
                            }
                            return ensuredRemote;
                        }
                    }
                }

                if (localSnapshot) {
                    return ensureFinanceForData(localSnapshot);
                }
                
                return ensureFinanceForData(loadBackup());
            } catch (e) {
                console.error('Load failed, trying localStorage fallback:', e);
                if (!skipLocal) {
                    const data = loadFromLocalStorage();
                    if (data) return ensureFinanceForData(data);
                }
                return ensureFinanceForData(loadBackup());
            }
        },

        /**
         * Sync with Supabase
         */
        async sync(localData) {
            if (useSupabase && window.SupabaseAdapter) {
                return await window.SupabaseAdapter.sync(localData);
            }
            return { action: 'skipped', reason: 'Supabase not enabled' };
        },

        /**
         * Export data as JSON
         */
        exportData() {
            return new Promise(async (resolve) => {
                const data = await this.load();
                if (data) {
                    const json = JSON.stringify(data, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `unicorns-backup-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        },

        /**
         * Import data from JSON file
         */
        importData(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        await this.save(data);
                        resolve(true);
                    } catch (err) {
                        reject(new Error('Invalid JSON file: ' + err.message));
                    }
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            });
        },

        /**
         * Get storage info
         */
        async getStorageInfo() {
            const info = {
                type: useSupabase ? 'Supabase' : (useIndexedDB ? 'IndexedDB' : 'localStorage'),
                hasBackup: !!localStorage.getItem(BACKUP_KEY),
                lastBackup: localStorage.getItem('unicorns.lastBackup') || null,
                useIndexedDB: useIndexedDB,
                useSupabase: useSupabase
            };

            if (useIndexedDB && db) {
                try {
                    const data = await this.load();
                    if (data) {
                        const json = JSON.stringify(data);
                        info.size = new Blob([json]).size;
                        info.sizeFormatted = this.formatBytes(info.size);
                    }
                } catch (e) {
                    console.error('Failed to calculate size:', e);
                }
            } else {
                try {
                    const data = localStorage.getItem('unicorns.data');
                    if (data) {
                        info.size = new Blob([data]).size;
                        info.sizeFormatted = this.formatBytes(info.size);
                    }
                } catch (e) {
                    console.error('Failed to calculate size:', e);
                }
            }

            return info;
        },

        /**
         * Format bytes to human readable
         */
        formatBytes(bytes) {
            if (!bytes) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },

        /**
         * Setup auto-backup
         */
        setupAutoBackup() {
            const lastBackup = localStorage.getItem('unicorns.lastBackup');
            const now = Date.now();
            if (!lastBackup || (now - parseInt(lastBackup)) > BACKUP_INTERVAL) {
                // Will be created on next save
            }

            window.addEventListener('beforeunload', () => {
                if (window.demo) {
                    createBackup(window.demo);
                }
            });
        },

        /**
         * Clear all data (use with caution!)
         */
        async clear() {
            try {
                if (useIndexedDB && db) {
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    await new Promise((resolve, reject) => {
                        const request = store.clear();
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject();
                    });
                }
                localStorage.removeItem('unicorns.data');
                localStorage.removeItem(BACKUP_KEY);
                localStorage.removeItem('unicorns.lastBackup');
                return true;
            } catch (e) {
                console.error('Failed to clear data:', e);
                return false;
            }
        }
    };

    /**
     * Migrate data from localStorage to IndexedDB
     */
    async function migrateFromLocalStorage() {
        try {
            const stored = localStorage.getItem('unicorns.data');
            if (stored && useIndexedDB && db) {
                const existing = await loadFromIndexedDB();
                if (!existing) {
                    const data = decompress(stored);
                    if (data) {
                        await saveToIndexedDB(data);
                        console.log('Data migrated from localStorage to IndexedDB');
                        return true;
                    }
                }
            }
        } catch (e) {
            console.error('Migration failed:', e);
        }
        return false;
    }

    // Expose compress/decompress for external use
    DatabaseAdapter.compress = compress;
    DatabaseAdapter.decompress = decompress;

    /**
     * Initialize database
     */
    DatabaseAdapter.init = async function() {
        // Check Supabase first
        checkSupabase();

        // Initialize IndexedDB
        const indexedDBAvailable = await initIndexedDB();
        if (!indexedDBAvailable) {
            console.log('Using localStorage as storage backend');
        } else {
            await migrateFromLocalStorage();
        }

        await setupSupabaseRealtime();
        
        // Setup auto-backup
        this.setupAutoBackup();
        
        return {
            indexedDB: indexedDBAvailable,
            supabase: useSupabase
        };
    };

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            DatabaseAdapter.init();
        });
    } else {
        DatabaseAdapter.init();
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
            if (typeof unsubscribeSupabaseRealtime === 'function') {
                try { unsubscribeSupabaseRealtime(); } catch (e) { console.warn('Failed to unsubscribe realtime listener', e); }
                unsubscribeSupabaseRealtime = null;
            }
        });
    }

    // Export
    window.DatabaseAdapter = DatabaseAdapter;
})();


import { Order, Recipe, IngredientBatch, Warning, ViewType, CustomerDeliveryBoardState, PurchaseDecision } from '../types';
import { mockOrders } from '../data/mockOrders';
import { mockRecipes } from '../data/mockRecipes';
import { mockIngredients } from '../data/mockIngredients';
import { calculateAllWarnings, mergeWarningsWithResolvedState } from './warningUtils';

const STORAGE_KEY = 'xzwl-app-state';
const CURRENT_VERSION = 3;

export interface PersistentViewPreferences {
  currentView: ViewType;
  selectedDate: string;
  showIngredientPanel: boolean;
  showWarningPanel: boolean;
  showRecipePanel: boolean;
  showSchedulePanel: boolean;
  showPurchaseSuggestion: boolean;
  deliveryBoard: CustomerDeliveryBoardState;
}

export interface PersistentAppData {
  version: number;
  orders: Order[];
  recipes: Recipe[];
  ingredients: IngredientBatch[];
  warnings: Warning[];
  purchaseDecisions: PurchaseDecision[];
  viewPreferences: PersistentViewPreferences;
  savedAt: string;
}

export interface DefaultDataResult {
  orders: Order[];
  recipes: Recipe[];
  ingredients: IngredientBatch[];
  warnings: Warning[];
  purchaseDecisions: PurchaseDecision[];
  viewPreferences: PersistentViewPreferences;
}

type MigrationFn = (data: unknown) => PersistentAppData;

type StoredViewPreferences = Partial<
  Omit<PersistentViewPreferences, 'deliveryBoard'>
> & {
  deliveryBoard?: Partial<CustomerDeliveryBoardState>;
};

type StoredAppData = Partial<Omit<PersistentAppData, 'viewPreferences' | 'purchaseDecisions'>> & {
  viewPreferences?: StoredViewPreferences;
  purchaseDecisions?: PurchaseDecision[];
};

const defaultViewPreferences: PersistentViewPreferences = {
  currentView: 'kanban',
  selectedDate: new Date().toISOString().split('T')[0],
  showIngredientPanel: false,
  showWarningPanel: false,
  showRecipePanel: false,
  showSchedulePanel: false,
  showPurchaseSuggestion: false,
  deliveryBoard: {
    showCompletedOrders: false,
    sortBy: 'deliveryDate',
    filterRiskLevel: 'all',
    expandedCustomers: [],
  },
};

const normalizeViewPreferences = (
  viewPreferences?: StoredViewPreferences
): PersistentViewPreferences => ({
  ...defaultViewPreferences,
  ...viewPreferences,
  deliveryBoard: {
    ...defaultViewPreferences.deliveryBoard,
    ...viewPreferences?.deliveryBoard,
  },
});

const migrations: Record<number, MigrationFn> = {
  0: (data: unknown) => {
    console.log('[Storage] Running migration v0 -> v1');
    const d = data as StoredAppData;
    return {
      ...d,
      version: 1,
      viewPreferences: normalizeViewPreferences(d.viewPreferences),
      orders: d.orders || [],
      recipes: d.recipes || [],
      ingredients: d.ingredients || [],
      warnings: d.warnings || [],
      purchaseDecisions: d.purchaseDecisions || [],
      savedAt: d.savedAt || new Date().toISOString(),
    } as PersistentAppData;
  },
  1: (data: unknown) => {
    console.log('[Storage] Running migration v1 -> v2');
    const d = data as StoredAppData;
    return {
      ...d,
      version: 2,
      viewPreferences: normalizeViewPreferences(d.viewPreferences),
      orders: d.orders || [],
      recipes: d.recipes || [],
      ingredients: d.ingredients || [],
      warnings: d.warnings || [],
      purchaseDecisions: d.purchaseDecisions || [],
      savedAt: d.savedAt || new Date().toISOString(),
    } as PersistentAppData;
  },
  2: (data: unknown) => {
    console.log('[Storage] Running migration v2 -> v3');
    const d = data as StoredAppData;
    return {
      ...d,
      version: 3,
      viewPreferences: normalizeViewPreferences(d.viewPreferences),
      orders: d.orders || [],
      recipes: d.recipes || [],
      ingredients: d.ingredients || [],
      warnings: d.warnings || [],
      purchaseDecisions: d.purchaseDecisions || [],
      savedAt: d.savedAt || new Date().toISOString(),
    } as PersistentAppData;
  },
};

export const getDefaultData = (): DefaultDataResult => {
  const initialWarnings = calculateAllWarnings(mockOrders, mockIngredients, mockRecipes);
  return {
    orders: mockOrders,
    recipes: mockRecipes,
    ingredients: mockIngredients,
    warnings: initialWarnings,
    purchaseDecisions: [],
    viewPreferences: { ...defaultViewPreferences },
  };
};

export const saveToStorage = (data: Omit<PersistentAppData, 'version' | 'savedAt'>): void => {
  try {
    const persistentData: PersistentAppData = {
      ...data,
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentData));
    console.log('[Storage] Data saved successfully');
  } catch (error) {
    console.error('[Storage] Failed to save data:', error);
  }
};

export const loadFromStorage = (): DefaultDataResult | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log('[Storage] No saved data found, using defaults');
      return null;
    }

    let data: PersistentAppData = JSON.parse(raw);

    if (!data.version || data.version < CURRENT_VERSION) {
      console.log(`[Storage] Migrating data from v${data.version || 0} to v${CURRENT_VERSION}`);
      data = runMigrations(data);
    }

    if (data.version !== CURRENT_VERSION) {
      console.warn('[Storage] Migration failed, falling back to defaults');
      return null;
    }

    console.log('[Storage] Data loaded successfully, version:', data.version);

    const existingResolved = (data.warnings || []).filter((w: Warning) => w.isResolved);
    const recalculatedWarnings = calculateAllWarnings(data.orders, data.ingredients, data.recipes);
    const mergedWarnings = mergeWarningsWithResolvedState(recalculatedWarnings, existingResolved);

    console.log(`[Storage] Recalculated warnings: ${recalculatedWarnings.length} total, ${existingResolved.length} resolved states preserved`);
    console.log(`[Storage] Loaded ${data.purchaseDecisions?.length || 0} purchase decisions`);

    return {
      orders: data.orders,
      recipes: data.recipes,
      ingredients: data.ingredients,
      warnings: mergedWarnings,
      purchaseDecisions: data.purchaseDecisions || [],
      viewPreferences: normalizeViewPreferences(data.viewPreferences),
    };
  } catch (error) {
    console.error('[Storage] Failed to load data:', error);
    return null;
  }
};

const runMigrations = (data: PersistentAppData): PersistentAppData => {
  let migratedData: PersistentAppData = { ...data };
  const startVersion = migratedData.version || 0;

  for (let v = startVersion; v < CURRENT_VERSION; v++) {
    const migration = migrations[v];
    if (migration) {
      try {
        migratedData = migration(migratedData);
      } catch (error) {
        console.error(`[Storage] Migration to v${v + 1} failed:`, error);
        throw error;
      }
    }
  }

  return migratedData;
};

export const clearStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Storage] Data cleared successfully');
  } catch (error) {
    console.error('[Storage] Failed to clear data:', error);
  }
};

export const getStorageInfo = (): { hasData: boolean; version: number; savedAt?: string } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { hasData: false, version: 0 };
    }
    const data = JSON.parse(raw);
    return {
      hasData: true,
      version: data.version || 0,
      savedAt: data.savedAt,
    };
  } catch {
    return { hasData: false, version: 0 };
  }
};

export const migrateData = (): void => {
  const data = loadFromStorage();
  if (data) {
    saveToStorage(data);
  }
};

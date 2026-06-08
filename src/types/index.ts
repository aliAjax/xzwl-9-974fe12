export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  dryingDays: number;
  cellaringDays: number;
  craftNotes: string;
}

export interface IngredientBatch {
  id: string;
  name: string;
  batchNo: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  expiryDate: string;
  receiveDate: string;
  supplier: string;
  safetyStock: number;
}

export type StepType = 'kneading' | 'shaping' | 'drying' | 'cellaring' | 'packaging';
export type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';
export type OrderStatus = 'pending' | 'in_production' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
export type WarningType = 'drying' | 'inventory' | 'delivery' | 'ingredient';
export type WarningLevel = 'info' | 'warning' | 'critical';
export type ViewType = 'kanban' | 'calendar' | 'delivery';

export interface ProductionStep {
  id: string;
  orderId: string;
  stepType: StepType;
  stepName: string;
  status: StepStatus;
  startDate: string;
  endDate: string;
  durationDays: number;
  notes: string;
  assignee: string;
}

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  recipeId: string;
  quantity: number;
  unit: string;
  orderDate: string;
  deliveryDate: string;
  status: OrderStatus;
  priority: Priority;
  steps: ProductionStep[];
  currentStepIndex: number;
}

export interface Warning {
  id: string;
  type: WarningType;
  level: WarningLevel;
  message: string;
  relatedId: string;
  relatedType: 'order' | 'ingredient';
  createdAt: string;
  isResolved: boolean;
}

export interface Craftsman {
  id: string;
  name: string;
  avatar: string;
  skills: StepType[];
  status: 'available' | 'working' | 'rest';
}

export interface RecipeFormData {
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  dryingDays: number;
  cellaringDays: number;
  craftNotes: string;
}

export interface PurchaseSuggestionIngredient {
  ingredientId: string;
  name: string;
  currentStock: number;
  safetyStock: number;
  unit: string;
  expiryDate: string;
  daysToExpiry: number;
  pendingDemand: number;
  demandGap: number;
  safetyStockGap: number;
  gap: number;
  suggestedPurchase: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  relatedOrders: {
    orderId: string;
    orderNo: string;
    customerName: string;
    quantity: number;
    priority: Priority;
    deliveryDate: string;
    daysToDelivery: number;
  }[];
}

export interface AppState {
  orders: Order[];
  recipes: Recipe[];
  ingredients: IngredientBatch[];
  craftsmen: Craftsman[];
  warnings: Warning[];
  currentView: ViewType;
  selectedDate: string;
  selectedOrderId: string | null;
  showIngredientPanel: boolean;
  showWarningPanel: boolean;
  showCreateOrderModal: boolean;
  showRecipePanel: boolean;
  showRecipeModal: boolean;
  showSchedulePanel: boolean;
  showPrintPreview: boolean;
  showPurchaseSuggestion: boolean;
  showScheduleAdjustModal: boolean;
  scheduleAdjustOrderId: string | null;
  printOrderId: string | null;
  editingRecipeId: string | null;
  copyingRecipeId: string | null;
  purchaseSuggestions: PurchaseSuggestionIngredient[];
  deliveryBoard: CustomerDeliveryBoardState;
}

export interface CreateOrderData {
  customerName: string;
  recipeId: string;
  quantity: number;
  unit: string;
  deliveryDate: string;
  priority: Priority;
}

export interface StepAdjustPreview {
  stepId: string;
  originalStartDate: string;
  originalEndDate: string;
  originalDurationDays: number;
  newStartDate: string;
  newEndDate: string;
  newDurationDays: number;
  isChanged: boolean;
  isAffected: boolean;
  shiftDays: number;
}

export interface WarningDiff {
  added: Warning[];
  removed: Warning[];
  unchanged: Warning[];
}

export interface DeliveryImpactSummary {
  newCompletionDate: string;
  originalCompletionDate: string;
  deliveryDate: string;
  daysRelativeToDelivery: number;
  isAheadOfDelivery: boolean;
  isOnSchedule: boolean;
  affectedSteps: {
    stepId: string;
    stepName: string;
    shiftDays: number;
    isChanged: boolean;
  }[];
}

export interface ScheduleAdjustPreview {
  orderId: string;
  steps: StepAdjustPreview[];
  newWarnings: Warning[];
  originalWarnings: Warning[];
  totalDelayDays: number;
  warningDiff: WarningDiff;
  deliveryImpact: DeliveryImpactSummary;
}

export interface StepUpdateData {
  startDate?: string;
  durationDays?: number;
}

export interface AppActions {
  setCurrentView: (view: ViewType) => void;
  setSelectedDate: (date: string) => void;
  setSelectedOrderId: (id: string | null) => void;
  setShowIngredientPanel: (show: boolean) => void;
  setShowWarningPanel: (show: boolean) => void;
  setShowCreateOrderModal: (show: boolean) => void;
  setShowRecipePanel: (show: boolean) => void;
  setShowRecipeModal: (show: boolean) => void;
  setShowSchedulePanel: (show: boolean) => void;
  setShowPrintPreview: (show: boolean) => void;
  setShowPurchaseSuggestion: (show: boolean) => void;
  setPrintOrderId: (id: string | null) => void;
  setEditingRecipeId: (id: string | null) => void;
  setCopyingRecipeId: (id: string | null) => void;
  setShowScheduleAdjustModal: (show: boolean) => void;
  setScheduleAdjustOrderId: (id: string | null) => void;
  setShowCompletedOrders: (show: boolean) => void;
  setSortBy: (sortBy: CustomerDeliveryBoardState['sortBy']) => void;
  setFilterRiskLevel: (level: RiskLevel | 'all') => void;
  toggleCustomerExpand: (customerName: string) => void;
  getCustomerOrderSummaries: () => CustomerOrderSummary[];
  getCustomerOrderSummary: (customerName: string) => CustomerOrderSummary | undefined;
  createRecipe: (data: RecipeFormData) => Recipe;
  updateRecipe: (id: string, data: RecipeFormData) => Recipe;
  deleteRecipe: (id: string) => void;
  createOrder: (data: CreateOrderData) => Order;
  updateStepStatus: (orderId: string, stepId: string, status: StepStatus) => void;
  assignStepToCraftsman: (orderId: string, stepId: string, craftsmanName: string) => void;
  moveOrderToStep: (orderId: string, stepType: StepType) => void;
  updateProductionStep: (orderId: string, stepId: string, updates: StepUpdateData) => void;
  completeOrder: (orderId: string) => void;
  resolveWarning: (warningId: string) => void;
  recalculateWarnings: () => void;
  recalculatePurchaseSuggestions: () => void;
  getOrderWarnings: (orderId: string) => Warning[];
  getRecipeById: (recipeId: string) => Recipe | undefined;
  getOrdersByStep: (stepType: StepType) => Order[];
  getOrdersByDate: (date: string) => Order[];
  getCraftsmanTasks: (craftsmanId: string) => { order: Order; step: ProductionStep }[];
  getCraftsmanWorkload: (craftsmanId: string, options?: WorkloadAnalysisOptions) => CraftsmanWorkload;
  getAllCraftsmenWorkload: (options?: WorkloadAnalysisOptions) => CraftsmanWorkload[];
  getSortedCraftsmenForAssignment: (requiredSkill: StepType) => CraftsmanWorkload[];
  resetToDefault: () => void;
}

export interface AppState {
  orders: Order[];
  recipes: Recipe[];
  ingredients: IngredientBatch[];
  craftsmen: Craftsman[];
  warnings: Warning[];
  currentView: ViewType;
  selectedDate: string;
  selectedOrderId: string | null;
  showIngredientPanel: boolean;
  showWarningPanel: boolean;
  showCreateOrderModal: boolean;
  showRecipePanel: boolean;
  showRecipeModal: boolean;
  showSchedulePanel: boolean;
  showPrintPreview: boolean;
  showPurchaseSuggestion: boolean;
  showScheduleAdjustModal: boolean;
  scheduleAdjustOrderId: string | null;
  printOrderId: string | null;
  editingRecipeId: string | null;
  copyingRecipeId: string | null;
  purchaseSuggestions: PurchaseSuggestionIngredient[];
}

export const STEP_CONFIG: Record<StepType, { name: string; icon: string; color: string }> = {
  kneading: { name: '揉料', icon: 'Hand', color: '#8D6E63' },
  shaping: { name: '成型', icon: 'Scroll', color: '#6D4C41' },
  drying: { name: '阴干', icon: 'Cloud', color: '#5D4037' },
  cellaring: { name: '窖藏', icon: 'Archive', color: '#4E342E' },
  packaging: { name: '包装', icon: 'Package', color: '#3E2723' },
};

export const STEP_ORDER: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface CustomerOrderSummary {
  customerName: string;
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  completedOrders: number;
  overdueOrders: number;
  highPriorityOrders: number;
  earliestDeliveryDate: string;
  latestDeliveryDate: string;
  overallProgress: number;
  riskLevel: RiskLevel;
  orders: Order[];
  orderIds: string[];
}

export interface CustomerDeliveryBoardState {
  showCompletedOrders: boolean;
  sortBy: 'deliveryDate' | 'riskLevel' | 'priority' | 'progress';
  filterRiskLevel: RiskLevel | 'all';
  expandedCustomers: string[];
}

export interface CustomerDeliveryBoardActions {
  setShowCompletedOrders: (show: boolean) => void;
  setSortBy: (sortBy: CustomerDeliveryBoardState['sortBy']) => void;
  setFilterRiskLevel: (level: RiskLevel | 'all') => void;
  toggleCustomerExpand: (customerName: string) => void;
  getCustomerOrderSummaries: () => CustomerOrderSummary[];
  getCustomerOrderSummary: (customerName: string) => CustomerOrderSummary | undefined;
}

export interface CraftsmanWorkload {
  craftsmanId: string;
  craftsmanName: string;
  taskCount: number;
  totalDurationDays: number;
  stepTypes: StepType[];
  tasks: { order: Order; step: ProductionStep }[];
  workloadLevel: 'low' | 'medium' | 'high';
  isResting: boolean;
  hasMatchingSkill: boolean;
}

export interface WorkloadAnalysisOptions {
  daysAhead?: number;
  requiredSkill?: StepType;
}

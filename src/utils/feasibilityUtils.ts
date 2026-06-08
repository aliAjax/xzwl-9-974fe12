import {
  Order,
  Recipe,
  IngredientBatch,
  Craftsman,
  CreateOrderData,
  FeasibilityCheckResult,
  FeasibilityIssue,
  FeasibilityStatus,
  StepType,
  STEP_ORDER,
  STEP_CONFIG,
} from '../types';
import {
  getToday,
  addDaysToDate,
  daysBetween,
  isDateBefore,
  isDateAfter,
  formatDateChinese,
} from './dateUtils';
import { analyzeAllCraftsmenWorkload } from './workloadUtils';

const generateIssueId = (): string =>
  `feas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getStepDuration = (stepType: StepType, recipe: Recipe): number => {
  const durations: Record<StepType, number> = {
    kneading: 2,
    shaping: 3,
    drying: recipe.dryingDays,
    cellaring: recipe.cellaringDays,
    packaging: 2,
  };
  return durations[stepType];
};

const getTotalProductionDays = (recipe: Recipe): number => {
  return STEP_ORDER.reduce((sum, step) => sum + getStepDuration(step, recipe), 0);
};

const calculateIngredientAvailability = (
  recipe: Recipe,
  quantity: number,
  ingredients: IngredientBatch[]
): FeasibilityCheckResult['ingredients'] => {
  const today = getToday();
  const details: FeasibilityCheckResult['ingredients']['details'] = [];
  let sufficient = true;

  const ingredientMap = new Map<string, IngredientBatch[]>();
  ingredients.forEach((ing) => {
    const existing = ingredientMap.get(ing.name) || [];
    ingredientMap.set(ing.name, [...existing, ing]);
  });

  recipe.ingredients.forEach((recipeIng) => {
    const batches = ingredientMap.get(recipeIng.name) || [];
    const required = (recipeIng.quantity / 100) * quantity;

    let totalAvailable = 0;
    let earliestExpiry = '';
    let minDaysToExpiry = Infinity;

    batches.forEach((batch) => {
      const daysToExpiry = daysBetween(today, batch.expiryDate);
      if (daysToExpiry > 0) {
        if (daysToExpiry <= 7) {
          totalAvailable += batch.quantity * 0.3;
        } else if (daysToExpiry <= 30) {
          totalAvailable += batch.quantity * 0.7;
        } else {
          totalAvailable += batch.quantity;
        }
      }
      if (daysToExpiry < minDaysToExpiry) {
        minDaysToExpiry = daysToExpiry;
        earliestExpiry = batch.expiryDate;
      }
    });

    const gap = required - totalAvailable;
    const hasExpiryRisk = minDaysToExpiry <= 30 && minDaysToExpiry > 0;

    if (gap > 0) {
      sufficient = false;
    }

    details.push({
      ingredientName: recipeIng.name,
      ingredientId: recipeIng.ingredientId,
      required: Number(required.toFixed(2)),
      available: Number(totalAvailable.toFixed(2)),
      unit: recipeIng.unit,
      gap: Number(gap.toFixed(2)),
      earliestExpiry,
      daysToExpiry: minDaysToExpiry === Infinity ? 999 : minDaysToExpiry,
      hasExpiryRisk,
    });
  });

  return { sufficient, details };
};

const calculateWorkload = (
  recipe: Recipe,
  craftsmen: Craftsman[],
  existingOrders: Order[],
  deliveryDate: string
): FeasibilityCheckResult['workload'] => {
  const today = getToday();
  const analysisDays = daysBetween(today, deliveryDate) + 30;
  const workloads = analyzeAllCraftsmenWorkload(craftsmen, existingOrders, {
    daysAhead: Math.max(analysisDays, 30),
  });

  const requiredSkills = new Set<StepType>();
  STEP_ORDER.forEach((step) => requiredSkills.add(step));

  const craftsmanLoad: FeasibilityCheckResult['workload']['craftsmanLoad'] = workloads.map(
    (wl) => {
      const hasRequiredSkill = wl.stepTypes.some((s) => requiredSkills.has(s));
      const availableDays = wl.isResting
        ? 0
        : Math.max(0, analysisDays - wl.totalDurationDays);

      return {
        craftsmanId: wl.craftsmanId,
        craftsmanName: wl.craftsmanName,
        skills: wl.stepTypes,
        loadLevel: wl.workloadLevel,
        availableDays,
        totalTasks: wl.taskCount,
      };
    }
  );

  const bottleneckSteps: string[] = [];
  STEP_ORDER.forEach((stepType) => {
    const capableCraftsmen = craftsmanLoad.filter((c) =>
      craftsmen
        .find((cr) => cr.id === c.craftsmanId)
        ?.skills.includes(stepType)
    );
    const availableCraftsmen = capableCraftsmen.filter(
      (c) => c.loadLevel !== 'high' && !craftsmen.find((cr) => cr.id === c.craftsmanId)?.status.includes('rest')
    );

    if (availableCraftsmen.length === 0) {
      bottleneckSteps.push(STEP_CONFIG[stepType].name);
    }
  });

  return { craftsmanLoad, bottleneckSteps };
};

const generateTimelineIssues = (
  timeline: FeasibilityCheckResult['timeline']
): FeasibilityIssue[] => {
  const issues: FeasibilityIssue[] = [];

  if (timeline.isStartDatePast) {
    issues.push({
      id: generateIssueId(),
      category: 'timeline',
      level: 'critical',
      message: `开工日期已逾期 ${Math.abs(timeline.daysToStart)} 天`,
      detail: `按交付日期 ${formatDateChinese(timeline.deliveryDate)} 倒推，需在 ${formatDateChinese(timeline.estimatedStartDate)} 前开工，但该日期已过去 ${Math.abs(timeline.daysToStart)} 天`,
      suggestion: '建议延后交付日期，或安排紧急生产',
    });
  } else if (timeline.daysToStart <= 3) {
    issues.push({
      id: generateIssueId(),
      category: 'timeline',
      level: 'warning',
      message: `开工时间紧迫，仅剩 ${timeline.daysToStart} 天准备期`,
      detail: `预计开工日期为 ${formatDateChinese(timeline.estimatedStartDate)}，距离今天只有 ${timeline.daysToStart} 天`,
      suggestion: '请尽快确认原料和工匠安排',
    });
  }

  if (timeline.bufferDays < 0) {
    issues.push({
      id: generateIssueId(),
      category: 'timeline',
      level: 'critical',
      message: `生产周期不足，预计延误 ${Math.abs(timeline.bufferDays)} 天`,
      detail: `生产需要 ${timeline.productionDays} 天，但从今天到交付日期只有 ${timeline.productionDays + timeline.bufferDays} 天`,
      suggestion: '请延后交付日期，或考虑简化工艺',
    });
  } else if (timeline.bufferDays <= 5) {
    issues.push({
      id: generateIssueId(),
      category: 'timeline',
      level: 'warning',
      message: `缓冲时间不足，仅有 ${timeline.bufferDays} 天余量`,
      detail: `生产周期 ${timeline.productionDays} 天，交付日期前仅剩 ${timeline.bufferDays} 天缓冲`,
      suggestion: '建议增加缓冲时间，以防生产中出现意外情况',
    });
  }

  return issues;
};

const generateIngredientIssues = (
  ingredients: FeasibilityCheckResult['ingredients']
): FeasibilityIssue[] => {
  const issues: FeasibilityIssue[] = [];

  ingredients.details.forEach((detail) => {
    if (detail.gap > 0) {
      issues.push({
        id: generateIssueId(),
        category: 'ingredient',
        level: detail.gap > detail.required * 0.5 ? 'critical' : 'warning',
        message: `原料 ${detail.ingredientName} 库存不足`,
        detail: `需要 ${detail.required}${detail.unit}，但可用库存仅 ${detail.available}${detail.unit}，缺口 ${detail.gap}${detail.unit}`,
        suggestion: '请立即安排采购，或考虑调整订单数量',
      });
    }

    if (detail.hasExpiryRisk) {
      if (detail.daysToExpiry <= 7) {
        issues.push({
          id: generateIssueId(),
          category: 'expiry',
          level: 'critical',
          message: `原料 ${detail.ingredientName} 即将过期`,
          detail: `最早批次将于 ${formatDateChinese(detail.earliestExpiry)} 过期，仅剩 ${detail.daysToExpiry} 天`,
          suggestion: '请优先使用临期原料，或及时补充新货',
        });
      } else if (detail.daysToExpiry <= 30) {
        issues.push({
          id: generateIssueId(),
          category: 'expiry',
          level: 'warning',
          message: `原料 ${detail.ingredientName} 临期提醒`,
          detail: `最早批次将于 ${formatDateChinese(detail.earliestExpiry)} 过期，还有 ${detail.daysToExpiry} 天`,
          suggestion: '建议合理安排生产计划，确保在有效期内使用',
        });
      }
    }
  });

  return issues;
};

const generateWorkloadIssues = (
  workload: FeasibilityCheckResult['workload'],
  craftsmen: Craftsman[]
): FeasibilityIssue[] => {
  const issues: FeasibilityIssue[] = [];

  if (workload.bottleneckSteps.length > 0) {
    issues.push({
      id: generateIssueId(),
      category: 'workload',
      level: 'warning',
      message: `工序人力紧张：${workload.bottleneckSteps.join('、')}`,
      detail: `以下工序暂无空闲工匠：${workload.bottleneckSteps.join('、')}，可能影响生产进度`,
      suggestion: '可考虑调整排班，或临时增加人手',
    });
  }

  const highLoadCraftsmen = workload.craftsmanLoad.filter((c) => c.loadLevel === 'high');
  if (highLoadCraftsmen.length > 0) {
    const names = highLoadCraftsmen.map((c) => c.craftsmanName).join('、');
    issues.push({
      id: generateIssueId(),
      category: 'workload',
      level: highLoadCraftsmen.length >= 3 ? 'critical' : 'warning',
      message: `${highLoadCraftsmen.length} 位工匠处于高负载状态`,
      detail: `${names} 等工匠当前工作安排已饱和，新订单可能需要排队`,
      suggestion: '建议合理分配任务，或考虑延长交付周期',
    });
  }

  const restingCraftsmen = craftsmen.filter((c) => c.status === 'rest');
  if (restingCraftsmen.length > 0) {
    const names = restingCraftsmen.map((c) => c.name).join('、');
    issues.push({
      id: generateIssueId(),
      category: 'workload',
      level: 'info',
      message: `${restingCraftsmen.length} 位工匠正在休假`,
      detail: `${names} 当前处于休假状态，暂不可安排任务`,
    });
  }

  return issues;
};

const calculateOverallScore = (issues: FeasibilityIssue[]): number => {
  let score = 100;
  issues.forEach((issue) => {
    if (issue.level === 'critical') score -= 25;
    else if (issue.level === 'warning') score -= 10;
    else if (issue.level === 'info') score -= 2;
  });
  return Math.max(0, score);
};

const determineStatus = (score: number, issues: FeasibilityIssue[]): FeasibilityStatus => {
  const hasCritical = issues.some((i) => i.level === 'critical');
  const hasWarning = issues.some((i) => i.level === 'warning');

  if (hasCritical || score < 50) return 'not_feasible';
  if (hasWarning || score < 80) return 'risky';
  return 'feasible';
};

const generateSummary = (
  status: FeasibilityStatus,
  issues: FeasibilityIssue[],
  timeline: FeasibilityCheckResult['timeline']
): string => {
  const issueCount = issues.length;
  const criticalCount = issues.filter((i) => i.level === 'critical').length;
  const warningCount = issues.filter((i) => i.level === 'warning').length;

  if (status === 'feasible') {
    return `可按期交付。生产周期约 ${timeline.productionDays} 天，预计 ${formatDateChinese(timeline.estimatedStartDate)} 开工，${formatDateChinese(timeline.estimatedCompletionDate)} 完工，留有 ${timeline.bufferDays} 天缓冲。`;
  } else if (status === 'risky') {
    return `存在一定风险（${warningCount} 个警告）。${
      timeline.bufferDays >= 0
        ? `缓冲时间 ${timeline.bufferDays} 天，`
        : `已无缓冲时间，`
    }请关注风险提示并采取相应措施。`;
  } else {
    return `难以按期交付（${criticalCount} 个严重问题）。建议调整交付日期或订单数量，否则很可能延误。`;
  }
};

export const checkDeliveryFeasibility = (
  orderData: CreateOrderData,
  recipes: Recipe[],
  ingredients: IngredientBatch[],
  craftsmen: Craftsman[],
  existingOrders: Order[]
): FeasibilityCheckResult => {
  const recipe = recipes.find((r) => r.id === orderData.recipeId);
  if (!recipe) {
    return {
      status: 'not_feasible',
      overallScore: 0,
      issues: [
        {
          id: generateIssueId(),
          category: 'timeline',
          level: 'critical',
          message: '未找到对应的香方',
          suggestion: '请先创建香方再创建订单',
        },
      ],
      timeline: {
        estimatedStartDate: '',
        estimatedCompletionDate: '',
        deliveryDate: orderData.deliveryDate,
        productionDays: 0,
        daysToStart: 0,
        bufferDays: 0,
        isStartDatePast: false,
      },
      workload: { craftsmanLoad: [], bottleneckSteps: [] },
      ingredients: { sufficient: false, details: [] },
      summary: '香方不存在，无法评估交期可行性',
    };
  }

  const today = getToday();
  const productionDays = getTotalProductionDays(recipe);
  const estimatedCompletionDate = addDaysToDate(today, productionDays);
  const estimatedStartDate = addDaysToDate(orderData.deliveryDate, -productionDays);
  const daysToStart = daysBetween(today, estimatedStartDate);
  const bufferDays = daysBetween(estimatedCompletionDate, orderData.deliveryDate);
  const isStartDatePast = isDateBefore(estimatedStartDate, today);

  const timeline: FeasibilityCheckResult['timeline'] = {
    estimatedStartDate,
    estimatedCompletionDate,
    deliveryDate: orderData.deliveryDate,
    productionDays,
    daysToStart,
    bufferDays,
    isStartDatePast,
  };

  const workload = calculateWorkload(recipe, craftsmen, existingOrders, orderData.deliveryDate);
  const ingredientResult = calculateIngredientAvailability(recipe, orderData.quantity, ingredients);

  const timelineIssues = generateTimelineIssues(timeline);
  const ingredientIssues = generateIngredientIssues(ingredientResult);
  const workloadIssues = generateWorkloadIssues(workload, craftsmen);

  const issues = [...timelineIssues, ...ingredientIssues, ...workloadIssues];
  const overallScore = calculateOverallScore(issues);
  const status = determineStatus(overallScore, issues);
  const summary = generateSummary(status, issues, timeline);

  return {
    status,
    overallScore,
    issues,
    timeline,
    workload,
    ingredients: ingredientResult,
    summary,
  };
};

export const getFeasibilityStatusColor = (status: FeasibilityStatus): string => {
  switch (status) {
    case 'feasible':
      return '#10b981';
    case 'risky':
      return '#f59e0b';
    case 'not_feasible':
      return '#ef4444';
  }
};

export const getFeasibilityStatusLabel = (status: FeasibilityStatus): string => {
  switch (status) {
    case 'feasible':
      return '可按期交付';
    case 'risky':
      return '存在风险';
    case 'not_feasible':
      return '难以交付';
  }
};

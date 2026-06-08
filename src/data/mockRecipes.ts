import { type Recipe } from '../types';

export const mockRecipes: Recipe[] = [
  {
    id: 'recipe-001',
    name: '沉水香',
    description: '经典古法沉水香，香气醇厚持久，采用上等沉香与檀香调配',
    ingredients: [
      { ingredientId: 'ing-001', name: '沉香粉', quantity: 50, unit: 'g' },
      { ingredientId: 'ing-002', name: '老山檀粉', quantity: 30, unit: 'g' },
      { ingredientId: 'ing-003', name: '安息香', quantity: 10, unit: 'g' },
      { ingredientId: 'ing-004', name: '粘粉', quantity: 15, unit: 'g' },
    ],
    dryingDays: 15,
    cellaringDays: 30,
    craftNotes: '揉料需顺时针搅拌30分钟以上，阴干需在通风避光处，避免直射阳光',
  },
  {
    id: 'recipe-002',
    name: '柏子香',
    description: '清新淡雅的柏子香，以侧柏子为主料，适合日常品香',
    ingredients: [
      { ingredientId: 'ing-005', name: '侧柏子', quantity: 60, unit: 'g' },
      { ingredientId: 'ing-006', name: '甘松', quantity: 20, unit: 'g' },
      { ingredientId: 'ing-007', name: '零陵香', quantity: 15, unit: 'g' },
      { ingredientId: 'ing-004', name: '粘粉', quantity: 12, unit: 'g' },
    ],
    dryingDays: 10,
    cellaringDays: 20,
    craftNotes: '柏子需先炒制微黄，研磨后过120目筛，阴干时注意防潮',
  },
  {
    id: 'recipe-003',
    name: '鹅梨帐中香',
    description: '传世名香，梨香与檀香交融，温婉宜人，相传为南唐李后主所创',
    ingredients: [
      { ingredientId: 'ing-008', name: '鹅梨汁', quantity: 100, unit: 'ml' },
      { ingredientId: 'ing-002', name: '老山檀粉', quantity: 40, unit: 'g' },
      { ingredientId: 'ing-009', name: '沉香', quantity: 20, unit: 'g' },
      { ingredientId: 'ing-004', name: '粘粉', quantity: 18, unit: 'g' },
    ],
    dryingDays: 20,
    cellaringDays: 45,
    craftNotes: '鹅梨需选皮薄肉细者，蒸后取汁，与香粉充分融合后再成型',
  },
  {
    id: 'recipe-004',
    name: '隔火熏香',
    description: '专为隔火熏香设计的香饼，香气层次丰富，适合茶道品鉴',
    ingredients: [
      { ingredientId: 'ing-001', name: '沉香粉', quantity: 40, unit: 'g' },
      { ingredientId: 'ing-010', name: '龙脑香', quantity: 5, unit: 'g' },
      { ingredientId: 'ing-011', name: '麝香', quantity: 2, unit: 'g' },
      { ingredientId: 'ing-004', name: '粘粉', quantity: 10, unit: 'g' },
    ],
    dryingDays: 12,
    cellaringDays: 60,
    craftNotes: '龙脑香需单独研磨后混合，窖藏时间越长香气越醇和',
  },
  {
    id: 'recipe-005',
    name: '艾草香',
    description: '天然艾草制作，驱虫避秽，适合端午或日常净化空气',
    ingredients: [
      { ingredientId: 'ing-012', name: '陈艾绒', quantity: 70, unit: 'g' },
      { ingredientId: 'ing-013', name: '苍术', quantity: 15, unit: 'g' },
      { ingredientId: 'ing-014', name: '白芷', quantity: 10, unit: 'g' },
      { ingredientId: 'ing-004', name: '粘粉', quantity: 12, unit: 'g' },
    ],
    dryingDays: 7,
    cellaringDays: 10,
    craftNotes: '艾草需选用三年陈艾，阴干后香气更温和，无燥气',
  },
];

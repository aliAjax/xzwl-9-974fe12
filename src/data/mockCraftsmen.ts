import { type Craftsman } from '../types';

export const mockCraftsmen: Craftsman[] = [
  {
    id: 'craftsman-001',
    name: '李师傅',
    avatar: '李',
    skills: ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'],
    status: 'working',
  },
  {
    id: 'craftsman-002',
    name: '王师傅',
    avatar: '王',
    skills: ['kneading', 'shaping'],
    status: 'available',
  },
  {
    id: 'craftsman-003',
    name: '张师傅',
    avatar: '张',
    skills: ['drying', 'cellaring'],
    status: 'working',
  },
  {
    id: 'craftsman-004',
    name: '刘师傅',
    avatar: '刘',
    skills: ['packaging', 'shaping'],
    status: 'available',
  },
  {
    id: 'craftsman-005',
    name: '陈师傅',
    avatar: '陈',
    skills: ['kneading', 'drying', 'cellaring'],
    status: 'rest',
  },
  {
    id: 'craftsman-006',
    name: '赵师傅',
    avatar: '赵',
    skills: ['shaping', 'packaging'],
    status: 'available',
  },
];

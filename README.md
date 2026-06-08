# 香道生产管理系统 (xzwl-9)

基于 Vite + React + TypeScript 的香道生产管理前端应用，提供订单看板、生产调度、物料管理等核心功能。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 6
- **状态管理**: Zustand
- **样式**: Tailwind CSS 3
- **路由**: React Router v7
- **测试框架**: Vitest + React Testing Library
- **代码规范**: ESLint + typescript-eslint
- **日期处理**: date-fns
- **图标**: Lucide React

## 项目结构

```
src/
├── components/          # 组件库
│   ├── calendar/       # 日历组件
│   ├── common/         # 通用组件 (Badge, ProgressBar)
│   ├── delivery/       # 配送看板
│   ├── kanban/         # 订单看板
│   ├── layout/         # 布局组件
│   ├── modals/         # 模态框
│   └── panels/         # 功能面板
├── data/               # Mock 数据
├── hooks/              # 自定义 Hooks
├── lib/                # 工具库
├── pages/              # 页面组件
├── store/              # Zustand 状态管理
├── test/               # 测试配置与辅助函数
├── types/              # TypeScript 类型定义
└── utils/              # 工具函数 (含单元测试)
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173 查看应用。

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

## 质量门禁

项目配置了完整的质量检查流程，开发者可通过一条命令验证项目是否可发布：

```bash
npm run verify
```

该命令将依次执行以下检查，任何一步失败都会终止并报错：

| 步骤 | 命令 | 说明 | 失败处理 |
|------|------|------|----------|
| 1 | `typecheck` | TypeScript 类型检查 | 修复类型错误，参考 `tsconfig.json` |
| 2 | `lint` | ESLint 代码规范检查 | 运行 `npm run lint:fix` 自动修复，或手动修复 |
| 3 | `test` | 单元测试 (Vitest) | 修复失败的测试用例 |
| 4 | `build` | 生产构建 | 修复构建错误 |

### 单个检查命令

```bash
# 类型检查
npm run typecheck

# 代码规范检查
npm run lint

# 自动修复 lint 问题
npm run lint:fix

# 运行单元测试
npm run test

# 监听模式运行测试
npm run test:watch

# 测试覆盖率报告
npm run test:coverage

# 可视化测试界面
npm run test:ui
```

## 测试说明

### 测试框架

- **Vitest**: 作为测试运行器，兼容 Jest API
- **React Testing Library**: React 组件测试
- **jsdom**: 浏览器环境模拟
- **@testing-library/jest-dom**: DOM 断言扩展

### 测试文件位置

测试文件与源代码放在同一目录，命名为 `*.test.ts` 或 `*.test.tsx`：

```
src/utils/
├── deliveryUtils.ts
└── deliveryUtils.test.ts    # 单元测试
```

### 测试覆盖率

运行 `npm run test:coverage` 生成覆盖率报告，输出到 `coverage/` 目录，包含：

- 文本摘要 (控制台输出)
- HTML 报告 (`coverage/html/index.html`)
- JSON 报告 (`coverage/coverage.json`)

## 代码规范

### TypeScript 严格模式

项目启用了完整的 TypeScript 严格模式，包括：

- `strict: true` - 启用所有严格类型检查
- `noUnusedLocals: true` - 禁止未使用的局部变量
- `noUnusedParameters: true` - 禁止未使用的函数参数
- `noImplicitReturns: true` - 禁止函数隐式返回 undefined
- `forceConsistentCasingInFileNames: true` - 强制文件名大小写一致

### ESLint 规则

主要规则配置：

- 禁止使用 `var`，推荐使用 `const`
- 禁止悬空 Promise (`no-floating-promises`)
- 禁止 Promise 误用 (`no-misused-promises`)
- 未使用变量以 `_` 开头可豁免
- 仅允许 `console.warn`、`console.error`、`console.info`

测试文件有特殊规则豁免：

- 允许非空断言 (`!`)
- 允许 `any` 类型

## 路径别名

配置了 `@/*` 路径别名，指向 `src/*` 目录：

```typescript
// 不推荐
import { useAppStore } from '../../store/useAppStore';

// 推荐
import { useAppStore } from '@/store/useAppStore';
```

## 核心功能模块

### 1. 订单看板 (Kanban)

按状态展示订单，支持拖拽调整，查看订单详情。

### 2. 生产调度 (Schedule)

甘特图展示生产工序，支持调整工序时间，自动计算交期影响。

### 3. 物料管理 (Ingredient)

原料库存管理，临期预警，采购建议。

### 4. 配送看板 (Delivery)

按客户汇总订单，展示交付承诺和风险预警。

### 5. 配方管理 (Recipe)

香方配方维护，工序模板配置。

## 常见问题

### Q: `npm run verify` 在类型检查阶段失败

**A**: 检查控制台输出的错误信息，通常是类型不匹配或缺少类型定义。可运行 `npm run typecheck` 单独查看详细错误。

### Q: ESLint 报错 `'xxx' is assigned a value but never used`

**A**: 如果变量确实需要保留但暂未使用，可命名为 `_xxx` 开头以豁免检查；否则删除未使用的变量。

### Q: 测试失败但找不到原因

**A**: 运行 `npm run test:watch` 进入监听模式，可单独运行失败的测试用例，并查看详细的断言错误信息。

### Q: 构建失败提示 `Failed to parse source map`

**A**: 通常是依赖包的 source map 问题，不影响实际构建产物。可忽略或在 `vite.config.ts` 中调整 `build.sourcemap` 配置。

## 开发规范

1. 提交代码前必须通过 `npm run verify` 检查
2. 新增工具函数必须配套单元测试
3. 组件优先使用函数组件 + Hooks
4. 状态管理优先使用 Zustand store
5. 避免使用 `any` 类型，如有必要使用 `unknown` 替代

## License

Private

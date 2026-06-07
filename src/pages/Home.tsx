import React from 'react';
import { Package, Plus } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Header } from '../components/layout/Header';
import { StatsCards } from '../components/layout/StatsCards';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import OrderDetailModal from '../components/modals/OrderDetailModal';
import CreateOrderModal from '../components/modals/CreateOrderModal';
import { WarningPanel } from '../components/panels/WarningPanel';
import { IngredientPanel } from '../components/panels/IngredientPanel';

const Home: React.FC = () => {
  const {
    currentView,
    selectedOrderId,
    showWarningPanel,
    showIngredientPanel,
    showCreateOrderModal,
    setShowWarningPanel,
    setShowIngredientPanel,
    setShowCreateOrderModal,
    ingredients,
  } = useAppStore();

  const lowStockIngredients = ingredients.filter(
    (ing) => ing.quantity / ing.safetyStock < 0.5
  ).length;

  return (
    <div className="min-h-screen bg-incense-50">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold font-song text-incense-800">
              生产工作台
            </h1>
            <p className="text-incense-500 text-sm mt-1">
              管理订单生产进度，追踪香方制作流程
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateOrderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-incense-700 text-white rounded-lg hover:bg-incense-800 transition-colors shadow-sm"
            >
              <Plus size={18} />
              <span>创建订单</span>
            </button>
            <button
              onClick={() => setShowIngredientPanel(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-incense-200 rounded-lg hover:bg-incense-50 transition-colors shadow-sm"
            >
              <Package size={18} className="text-incense-600" />
              <span className="text-incense-700">原料库存</span>
              {lowStockIngredients > 0 && (
                <span className="bg-sandal-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {lowStockIngredients}
                </span>
              )}
            </button>
          </div>
        </div>

        <StatsCards />

        {currentView === 'kanban' ? (
          <KanbanBoard />
        ) : (
          <CalendarGrid />
        )}
      </main>

      {selectedOrderId && <OrderDetailModal />}

      {showCreateOrderModal && <CreateOrderModal />}

      {showWarningPanel && (
        <WarningPanel onClose={() => setShowWarningPanel(false)} />
      )}

      {showIngredientPanel && (
        <IngredientPanel onClose={() => setShowIngredientPanel(false)} />
      )}
    </div>
  );
};

export default Home;

import React from 'react';
import { X, BookOpen, Plus, Edit2, Trash2, Clock, Leaf, Archive } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Recipe } from '../../types';

interface RecipePanelProps {
  onClose: () => void;
}

export const RecipePanel: React.FC<RecipePanelProps> = ({ onClose }) => {
  const {
    recipes,
    orders,
    setShowRecipeModal,
    setEditingRecipeId,
    deleteRecipe,
  } = useAppStore();

  const getRecipeUsageCount = (recipeId: string): number => {
    return orders.filter((o) => o.recipeId === recipeId).length;
  };

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setShowRecipeModal(true);
  };

  const handleCreate = () => {
    setEditingRecipeId(null);
    setShowRecipeModal(true);
  };

  const handleDelete = (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const usageCount = getRecipeUsageCount(recipeId);
    if (usageCount > 0) {
      alert(`该香方已被 ${usageCount} 个订单使用，无法删除`);
      return;
    }
    if (confirm('确定要删除这个香方吗？')) {
      deleteRecipe(recipeId);
    }
  };

  const getTotalProductionDays = (recipe: Recipe): number => {
    return 2 + 3 + recipe.dryingDays + recipe.cellaringDays + 2;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-incense-50 h-full shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-2">
            <BookOpen className="text-incense-600" size={24} />
            <h2 className="text-xl font-bold font-song text-incense-800">香方管理</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              className="flex items-center gap-1 px-3 py-1.5 bg-incense-600 text-white rounded-lg hover:bg-incense-700 transition-colors text-sm"
            >
              <Plus size={16} />
              新建香方
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-incense-400">
              <BookOpen size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">暂无香方</p>
              <p className="text-sm mt-1">点击上方按钮创建第一个香方</p>
            </div>
          ) : (
            recipes.map((recipe) => {
              const usageCount = getRecipeUsageCount(recipe.id);
              const totalDays = getTotalProductionDays(recipe);

              return (
                <div
                  key={recipe.id}
                  className="card p-4 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold font-song text-lg text-incense-800">
                          {recipe.name}
                        </h3>
                        {usageCount > 0 && (
                          <span className="text-xs bg-incense-100 text-incense-600 px-2 py-0.5 rounded-full">
                            {usageCount} 个订单使用
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-incense-500 mt-1">
                        {recipe.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(recipe)}
                        className="p-1.5 rounded-md hover:bg-incense-100 text-incense-500 hover:text-incense-700 transition-colors"
                        title="编辑香方"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(recipe.id, e)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-incense-500 hover:text-red-600 transition-colors"
                        title="删除香方"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-sm text-incense-600 bg-incense-100/50 rounded-lg px-3 py-2">
                      <Leaf size={14} className="text-green-600" />
                      <span>阴干</span>
                      <span className="font-semibold text-incense-800">{recipe.dryingDays}天</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-incense-600 bg-incense-100/50 rounded-lg px-3 py-2">
                      <Archive size={14} className="text-amber-600" />
                      <span>窖藏</span>
                      <span className="font-semibold text-incense-800">{recipe.cellaringDays}天</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-incense-600 bg-incense-100/50 rounded-lg px-3 py-2">
                      <Clock size={14} className="text-incense-600" />
                      <span>总周期</span>
                      <span className="font-semibold text-incense-800">{totalDays}天</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-incense-500 mb-2">所需原料</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.ingredients.map((ing) => (
                        <span
                          key={ing.ingredientId}
                          className="text-xs bg-white border border-incense-200 text-incense-600 px-2 py-1 rounded-full"
                        >
                          {ing.name} {ing.quantity}{ing.unit}
                        </span>
                      ))}
                    </div>
                  </div>

                  {recipe.craftNotes && (
                    <div className="pt-3 border-t border-incense-100">
                      <h4 className="text-xs font-medium text-incense-500 mb-1">工艺说明</h4>
                      <p className="text-sm text-incense-600 leading-relaxed">
                        {recipe.craftNotes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

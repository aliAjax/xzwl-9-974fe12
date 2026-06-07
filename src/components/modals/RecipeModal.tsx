import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Trash2, BookOpen, Leaf, Archive, FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { RecipeFormData, RecipeIngredient } from '../../types';

const commonUnits = ['g', 'ml', 'kg', 'L', '两', '钱'];

const ingredientSuggestions = [
  '沉香粉', '老山檀粉', '安息香', '粘粉', '侧柏子', '甘松', '零陵香',
  '鹅梨汁', '沉香', '龙脑香', '麝香', '陈艾绒', '苍术', '白芷',
  '丁香', '肉桂', '陈皮', '木香', '乳香', '没药', '琥珀', '朱砂'
];

const RecipeModal: React.FC = () => {
  const {
    showRecipeModal,
    editingRecipeId,
    setShowRecipeModal,
    setEditingRecipeId,
    copyingRecipeId,
    setCopyingRecipeId,
    getRecipeById,
    createRecipe,
    updateRecipe,
    ingredients: stockIngredients,
  } = useAppStore();

  const sourceRecipeId = editingRecipeId || copyingRecipeId;
  const editingRecipe = useMemo(() => {
    return sourceRecipeId ? getRecipeById(sourceRecipeId) : undefined;
  }, [sourceRecipeId, getRecipeById]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dryingDays, setDryingDays] = useState<number>(15);
  const [cellaringDays, setCellaringDays] = useState<number>(30);
  const [craftNotes, setCraftNotes] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [showIngredientSuggestions, setShowIngredientSuggestions] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const ingredientsRef = useRef<RecipeIngredient[]>([]);

  useEffect(() => {
    ingredientsRef.current = recipeIngredients;
  }, [recipeIngredients]);

  useEffect(() => {
    if (editingRecipe) {
      if (copyingRecipeId) {
        setName(`${editingRecipe.name} 副本`);
      } else {
        setName(editingRecipe.name);
      }
      setDescription(editingRecipe.description);
      setDryingDays(editingRecipe.dryingDays);
      setCellaringDays(editingRecipe.cellaringDays);
      setCraftNotes(editingRecipe.craftNotes);
      setRecipeIngredients([...editingRecipe.ingredients]);
    } else {
      setName("");
      setDescription("");
      setDryingDays(15);
      setCellaringDays(30);
      setCraftNotes("");
      setRecipeIngredients([]);
    }
  }, [editingRecipe, showRecipeModal, copyingRecipeId]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowIngredientSuggestions(null);
      }
    };

    if (showRecipeModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRecipeModal]);

  const totalProductionDays = useMemo(() => {
    return 2 + 3 + dryingDays + cellaringDays + 2;
  }, [dryingDays, cellaringDays]);

  const generateIngredientId = useCallback(() => {
    return `ing-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const handleAddIngredient = useCallback(() => {
    const newIngredient: RecipeIngredient = {
      ingredientId: generateIngredientId(),
      name: '',
      quantity: 10,
      unit: 'g',
    };
    setRecipeIngredients((prev) => [...prev, newIngredient]);
  }, [generateIngredientId]);

  const handleRemoveIngredient = useCallback((index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleIngredientChange = useCallback((index: number, field: keyof RecipeIngredient, value: string | number) => {
    setRecipeIngredients((prev) => {
      const updated = [...prev];
      if (field === 'name') {
        const stockIng = stockIngredients.find((ing) => ing.name === value);
        updated[index] = {
          ...updated[index],
          name: value as string,
          ingredientId: stockIng?.id || updated[index].ingredientId,
          unit: stockIng?.unit || updated[index].unit,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  }, [stockIngredients]);

  const getFilteredIngredientSuggestions = useCallback((currentName: string) => {
    if (!currentName) return ingredientSuggestions;
    return ingredientSuggestions.filter((name) =>
      name.toLowerCase().includes(currentName.toLowerCase())
    );
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('请输入香方名称');
      return;
    }

    const currentIngredients = ingredientsRef.current;

    if (currentIngredients.length === 0) {
      alert('请至少添加一种原料');
      return;
    }
    if (currentIngredients.some((ing) => !ing.name.trim() || ing.quantity <= 0)) {
      alert('请完善所有原料信息');
      return;
    }

    const recipeData: RecipeFormData = {
      name: name.trim(),
      description: description.trim(),
      ingredients: currentIngredients.map((ing) => ({
        ...ing,
        ingredientId: ing.ingredientId,
      })),
      dryingDays,
      cellaringDays,
      craftNotes: craftNotes.trim(),
    };

    if (editingRecipeId && !copyingRecipeId) {
      updateRecipe(editingRecipeId, recipeData);
    } else {
      createRecipe(recipeData);
      setCopyingRecipeId(null);
    }  };

  const handleClose = () => {
    setShowRecipeModal(false);
    setEditingRecipeId(null);
    setCopyingRecipeId(null);
  };
  if (!showRecipeModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm print:hidden"
        onClick={handleClose}
      />
      <div ref={modalRef} className="relative w-full max-w-3xl max-h-[90vh] bg-incense-50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-incense-700 rounded-xl flex items-center justify-center">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">
                {editingRecipeId ? '编辑香方' : copyingRecipeId ? '复制香方' : '新建香方'}
              </h2>
              <p className="text-sm text-incense-500">
                {editingRecipeId ? '修改香方配方和工艺参数' : copyingRecipeId ? '基于已有香方创建副本' : '创建新的香方配方'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-incense-700">
                香方名称
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：沉水香、柏子香"
                className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-incense-700">
                生产周期预估
              </label>
              <div className="w-full px-4 py-3 bg-incense-100/50 border border-incense-200 rounded-lg text-incense-600">
                约 <span className="font-semibold text-incense-800">{totalProductionDays}</span> 天
                （揉料2天 + 成型3天 + 阴干{dryingDays}天 + 窖藏{cellaringDays}天 + 包装2天）
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-incense-700">
              香方描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述这款香的特点、香气特征和适用场景..."
              rows={2}
              className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-incense-700">
                <Leaf size={14} className="inline mr-1 text-green-600" />
                阴干天数
              </label>
              <input
                type="number"
                value={dryingDays}
                onChange={(e) => setDryingDays(parseInt(e.target.value) || 0)}
                min="1"
                max="365"
                className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-incense-700">
                <Archive size={14} className="inline mr-1 text-amber-600" />
                窖藏天数
              </label>
              <input
                type="number"
                value={cellaringDays}
                onChange={(e) => setCellaringDays(parseInt(e.target.value) || 0)}
                min="1"
                max="3650"
                className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-incense-700">
                所需原料
              </label>
              <button
                type="button"
                onClick={handleAddIngredient}
                className="flex items-center gap-1 text-sm text-incense-600 hover:text-incense-800 transition-colors"
              >
                <Plus size={16} />
                添加原料
              </button>
            </div>

            <div className="space-y-2">
              {recipeIngredients.map((ing, index) => {
                const filteredSuggestions = getFilteredIngredientSuggestions(ing.name);
                return (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={ing.name}
                        onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                        onFocus={() => setShowIngredientSuggestions(index)}
                        placeholder="原料名称"
                        className="w-full px-3 py-2 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all text-sm"
                        required
                      />
                      {showIngredientSuggestions === index && filteredSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-incense-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {filteredSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                handleIngredientChange(index, 'name', suggestion);
                                setShowIngredientSuggestions(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-incense-50 text-incense-700 transition-colors text-sm"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      value={ing.quantity}
                      onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0.1"
                      step="0.1"
                      placeholder="用量"
                      className="w-24 px-3 py-2 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all text-sm"
                      required
                    />
                    <select
                      value={ing.unit}
                      onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                      className="w-20 px-2 py-2 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all text-sm"
                    >
                      {commonUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(index)}
                      className="p-2 text-incense-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {recipeIngredients.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-incense-200 rounded-lg text-incense-400">
                  <p>还没有添加原料</p>
                  <p className="text-sm mt-1">点击上方「添加原料」按钮</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-incense-700">
              <FileText size={14} className="inline mr-1" />
              工艺说明
            </label>
            <textarea
              value={craftNotes}
              onChange={(e) => setCraftNotes(e.target.value)}
              placeholder="详细描述制作工艺要点，如：揉料方向、温度控制、注意事项等..."
              rows={4}
              className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all resize-none"
            />
          </div>
        </form>

        <div className="p-4 border-t border-incense-200 bg-white flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!name.trim() || recipeIngredients.length === 0}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} className="inline mr-1" />
            {editingRecipeId ? '保存修改' : copyingRecipeId ? '创建副本' : '创建香方'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;

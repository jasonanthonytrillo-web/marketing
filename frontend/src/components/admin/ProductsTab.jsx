import { useState, useEffect } from 'react';
import { getAdminProducts, createProduct, updateProduct, deleteProduct, getCategories, uploadImage } from '../../services/api';
import { formatCurrency } from '../../utils/helpers';

export default function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [comboOptions, setComboOptions] = useState([]);
  const [isComboLoading, setIsComboLoading] = useState(false);
  const [optionSearch, setOptionSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active'); // active, archived, all

  const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      setUploading(true);
      try {
        const res = await uploadImage({
          image: reader.result,
          name: currentProduct.name || 'product'
        });
        setCurrentProduct({ ...currentProduct, image: res.data.url });
      } catch (error) {
        alert('Image upload failed');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.categoryId === parseInt(selectedCategory);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && p.available) || 
                         (statusFilter === 'archived' && !p.available);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([getAdminProducts(), getCategories()]);
      setProducts(prodRes.data.data);
      setCategories(catRes.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (product) => {
    setCurrentProduct(product);
    setIsEditing(true);
    if (product.isCombo) {
      loadComboOptions(product.id);
    } else {
      setComboOptions([]);
    }
  };

  const loadComboOptions = async (id) => {
    setIsComboLoading(true);
    try {
      const { getComboOptions } = await import('../../services/api');
      const res = await getComboOptions(id);
      setComboOptions(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsComboLoading(false);
    }
  };

  const handleAddOption = (product, groupNumber) => {
    if (comboOptions.some(o => o.productId === product.id && o.groupNumber === groupNumber)) return;
    setComboOptions([...comboOptions, { 
      productId: product.id, 
      product: product,
      groupNumber, 
      priceBonus: 0 
    }]);
    setOptionSearch('');
  };

  const handleRemoveOption = (index) => {
    setComboOptions(comboOptions.filter((_, i) => i !== index));
  };

  const handleUpdateOptionBonus = (index, bonus) => {
    const newOptions = [...comboOptions];
    newOptions[index].priceBonus = parseFloat(bonus) || 0;
    setComboOptions(newOptions);
  };

  const handleAdd = () => {
    setCurrentProduct({ name: '', description: '', price: '', image: '', categoryId: '', stock: 100, available: true, isCombo: false });
    setComboOptions([]);
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      let savedProduct;
      if (currentProduct.id) {
        const res = await updateProduct(currentProduct.id, currentProduct);
        savedProduct = res.data.data;
      } else {
        const res = await createProduct(currentProduct);
        savedProduct = res.data.data;
      }
      
      // Save combo options if it's a combo
      if (currentProduct.isCombo && savedProduct.id) {
        const { updateComboOptions } = await import('../../services/api');
        await updateComboOptions(savedProduct.id, {
          options: comboOptions.map(o => ({
            productId: o.productId,
            groupNumber: o.groupNumber,
            priceBonus: o.priceBonus
          }))
        });
      }

      setIsEditing(false);
      loadData();
    } catch (error) {
      alert('Failed to save product');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete/archive this product? It will no longer appear on the menu.')) return;
    try {
      await deleteProduct(id);
      loadData();
    } catch (error) {
      alert('Failed to delete product');
    }
  };

  const handleRestore = async (product) => {
    try {
      await updateProduct(product.id, { ...product, available: true });
      loadData();
    } catch (error) {
      alert('Failed to restore product');
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading products...</div>;

  return (
    <div className="">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-2xl font-bold text-surface-900">Products & Menu</h2>
        <div className="flex gap-3">
          <button 
            onClick={() => setStatusFilter(statusFilter === 'archived' ? 'active' : 'archived')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all border-2 ${statusFilter === 'archived' ? 'bg-primary-600 text-white border-primary-600 shadow-lg' : 'bg-white text-surface-600 border-surface-200 hover:border-primary-300'}`}
          >
            {statusFilter === 'archived' ? '📋 View Active' : '📁 View Archives'}
          </button>
          <button onClick={handleAdd} className="btn-primary py-2 px-4 shadow-md">
            + Add Product
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-8 bg-surface-50/50 p-6 rounded-3xl border border-surface-100">
        <div className="flex-1">
          <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 ml-1">Search Menu</label>
          <input 
            type="text" 
            placeholder="Search by product name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field w-full shadow-sm bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="w-48 sm:w-64">
            <label className="block text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 ml-1">Category Filter</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field w-full shadow-sm bg-white"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-surface-900">{currentProduct.id ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setIsEditing(false)} className="text-surface-400 hover:text-surface-600 transition-colors">✕</button>
            </div>
            
            <div className="p-6">
              <form id="productForm" onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Name</label>
                    <input required type="text" value={currentProduct.name} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Category</label>
                    <select required value={currentProduct.categoryId} onChange={e => setCurrentProduct({...currentProduct, categoryId: e.target.value})} className="input-field w-full">
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Price (₱)</label>
                    <input required type="number" step="0.01" value={currentProduct.price} onChange={e => setCurrentProduct({...currentProduct, price: e.target.value})} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-emerald-600 mb-1">Points Cost 💎</label>
                    <input type="number" value={currentProduct.pointsCost || ''} onChange={e => setCurrentProduct({...currentProduct, pointsCost: e.target.value})} className="input-field w-full border-emerald-100 focus:border-emerald-500" placeholder="e.g. 50" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-surface-700 mb-2">Product Image</label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="w-24 h-24 rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden flex-shrink-0">
                        {currentProduct.image ? (
                          <img 
                            src={currentProduct.image.startsWith('http') ? currentProduct.image : `${API_BASE}${currentProduct.image}`} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">🖼️</div>
                        )}
                      </div>
                      <div className="flex-1 w-full space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 relative">
                            <input 
                              type="file" 
                              id="imgUpload" 
                              accept="image/*"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <label 
                              htmlFor="imgUpload" 
                              className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-surface-300 hover:border-primary-50 hover:bg-primary-50 text-surface-600 font-bold cursor-pointer transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              {uploading ? '📤 Uploading...' : '📁 Choose File'}
                            </label>
                          </div>
                          <div className="flex items-center justify-center text-surface-400 font-bold px-2">OR</div>
                          <div className="flex-[1.5]">
                            <input 
                              type="text" 
                              value={currentProduct.image} 
                              onChange={e => setCurrentProduct({...currentProduct, image: e.target.value})} 
                              className="input-field w-full" 
                              placeholder="Paste Image URL here..." 
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-surface-400 italic">Recommended: Square image, max 2MB</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Status & Mix/Match */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="flex items-center gap-2 p-4 bg-surface-50 rounded-2xl border border-surface-100">
                    <input 
                      type="checkbox" 
                      id="available"
                      checked={currentProduct.available}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, available: e.target.checked })}
                      className="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="available" className="text-sm font-bold text-surface-700">Available for Sale</label>
                  </div>
                  <div className="flex items-center gap-2 p-4 bg-primary-50/50 rounded-2xl border border-primary-100">
                    <input 
                      type="checkbox" 
                      id="isCombo"
                      checked={currentProduct.isCombo || false}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, isCombo: e.target.checked })}
                      className="w-5 h-5 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="isCombo" className="text-sm font-bold text-primary-700">Is Mix & Match Combo?</label>
                  </div>
                </div>

                {currentProduct.isCombo && (
                  <div className="p-6 bg-primary-50/30 rounded-3xl border border-primary-100 animate-fade-in space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1 ml-1">Group 1 Label (e.g. Choose Main)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Choose your Main"
                          value={currentProduct.comboGroup1Name || ''}
                          onChange={(e) => setCurrentProduct({ ...currentProduct, comboGroup1Name: e.target.value })}
                          className="input-field w-full shadow-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1 ml-1">Group 2 Label (e.g. Choose Drink)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Choose your Side"
                          value={currentProduct.comboGroup2Name || ''}
                          onChange={(e) => setCurrentProduct({ ...currentProduct, comboGroup2Name: e.target.value })}
                          className="input-field w-full shadow-sm bg-white"
                        />
                      </div>
                    </div>

                    {/* Combo Option Checklists */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-primary-100/50">
                      
                      {/* Group 1 Selector */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{currentProduct.comboGroup1Name || 'Step 1 Options'}</h4>
                          <span className="text-[10px] font-bold text-surface-400">{comboOptions.filter(o => o.groupNumber === 1).length} Selected</span>
                        </div>
                        <div className="bg-surface-50/50 rounded-2xl border border-surface-100 p-2 max-h-[350px] overflow-y-auto space-y-1">
                          {products.filter(p => {
                            if (p.isCombo || !p.available) return false;
                            const cat = p.category?.name?.toLowerCase() || '';
                            const isSideOrDrink = cat.includes('drink') || cat.includes('beverage') || cat.includes('side') || cat.includes('snack') || cat.includes('dessert');
                            return !isSideOrDrink; // Only Food
                          }).map(p => {
                            const isSelected = comboOptions.some(o => o.productId === p.id && o.groupNumber === 1);
                            return (
                              <button 
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setComboOptions(comboOptions.filter(o => !(o.productId === p.id && o.groupNumber === 1)));
                                  } else {
                                    setComboOptions([...comboOptions, { productId: p.id, product: p, groupNumber: 1, priceBonus: 0 }]);
                                  }
                                }}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                                  isSelected 
                                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                                    : 'bg-white border-transparent hover:border-surface-200 text-surface-600'
                                }`}
                              >
                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : ''}`}>{p.name}</span>
                                {isSelected ? (
                                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">✓</span>
                                ) : (
                                  <span className="w-5 h-5 rounded-full border-2 border-surface-200"></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Group 2 Selector */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{currentProduct.comboGroup2Name || 'Step 2 Options'}</h4>
                          <span className="text-[10px] font-bold text-surface-400">{comboOptions.filter(o => o.groupNumber === 2).length} Selected</span>
                        </div>
                        <div className="bg-surface-50/50 rounded-2xl border border-surface-100 p-2 max-h-[350px] overflow-y-auto space-y-1">
                          {products.filter(p => {
                            if (p.isCombo || !p.available) return false;
                            const cat = p.category?.name?.toLowerCase() || '';
                            const isSideOrDrink = cat.includes('drink') || cat.includes('beverage') || cat.includes('side') || cat.includes('snack') || cat.includes('dessert');
                            return isSideOrDrink; // Only Sides & Drinks
                          }).map(p => {
                            const isSelected = comboOptions.some(o => o.productId === p.id && o.groupNumber === 2);
                            return (
                              <button 
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setComboOptions(comboOptions.filter(o => !(o.productId === p.id && o.groupNumber === 2)));
                                  } else {
                                    setComboOptions([...comboOptions, { productId: p.id, product: p, groupNumber: 2, priceBonus: 0 }]);
                                  }
                                }}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                                  isSelected 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                                    : 'bg-white border-transparent hover:border-surface-200 text-surface-600'
                                }`}
                              >
                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-900' : ''}`}>{p.name}</span>
                                {isSelected ? (
                                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
                                ) : (
                                  <span className="w-5 h-5 rounded-full border-2 border-surface-200"></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="col-span-full mt-4 p-4 bg-white/50 rounded-2xl border border-dashed border-primary-200">
                        <p className="text-[10px] text-primary-400 font-bold uppercase tracking-widest text-center">
                          💡 Just tap the product names to include or remove them from the combo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add-ons Section */}
                <div className="pt-6 border-t border-surface-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-heading font-bold text-surface-900">Customization Add-ons</h4>
                    <button 
                      type="button" 
                      onClick={() => {
                        const addons = currentProduct.addons || [];
                        setCurrentProduct({
                          ...currentProduct,
                          addons: [...addons, { name: '', price: 0 }]
                        });
                      }}
                      className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-bold border border-emerald-100 hover:bg-emerald-100 transition-all"
                    >
                      + Add Option
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {(currentProduct.addons || []).map((addon, index) => (
                      <div key={index} className="flex gap-3 items-center animate-fade-in">
                        <input 
                          type="text" 
                          placeholder="Add-on Name (e.g. Extra Cheese)" 
                          value={addon.name} 
                          onChange={e => {
                            const newAddons = [...currentProduct.addons];
                            newAddons[index].name = e.target.value;
                            setCurrentProduct({...currentProduct, addons: newAddons});
                          }}
                          className="input-field flex-1 py-2 text-xs"
                        />
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">₱</span>
                          <input 
                            type="number" 
                            placeholder="Price" 
                            value={addon.price} 
                            onChange={e => {
                              const newAddons = [...currentProduct.addons];
                              newAddons[index].price = e.target.value;
                              setCurrentProduct({...currentProduct, addons: newAddons});
                            }}
                            className="input-field w-full pl-6 py-2 text-xs"
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newAddons = currentProduct.addons.filter((_, i) => i !== index);
                            setCurrentProduct({...currentProduct, addons: newAddons});
                          }}
                          className="text-red-400 hover:text-red-600 p-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {(!currentProduct.addons || currentProduct.addons.length === 0) && (
                      <div className="text-center py-4 bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                        <p className="text-xs text-surface-400 font-medium">No add-ons configured for this product.</p>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-surface-100 flex gap-3 flex-shrink-0 bg-surface-50 rounded-b-3xl">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white border border-surface-200 hover:bg-surface-100 text-surface-700 font-bold rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" form="productForm" className="flex-[2] py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-primary-500/20">
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-200 text-sm font-medium text-surface-500 uppercase tracking-wider">
              <th className="p-4">Product</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 text-sm">
            {filteredProducts.length > 0 ? filteredProducts.map(product => (
              <tr key={product.id} className="hover:bg-surface-50 transition-colors">
                <td className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-100 flex-shrink-0 overflow-hidden border border-surface-200">
                    {product.image ? (
                      <img src={product.image.startsWith('http') ? product.image : `${API_BASE}${product.image}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-surface-200"></div>
                    )}
                  </div>
                  <span className="font-semibold text-surface-900">{product.name}</span>
                </td>
                <td className="p-4 text-surface-600">{product.category?.name || 'Uncategorized'}</td>
                <td className="p-4 font-bold text-primary-600">{formatCurrency(product.price)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${product.available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {product.available ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button onClick={() => handleEdit(product)} className="text-blue-500 hover:text-blue-700 font-medium px-2 py-1 bg-blue-50 rounded">Edit</button>
                  {product.available ? (
                    <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700 font-medium px-2 py-1 bg-red-50 rounded">Delete</button>
                  ) : (
                    <button onClick={() => handleRestore(product)} 
                      className="text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 bg-emerald-50 rounded">Restore</button>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl">🏜️</span>
                    <p className="text-surface-500 font-bold">No products found in this view.</p>
                    <p className="text-surface-400 text-xs">Try changing your filters or adding a new product!</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

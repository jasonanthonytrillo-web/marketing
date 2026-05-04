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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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
    return matchesSearch && matchesCategory;
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

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setCurrentProduct({ name: '', description: '', price: '', image: '', categoryId: '', stock: 100, available: true });
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (currentProduct.id) {
        await updateProduct(currentProduct.id, currentProduct);
      } else {
        await createProduct(currentProduct);
      }
      setIsEditing(false);
      loadData();
    } catch (error) {
      alert('Failed to save product');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this product?')) return;
    try {
      await deleteProduct(id);
      loadData();
    } catch (error) {
      alert('Failed to delete product');
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading products...</div>;

  return (
    <div className="">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-2xl font-bold text-surface-900">Products & Menu</h2>
        <button onClick={handleAdd} className="btn-primary py-2 px-4 shadow-md">
          + Add Product
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Search products by name..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field flex-1"
        />
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="input-field sm:w-64"
        >
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="available" checked={currentProduct.available} onChange={e => setCurrentProduct({...currentProduct, available: e.target.checked})} className="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500" />
                  <label htmlFor="available" className="text-sm font-medium text-surface-700">Available for Sale</label>
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
        <table className="w-full text-left border-collapse">
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
            {filteredProducts.map(product => (
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
                  <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700 font-medium px-2 py-1 bg-red-50 rounded">Deactivate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

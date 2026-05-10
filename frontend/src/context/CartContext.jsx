import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const CartContext = createContext();
const STORAGE_KEY = 'pos_cart';

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const key = `${action.payload.id}-${action.payload.size || ''}-${action.payload.flavor || ''}-${action.payload.isRedemption ? 'free' : 'paid'}-${JSON.stringify(action.payload.selectedAddons || [])}-${JSON.stringify(action.payload.comboChoices || null)}`;
      const idx = state.items.findIndex(i => i.cartKey === key);
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 };
        return { ...state, items };
      }
      return { ...state, items: [...state.items, { ...action.payload, cartKey: key, quantity: 1 }] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.cartKey !== action.payload) };
    case 'UPDATE_QTY': {
      if (action.payload.qty <= 0) return { ...state, items: state.items.filter(i => i.cartKey !== action.payload.key) };
      return { ...state, items: state.items.map(i => i.cartKey === action.payload.key ? { ...i, quantity: action.payload.qty } : i) };
    }
    case 'UPDATE_NOTES':
      return { ...state, items: state.items.map(i => i.cartKey === action.payload.key ? { ...i, notes: action.payload.notes } : i) };
    case 'TOGGLE_REDEMPTION':
      return { ...state, items: state.items.map(i => i.cartKey === action.payload.key ? { ...i, isRedemption: !i.isRedemption } : i) };
    case 'CLEAR': return { ...state, items: [] };
    default: return state;
  }
}

function loadCart() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { items: [] };
  } catch {
    return { items: [] };
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, null, loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addToCart = useCallback((product, opts = {}) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        stock: product.stock,
        pointsCost: product.pointsCost,
        size: opts.size,
        flavor: opts.flavor,
        selectedAddons: opts.addons || [],
        notes: opts.notes,
        comboChoices: opts.comboChoices || null,
        isRedemption: opts.isRedemption || false
      }
    });
  }, []);

  const removeFromCart = useCallback((cartKey) => dispatch({ type: 'REMOVE_ITEM', payload: cartKey }), []);
  const updateQuantity = useCallback((key, qty) => dispatch({ type: 'UPDATE_QTY', payload: { key, qty } }), []);
  const updateNotes = useCallback((key, notes) => dispatch({ type: 'UPDATE_NOTES', payload: { key, notes } }), []);
  const toggleRedemption = useCallback((key) => dispatch({ type: 'TOGGLE_REDEMPTION', payload: { key } }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const getItemCount = () => state.items.reduce((sum, i) => sum + i.quantity, 0);
  
  const getSubtotal = () => state.items.reduce((sum, i) => {
    if (i.isRedemption) return sum;
    let itemPrice = i.price;
    if (i.selectedAddons) i.selectedAddons.forEach(a => { itemPrice += a.price; });
    return sum + (itemPrice * i.quantity);
  }, 0);

  const getTotalPointsCost = () => state.items.reduce((sum, i) => {
    if (i.isRedemption && i.pointsCost) return sum + (i.pointsCost * i.quantity);
    return sum;
  }, 0);

  const value = {
    items: state.items,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateNotes,
    toggleRedemption,
    clearCart,
    getItemCount,
    getSubtotal,
    getTotalPointsCost
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
};

export default CartContext;

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function CustomOrderModal({
  isOpen,
  onClose,
  mealType,
  mealLabel,
  availableItems = [],
  onConfirm,
  existingItems = [],
  userBalance = 0
}) {
  const [cart, setCart] = useState({});
  const [saving, setSaving] = useState(false);

  // Initialize cart with existing items (only when modal opens)
  useEffect(() => {
    if (!isOpen) return;

    if (existingItems.length > 0) {
      const initialCart = {};
      existingItems.forEach(item => {
        initialCart[item.menu_item_id] = {
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          unit_price: item.unit_price,
          quantity: item.quantity
        };
      });
      setCart(initialCart);
    } else {
      setCart({});
    }
  }, [isOpen]); // Only depend on isOpen, not existingItems

  const handleQuantityChange = (item, delta) => {
    setCart(prev => {
      const current = prev[item.id] || {
        menu_item_id: item.id,
        item_name: item.name,
        unit_price: item.price || 0,
        quantity: 0
      };
      const newQuantity = Math.max(0, current.quantity + delta);

      if (newQuantity === 0) {
        const { [item.id]: removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [item.id]: { ...current, quantity: newQuantity }
      };
    });
  };

  const getItemQuantity = (itemId) => {
    return cart[itemId]?.quantity || 0;
  };

  const getTotalAmount = () => {
    return Object.values(cart).reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, item) => {
      return sum + item.quantity;
    }, 0);
  };

  const handleConfirm = async () => {
    const items = Object.values(cart);

    if (items.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    console.log('Confirming order with items:', items);
    console.log('Meal type:', mealType);

    setSaving(true);
    try {
      await onConfirm(items);
      onClose();
    } catch (error) {
      console.error('Error confirming order:', error);
      toast.error('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalAmount = getTotalAmount();
  const totalItems = getTotalItems();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 lg:p-4">
      <div className="bg-white rounded-lg lg:rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-3 lg:p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h3 className="font-bold text-sm lg:text-base text-gray-900">
              Select {mealLabel} Items
            </h3>
            <p className="text-[10px] lg:text-xs text-gray-500 mt-0.5">
              Choose items and quantity
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/50 rounded-md transition-colors"
          >
            <svg className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          {availableItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-xs lg:text-sm font-semibold text-gray-700">No Items Available</p>
              <p className="text-[10px] lg:text-xs text-gray-500 mt-1">
                No menu items are available for {mealLabel}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableItems.map((item) => {
                const quantity = getItemQuantity(item.id);
                const itemTotal = (item.price || 0) * quantity;

                return (
                  <div
                    key={item.id}
                    className={`border-2 rounded-lg p-3 transition-all ${
                      quantity > 0
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-xs lg:text-sm text-gray-900">
                          {item.name}
                        </h4>
                        <p className="text-[10px] lg:text-xs text-indigo-600 font-semibold mt-0.5">
                          Rs {item.price || 0} per item
                        </p>
                      </div>
                      {quantity > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] lg:text-xs text-gray-500">Total</p>
                          <p className="font-bold text-sm lg:text-base text-indigo-600">
                            Rs {itemTotal}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] lg:text-xs font-semibold text-gray-600">
                        Quantity
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item, -1)}
                          disabled={quantity === 0}
                          className="w-7 h-7 lg:w-8 lg:h-8 rounded-md bg-red-100 text-red-600 font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className={`w-8 text-center font-bold text-sm lg:text-base ${
                          quantity > 0 ? 'text-indigo-600' : 'text-gray-400'
                        }`}>
                          {quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item, 1)}
                          className="w-7 h-7 lg:w-8 lg:h-8 rounded-md bg-green-100 text-green-600 font-bold flex items-center justify-center hover:bg-green-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 lg:p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] lg:text-xs text-gray-500">Total Amount</p>
              <p className="font-bold text-lg lg:text-xl text-gray-900">
                Rs {totalAmount}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] lg:text-xs text-gray-500">Total Items</p>
              <p className="font-bold text-lg lg:text-xl text-indigo-600">
                {totalItems}
              </p>
            </div>
          </div>

          {/* Balance Information */}
          <div className="mb-3 p-2.5 lg:p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] lg:text-xs text-gray-600 font-medium">Available Balance</p>
                <p className="font-bold text-sm lg:text-base text-gray-900">
                  Rs {userBalance}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] lg:text-xs text-gray-600 font-medium">Remaining Balance</p>
                <p className={`font-bold text-sm lg:text-base ${
                  (userBalance - totalAmount) < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  Rs {userBalance - totalAmount}
                </p>
              </div>
            </div>
            {(userBalance - totalAmount) < 0 && (
              <div className="flex items-center gap-1.5 text-red-600 mt-2 pt-2 border-t border-red-200">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[10px] lg:text-xs font-semibold">Insufficient balance</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 lg:gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 lg:px-4 lg:py-2.5 bg-gray-200 text-gray-700 rounded-md lg:rounded-lg text-xs lg:text-sm font-bold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || totalItems === 0}
              className="flex-1 px-3 py-2 lg:px-4 lg:py-2.5 bg-indigo-600 text-white rounded-md lg:rounded-lg text-xs lg:text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

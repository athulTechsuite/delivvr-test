import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useTheme } from '../../contexts/ThemeContext';
import './ShoppingCart.css';

const ShoppingCart = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    clearCart, 
    getCartTotal,
    getCartCount 
  } = useCart();
  const { theme } = useTheme();

  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      alert('Please login to checkout');
      return;
    }

    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setIsProcessingCheckout(true);
    
    try {
      // Redirect to checkout page or handle checkout process
      window.location.href = '/checkout';
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error processing checkout. Please try again.');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={`cart-overlay ${theme}`} onClick={onClose}></div>
      <div className={`shopping-cart ${theme}`}>
        <div className={`cart-header ${theme}`}>
          <h2>Shopping Cart ({getCartCount()})</h2>
          <button 
            className={`cart-close-btn ${theme}`}
            onClick={onClose}
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        <div className={`cart-content ${theme}`}>
          {cartItems.length === 0 ? (
            <div className={`empty-cart ${theme}`}>
              <p>Your cart is empty</p>
              <button 
                className={`continue-shopping-btn ${theme}`}
                onClick={onClose}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              <div className={`cart-items ${theme}`}>
                {cartItems.map((item) => (
                  <div key={item.id} className={`cart-item ${theme}`}>
                    <div className="item-image">
                      <img 
                        src={item.image || '/images/placeholder-product.jpg'} 
                        alt={item.name}
                        onError={(e) => {
                          e.target.src = '/images/placeholder-product.jpg';
                        }}
                      />
                    </div>
                    
                    <div className={`item-details ${theme}`}>
                      <h4 className={`item-name ${theme}`}>{item.name}</h4>
                      <p className={`item-price ${theme}`}>{formatPrice(item.price)}</p>
                      
                      <div className={`quantity-controls ${theme}`}>
                        <button 
                          className={`quantity-btn ${theme}`}
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className={`quantity ${theme}`}>{item.quantity}</span>
                        <button 
                          className={`quantity-btn ${theme}`}
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      
                      <p className={`item-total ${theme}`}>
                        Total: {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                    
                    <button 
                      className={`remove-item-btn ${theme}`}
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>

              <div className={`cart-summary ${theme}`}>
                <div className={`cart-total ${theme}`}>
                  <h3>Total: {formatPrice(getCartTotal())}</h3>
                </div>
                
                <div className={`cart-actions ${theme}`}>
                  <button 
                    className={`clear-cart-btn ${theme}`}
                    onClick={clearCart}
                  >
                    Clear Cart
                  </button>
                  
                  <button 
                    className={`checkout-btn ${theme}`}
                    onClick={handleCheckout}
                    disabled={isProcessingCheckout}
                  >
                    {isProcessingCheckout ? 'Processing...' : 'Checkout'}
                  </button>
                </div>
                
                <button 
                  className={`continue-shopping-btn secondary ${theme}`}
                  onClick={onClose}
                >
                  Continue Shopping
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ShoppingCart;
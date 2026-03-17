import React from 'react';
import PropTypes from 'prop-types';
import './ConfirmationModal.css';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default', // 'default', 'danger', 'warning'
  isLoading = false,
  children
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter') {
      onConfirm();
    }
  };

  const getModalClass = () => {
    const baseClass = 'confirmation-modal';
    return `${baseClass} ${baseClass}--${type}`;
  };

  const getConfirmButtonClass = () => {
    const baseClass = 'confirmation-modal__confirm-btn';
    switch (type) {
      case 'danger':
        return `${baseClass} ${baseClass}--danger`;
      case 'warning':
        return `${baseClass} ${baseClass}--warning`;
      default:
        return `${baseClass} ${baseClass}--primary`;
    }
  };

  return (
    <div 
      className="confirmation-modal-overlay" 
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      aria-describedby="confirmation-modal-message"
    >
      <div className={getModalClass()}>
        <div className="confirmation-modal__header">
          <h3 id="confirmation-modal-title" className="confirmation-modal__title">
            {title}
          </h3>
          <button
            type="button"
            className="confirmation-modal__close-btn"
            onClick={onClose}
            aria-label="Close modal"
            disabled={isLoading}
          >
            &times;
          </button>
        </div>

        <div className="confirmation-modal__body">
          <div id="confirmation-modal-message" className="confirmation-modal__message">
            {message}
          </div>
          {children && (
            <div className="confirmation-modal__content">
              {children}
            </div>
          )}
        </div>

        <div className="confirmation-modal__footer">
          <button
            type="button"
            className="confirmation-modal__cancel-btn"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={getConfirmButtonClass()}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="confirmation-modal__spinner" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  type: PropTypes.oneOf(['default', 'danger', 'warning']),
  isLoading: PropTypes.bool,
  children: PropTypes.node
};

export default ConfirmationModal;
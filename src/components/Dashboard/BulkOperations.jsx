import React, { useState } from 'react';
import { Trash2, Eye, EyeOff, Archive, Package, CheckSquare, Square } from 'lucide-react';
import { toast } from 'react-hot-toast';

const BulkOperations = ({ 
  selectedItems = [], 
  onBulkDelete, 
  onBulkStatusUpdate, 
  onBulkArchive, 
  onClearSelection,
  isLoading = false 
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);

  const handleBulkAction = (action) => {
    setBulkAction(action);
    if (action === 'delete' || action === 'archive') {
      setShowConfirmDialog(true);
    } else {
      executeBulkAction(action);
    }
  };

  const executeBulkAction = async (action) => {
    try {
      switch (action) {
        case 'delete':
          await onBulkDelete(selectedItems);
          toast.success(`${selectedItems.length} item(s) deleted successfully`);
          break;
        case 'activate':
          await onBulkStatusUpdate(selectedItems, 'active');
          toast.success(`${selectedItems.length} item(s) activated successfully`);
          break;
        case 'deactivate':
          await onBulkStatusUpdate(selectedItems, 'inactive');
          toast.success(`${selectedItems.length} item(s) deactivated successfully`);
          break;
        case 'archive':
          await onBulkArchive(selectedItems);
          toast.success(`${selectedItems.length} item(s) archived successfully`);
          break;
        default:
          break;
      }
      onClearSelection();
    } catch (error) {
      toast.error(`Failed to ${action} items: ${error.message}`);
    } finally {
      setShowConfirmDialog(false);
      setBulkAction(null);
    }
  };

  const confirmBulkAction = () => {
    executeBulkAction(bulkAction);
  };

  const cancelBulkAction = () => {
    setShowConfirmDialog(false);
    setBulkAction(null);
  };

  if (selectedItems.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleBulkAction('activate')}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors disabled:opacity-50"
            >
              <Eye className="h-3 w-3 mr-1" />
              Activate
            </button>
            
            <button
              onClick={() => handleBulkAction('deactivate')}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors disabled:opacity-50"
            >
              <EyeOff className="h-3 w-3 mr-1" />
              Deactivate
            </button>
            
            <button
              onClick={() => handleBulkAction('archive')}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            >
              <Archive className="h-3 w-3 mr-1" />
              Archive
            </button>
            
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </button>
            
            <button
              onClick={onClearSelection}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
            >
              <Square className="h-3 w-3 mr-1" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  {bulkAction === 'delete' ? (
                    <Trash2 className="h-6 w-6 text-red-600" />
                  ) : (
                    <Archive className="h-6 w-6 text-yellow-600" />
                  )}
                </div>
                
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {bulkAction === 'delete' ? 'Delete Items' : 'Archive Items'}
                  </h3>
                  
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to {bulkAction} {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}? 
                      {bulkAction === 'delete' ? ' This action cannot be undone.' : ' Archived items can be restored later.'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmBulkAction}
                  disabled={isLoading}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 ${
                    bulkAction === 'delete'
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                  }`}
                >
                  {isLoading ? 'Processing...' : (bulkAction === 'delete' ? 'Delete' : 'Archive')}
                </button>
                
                <button
                  type="button"
                  onClick={cancelBulkAction}
                  disabled={isLoading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkOperations;
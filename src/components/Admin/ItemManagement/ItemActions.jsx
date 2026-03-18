import React, { useState } from 'react';
import { 
  Edit, 
  Trash2, 
  Eye, 
  MoreVertical, 
  Copy, 
  Archive, 
  ArchiveRestore 
} from 'lucide-react';
import ConfirmationModal from '../../Common/ConfirmationModal';
import { useAuth } from '../../../hooks/useAuth';
import { itemsAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';

const ItemActions = ({ 
  item, 
  onEdit, 
  onView, 
  onDelete, 
  onDuplicate, 
  onStatusChange,
  isCompact = false 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { user } = useAuth();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await itemsAPI.deleteItem(item.id);
      toast.success('Item deleted successfully');
      onDelete(item.id);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusToggle = async () => {
    setIsUpdatingStatus(true);
    try {
      const newStatus = item.status === 'active' ? 'archived' : 'active';
      await itemsAPI.updateItem(item.id, { status: newStatus });
      toast.success(`Item ${newStatus === 'active' ? 'restored' : 'archived'} successfully`);
      onStatusChange(item.id, newStatus);
    } catch (error) {
      console.error('Error updating item status:', error);
      toast.error('Failed to update item status. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const duplicatedItem = {
        ...item,
        name: `${item.name} (Copy)`,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined
      };
      
      const newItem = await itemsAPI.createItem(duplicatedItem);
      toast.success('Item duplicated successfully');
      onDuplicate(newItem);
    } catch (error) {
      console.error('Error duplicating item:', error);
      toast.error('Failed to duplicate item. Please try again.');
    }
    setShowDropdown(false);
  };

  // Check if user has permission for destructive actions
  const canDelete = user?.role === 'super_admin' || user?.permissions?.includes('items.delete');
  const canEdit = user?.permissions?.includes('items.update');
  const canArchive = user?.permissions?.includes('items.archive');

  if (isCompact) {
    return (
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onView(item)}
          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
          title="View item"
        >
          <Eye className="w-4 h-4" />
        </button>
        
        {canEdit && (
          <button
            onClick={() => onEdit(item)}
            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
            title="Edit item"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
        
        {canDelete && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1">
            <button
              onClick={() => {
                onView(item);
                setShowDropdown(false);
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Eye className="w-4 h-4 mr-3" />
              View Details
            </button>

            {canEdit && (
              <button
                onClick={() => {
                  onEdit(item);
                  setShowDropdown(false);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-3" />
                Edit Item
              </button>
            )}

            <button
              onClick={handleDuplicate}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Copy className="w-4 h-4 mr-3" />
              Duplicate Item
            </button>

            {canArchive && (
              <button
                onClick={handleStatusToggle}
                disabled={isUpdatingStatus}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {item.status === 'active' ? (
                  <>
                    <Archive className="w-4 h-4 mr-3" />
                    Archive Item
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="w-4 h-4 mr-3" />
                    Restore Item
                  </>
                )}
              </button>
            )}

            {canDelete && (
              <>
                <hr className="my-1" />
                <button
                  onClick={() => {
                    setShowDeleteModal(true);
                    setShowDropdown(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-3" />
                  Delete Item
                </button>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Item"
        message={
          <div>
            <p>Are you sure you want to delete <strong>{item.name}</strong>?</p>
            <p className="text-sm text-gray-600 mt-2">
              This action cannot be undone. All associated data will be permanently removed.
            </p>
          </div>
        }
        confirmText="Delete Item"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ItemActions;
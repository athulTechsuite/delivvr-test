import React, { useState, useEffect } from 'react';
import { Clock, User, Edit, Plus, Trash2, Upload, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ItemAuditLog = ({ itemId, isOpen, onClose }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    action: 'all',
    user: 'all',
    dateRange: '7days'
  });
  const [expandedEntries, setExpandedEntries] = useState(new Set());

  useEffect(() => {
    if (isOpen && itemId) {
      fetchAuditLogs();
    }
  }, [isOpen, itemId, filters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams({
        itemId,
        action: filters.action !== 'all' ? filters.action : '',
        user: filters.user !== 'all' ? filters.user : '',
        dateRange: filters.dateRange
      });

      const response = await fetch(`/api/admin/items/audit?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setAuditLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATE':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'UPDATE':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'DELETE':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'UPLOAD':
        return <Upload className="w-4 h-4 text-purple-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'UPLOAD':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const toggleExpanded = (logId) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedEntries(newExpanded);
  };

  const renderChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) {
      return <span className="text-gray-500 italic">No detailed changes recorded</span>;
    }

    return (
      <div className="space-y-2">
        {Object.entries(changes).map(([field, change]) => (
          <div key={field} className="bg-gray-50 p-3 rounded-md text-sm">
            <div className="font-medium text-gray-700 mb-1">{field}:</div>
            <div className="grid grid-cols-2 gap-2">
              {change.from !== undefined && (
                <div>
                  <span className="text-xs text-gray-500">From:</span>
                  <div className="text-red-600 bg-red-50 p-1 rounded">
                    {change.from || '(empty)'}
                  </div>
                </div>
              )}
              {change.to !== undefined && (
                <div>
                  <span className="text-xs text-gray-500">To:</span>
                  <div className="text-green-600 bg-green-50 p-1 rounded">
                    {change.to || '(empty)'}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Item Audit Log</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <select
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="UPLOAD">Upload</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="1day">Last 24 hours</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            <button
              onClick={fetchAuditLogs}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading audit logs...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="text-red-800">Error: {error}</div>
            </div>
          )}

          {!loading && !error && auditLogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No audit logs found for the selected filters.</p>
            </div>
          )}

          {!loading && !error && auditLogs.length > 0 && (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-white">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getActionIcon(log.action)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getActionColor(log.action)}`}>
                              {log.action}
                            </span>
                            <div className="flex items-center text-sm text-gray-600">
                              <User className="w-3 h-3 mr-1" />
                              {log.user?.name || log.user?.email || 'Unknown User'}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                          
                          <p className="text-gray-800 mb-2">{log.description}</p>
                          
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="text-sm text-gray-600">
                              <strong>Additional Info:</strong> {JSON.stringify(log.metadata)}
                            </div>
                          )}
                        </div>
                        
                        {log.changes && Object.keys(log.changes).length > 0 && (
                          <button
                            onClick={() => toggleExpanded(log.id)}
                            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                          >
                            {expandedEntries.has(log.id) ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                View Details
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {expandedEntries.has(log.id) && log.changes && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Changes Made:</h4>
                        {renderChanges(log.changes)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemAuditLog;
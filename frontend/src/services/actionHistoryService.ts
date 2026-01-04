/**
 * Action History Service (Frontend)
 * API calls for action history operations
 */

import api from './api';

export interface ActionHistory {
  id: string;
  user_id?: string;
  user_email?: string;
  user_role?: string;
  entity_type: string;
  entity_id?: string;
  action_type: 'create' | 'update' | 'delete' | 'undo';
  before_value?: any;
  after_value?: any;
  changed_fields?: Record<string, { old: any; new: any }>;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ActionHistoryFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  actionType?: 'create' | 'update' | 'delete' | 'undo';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Normalize action history data from API response
 */
function normalizeActionHistory(action: any): ActionHistory {
  return {
    id: action.id,
    user_id: action.user_id,
    user_email: action.user_email,
    user_role: action.user_role,
    entity_type: action.entity_type || '',
    entity_id: action.entity_id,
    action_type: action.action_type || 'update',
    before_value: action.before_value,
    after_value: action.after_value,
    changed_fields: action.changed_fields,
    description: action.description,
    ip_address: action.ip_address,
    user_agent: action.user_agent,
    created_at: action.created_at,
  };
}

/**
 * Fetch action history with optional filters
 */
export async function fetchActionHistory(filters: ActionHistoryFilters = {}): Promise<ActionHistory[]> {
  const params = new URLSearchParams();
  
  // Only add params if they have non-empty values (like backup)
  if (filters.entityType && filters.entityType !== '') {
    params.append('entityType', filters.entityType);
  }
  if (filters.entityId && filters.entityId !== '') {
    params.append('entityId', filters.entityId);
  }
  if (filters.userId && filters.userId !== '') {
    params.append('userId', filters.userId);
  }
  if (filters.actionType && filters.actionType !== '') {
    params.append('actionType', filters.actionType);
  }
  if (filters.startDate && filters.startDate !== '') {
    params.append('startDate', filters.startDate);
  }
  if (filters.endDate && filters.endDate !== '') {
    params.append('endDate', filters.endDate);
  }
  if (filters.limit) {
    params.append('limit', String(filters.limit));
  }
  if (filters.offset) {
    params.append('offset', String(filters.offset));
  }

  const response = await api.get<ActionHistory[]>(`/action-history?${params.toString()}`);
  return (response.data || []).map(normalizeActionHistory);
}

/**
 * Record an action
 */
export async function recordAction(params: {
  entityType: string;
  entityId?: string;
  actionType: 'create' | 'update' | 'delete' | 'undo';
  beforeValue?: any;
  afterValue?: any;
  changedFields?: Record<string, { old: any; new: any }>;
  description?: string;
}): Promise<ActionHistory> {
  const response = await api.post<ActionHistory>('/action-history', params);
  return normalizeActionHistory(response.data);
}

/**
 * Undo an action
 */
export async function undoAction(actionId: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(`/action-history/${actionId}/undo`);
  return response.data;
}


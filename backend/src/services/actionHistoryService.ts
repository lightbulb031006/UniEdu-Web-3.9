/**
 * Action History Service
 * Business logic for action history CRUD operations
 */

import supabase from '../config/database';

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

export interface RecordActionParams {
  entityType: string;
  entityId?: string;
  actionType: 'create' | 'update' | 'delete' | 'undo';
  beforeValue?: any;
  afterValue?: any;
  changedFields?: Record<string, { old: any; new: any }>;
  description?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

/**
 * Get action history with filters
 */
export async function getActionHistory(filters: ActionHistoryFilters = {}) {
  const {
    entityType,
    entityId,
    userId,
    actionType,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters;

  let query = supabase
    .from('action_history')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (actionType) {
    query = query.eq('action_type', actionType);
  }

  if (startDate) {
    // Convert YYYY-MM-DD to ISO string with time 00:00:00
    const startDateTime = startDate.includes('T') 
      ? startDate 
      : `${startDate}T00:00:00.000Z`;
    query = query.gte('created_at', startDateTime);
  } else {
    // Default: only get last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte('created_at', thirtyDaysAgo.toISOString());
  }

  if (endDate) {
    // Convert YYYY-MM-DD to ISO string with time 23:59:59
    const endDateTime = endDate.includes('T')
      ? endDate
      : `${endDate}T23:59:59.999Z`;
    query = query.lte('created_at', endDateTime);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch action history: ${error.message}`);
  }

  return (data || []) as ActionHistory[];
}

/**
 * Record an action
 */
export async function recordAction(params: RecordActionParams): Promise<ActionHistory> {
  const actionRecord: any = {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    entity_type: params.entityType,
    action_type: params.actionType,
    created_at: new Date().toISOString(),
  };

  if (params.entityId) {
    actionRecord.entity_id = params.entityId;
  }

  // User info (required for tracking)
  if (params.userId) {
    actionRecord.user_id = params.userId;
  }

  if (params.userEmail) {
    actionRecord.user_email = params.userEmail;
  } else {
    // Fallback to anonymous if no email provided
    actionRecord.user_email = 'anonymous@local';
  }

  if (params.userRole) {
    actionRecord.user_role = params.userRole;
  } else {
    actionRecord.user_role = 'unknown';
  }

  if (params.beforeValue !== undefined) {
    actionRecord.before_value = params.beforeValue;
  }

  if (params.afterValue !== undefined) {
    actionRecord.after_value = params.afterValue;
  }

  if (params.changedFields) {
    actionRecord.changed_fields = params.changedFields;
  }

  if (params.description) {
    actionRecord.description = params.description;
  }

  // Insert into database
  const { data, error } = await supabase.from('action_history').insert(actionRecord).select().single();

  if (error) {
    throw new Error(`Failed to record action: ${error.message}`);
  }

  return data as ActionHistory;
}

/**
 * Undo an action (restore entity to before_value state)
 */
export async function undoAction(actionId: string, currentUserId?: string, currentUserEmail?: string): Promise<{ success: boolean; message: string }> {
  // Get the action record
  const { data: action, error: fetchError } = await supabase
    .from('action_history')
    .select('*')
    .eq('id', actionId)
    .single();

  if (fetchError || !action) {
    return { success: false, message: 'Không tìm thấy hành động để hoàn tác' };
  }

  if (action.action_type === 'undo') {
    return { success: false, message: 'Không thể hoàn tác một hành động undo' };
  }

  if (!action.before_value) {
    return { success: false, message: 'Không có dữ liệu để khôi phục' };
  }

  // Determine which table to update based on entity_type
  const entityType = action.entity_type;
  const entityId = action.entity_id;
  const beforeValue = action.before_value;

  if (!entityId) {
    return { success: false, message: 'Không có ID entity để khôi phục' };
  }

  let updateError: any = null;

  // Update the entity based on entity_type
  switch (entityType) {
    case 'student':
      const { error: studentError } = await supabase
        .from('students')
        .update(beforeValue)
        .eq('id', entityId);
      updateError = studentError;
      break;

    case 'teacher':
      const { error: teacherError } = await supabase
        .from('teachers')
        .update(beforeValue)
        .eq('id', entityId);
      updateError = teacherError;
      break;

    case 'class':
      const { error: classError } = await supabase
        .from('classes')
        .update(beforeValue)
        .eq('id', entityId);
      updateError = classError;
      break;

    case 'payment':
      const { error: paymentError } = await supabase
        .from('payments')
        .update(beforeValue)
        .eq('id', entityId);
      updateError = paymentError;
      break;

    case 'cost':
      const { error: costError } = await supabase
        .from('costs')
        .update(beforeValue)
        .eq('id', entityId);
      updateError = costError;
      break;

    case 'category':
      const { error: categoryError } = await supabase
        .from('categories')
        .update(beforeValue)
        .eq('id', entityId);
      updateError = categoryError;
      break;

    case 'lesson_plan':
    case 'lesson_output':
      const { error: lessonError } = await supabase
        .from('lesson_outputs')
        .update(beforeValue)
        .eq('id', entityId);
      updateError = lessonError;
      break;

    default:
      return { success: false, message: `Không hỗ trợ hoàn tác cho entity type: ${entityType}` };
  }

  if (updateError) {
    return { success: false, message: `Lỗi khi khôi phục: ${updateError.message}` };
  }

  // Record the undo action
  try {
    await recordAction({
      entityType,
      entityId,
      actionType: 'undo',
      beforeValue: action.after_value,
      afterValue: beforeValue,
      description: `Hoàn tác hành động ${action.action_type} trên ${entityType} ${entityId}`,
      userId: currentUserId,
      userEmail: currentUserEmail,
    });
  } catch (recordError) {
    // Continue anyway - the undo was successful
  }

  return { success: true, message: 'Đã khôi phục thành công' };
}


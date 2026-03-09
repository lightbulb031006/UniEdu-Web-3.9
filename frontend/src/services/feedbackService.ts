/**
 * Feedback Service (Frontend)
 * API calls for student feedbacks/testimonials
 */

import api from './api';

export interface StudentFeedback {
    id: string;
    student_name: string;
    student_class?: string;
    content: string;
    rating: number;
    avatar_url?: string;
    avatar_color?: string;
    role?: string;
    subject?: string;
    highlight_text?: string;
    badge_text?: string;
    badge_icon?: string;
    achievement_text?: string;
    is_featured?: boolean;
    is_active: boolean;
    display_order: number;
    created_at?: string;
    updated_at?: string;
}

/**
 * Get active feedbacks (public)
 */
export async function fetchFeedbacks(): Promise<StudentFeedback[]> {
    try {
        const response = await api.get<StudentFeedback[]>('/feedbacks');
        return response.data || [];
    } catch (error) {
        console.debug('Failed to fetch feedbacks:', error);
        return [];
    }
}

/**
 * Get all feedbacks including inactive (admin)
 */
export async function fetchAllFeedbacks(): Promise<StudentFeedback[]> {
    const response = await api.get<StudentFeedback[]>('/feedbacks/all');
    return response.data || [];
}

/**
 * Create new feedback (admin)
 */
export async function createFeedback(
    data: Omit<StudentFeedback, 'id' | 'created_at' | 'updated_at'>
): Promise<StudentFeedback> {
    const response = await api.post<StudentFeedback>('/feedbacks', data);
    return response.data;
}

/**
 * Update feedback (admin)
 */
export async function updateFeedback(
    id: string,
    data: Partial<StudentFeedback>
): Promise<StudentFeedback> {
    const response = await api.put<StudentFeedback>(`/feedbacks/${id}`, data);
    return response.data;
}

/**
 * Delete feedback (admin)
 */
export async function deleteFeedback(id: string): Promise<void> {
    await api.delete(`/feedbacks/${id}`);
}

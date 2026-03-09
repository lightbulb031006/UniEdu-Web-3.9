/**
 * Featured Mentor Service (Frontend)
 * API calls for managing homepage mentor showcase
 */

import api from './api';

export interface FeaturedMentorTeacher {
    id: string;
    full_name: string;
    university?: string;
    high_school?: string;
    province?: string;
    specialization?: string;
    photo_url?: string;
    roles?: string[];
}

export interface FeaturedMentor {
    id: string;
    teacher_id: string;
    display_order: number;
    custom_title?: string;
    created_at?: string;
    teacher?: FeaturedMentorTeacher;
}

/**
 * Get featured mentors (public)
 */
export async function fetchFeaturedMentors(): Promise<FeaturedMentor[]> {
    try {
        const response = await api.get<FeaturedMentor[]>('/featured-mentors');
        return response.data || [];
    } catch (error) {
        console.debug('Failed to fetch featured mentors:', error);
        return [];
    }
}

/**
 * Set featured mentors (admin) — replaces all
 */
export async function updateFeaturedMentors(
    mentors: Array<{ teacher_id: string; display_order: number; custom_title?: string }>
): Promise<FeaturedMentor[]> {
    const response = await api.put<FeaturedMentor[]>('/featured-mentors', { mentors });
    return response.data || [];
}

/**
 * Remove a featured mentor (admin)
 */
export async function removeFeaturedMentor(id: string): Promise<void> {
    await api.delete(`/featured-mentors/${id}`);
}

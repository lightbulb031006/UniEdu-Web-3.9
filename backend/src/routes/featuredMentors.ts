/**
 * Featured Mentors Routes
 * API endpoints for featured mentors on the landing page
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import supabase from '../config/database';
import { getTeacherById } from '../services/teachersService';

const router = Router();

const CACHE_KEY = 'config:featured_mentors';

/**
 * GET /api/featured-mentors
 * Get featured mentors
 */
router.get('/', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('dashboard_cache')
            .select('data')
            .eq('cache_key', CACHE_KEY)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is fine initially
            console.error('[Featured Mentors] Error getting cached data:', error);
            return res.json([]);
        }

        if (!data || !data.data) {
            return res.json([]);
        }

        return res.json(data.data);
    } catch (error) {
        console.error('[Featured Mentors] Error:', error);
        next(error);
    }
});

/**
 * PUT /api/featured-mentors
 * Update featured mentors (admin only)
 */
router.put('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { mentors } = req.body;

        if (!Array.isArray(mentors)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // Process and validate mentors
        const processedMentors = [];
        for (let i = 0; i < mentors.length; i++) {
            const m = mentors[i];
            if (!m.teacher_id) continue;

            try {
                const teacher = await getTeacherById(m.teacher_id);
                if (teacher) {
                    processedMentors.push({
                        id: `fm-${m.teacher_id}`,
                        teacher_id: m.teacher_id,
                        display_order: m.display_order ?? i,
                        custom_title: m.custom_title || teacher.specialization || '',
                        teacher: {
                            id: teacher.id,
                            full_name: teacher.full_name || '',
                            university: teacher.university || '',
                            high_school: teacher.high_school || '',
                            province: teacher.province || '',
                            specialization: teacher.specialization || '',
                            photo_url: teacher.photo_url || '',
                            roles: teacher.roles || []
                        }
                    });
                }
            } catch (error) {
                console.error(`[Featured Mentors] Error fetching teacher ${m.teacher_id}:`, error);
            }
        }

        // Save to cache with a far future expiration (e.g. 10 years)
        const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);

        const { error } = await supabase
            .from('dashboard_cache')
            .upsert({
                cache_key: CACHE_KEY,
                cache_type: 'dashboard',
                data: processedMentors,
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'cache_key'
            });

        if (error) {
            throw new Error(`Failed to save featured mentors: ${error.message}`);
        }

        return res.json(processedMentors);
    } catch (error) {
        console.error('[Featured Mentors PUT] Error:', error);
        next(error);
    }
});

/**
 * DELETE /api/featured-mentors/:id
 * Remove a featured mentor
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const idToRemove = req.params.id;

        // Get current listed
        const { data, error } = await supabase
            .from('dashboard_cache')
            .select('data')
            .eq('cache_key', CACHE_KEY)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to fetch current mentors: ${error.message}`);
        }

        let currentMentors = (data?.data as any[]) || [];

        // Remove item
        currentMentors = currentMentors.filter(m => m.id !== idToRemove);

        // Save back
        const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
        await supabase
            .from('dashboard_cache')
            .upsert({
                cache_key: CACHE_KEY,
                cache_type: 'dashboard',
                data: currentMentors,
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'cache_key'
            });

        return res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;

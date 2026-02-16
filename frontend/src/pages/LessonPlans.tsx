import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { formatCurrencyVND, formatDate, formatMonthLabel } from '../utils/formatters';
import {
  fetchLessonPlans,
  createLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
  LessonPlan,
  LessonPlanFormData,
  LessonPlanFilters,
} from '../services/lessonPlansService';
import { fetchLessonResources, createLessonResource, updateLessonResource, deleteLessonResource, LessonResource, LessonResourceFormData } from '../services/lessonResourcesService';
import { fetchLessonTasks, createLessonTask, updateLessonTask, deleteLessonTask, LessonTask, LessonTaskFormData } from '../services/lessonTasksService';
import {
  fetchLessonOutputs,
  createLessonOutput,
  updateLessonOutput,
  deleteLessonOutput,
  bulkUpdateLessonOutputStatuses,
  LessonOutput,
  LessonOutputFormData,
} from '../services/lessonOutputsService';
import { fetchTeachers } from '../services/teachersService';
import {
  fetchLessonTopics,
  createLessonTopic,
  updateLessonTopic,
  deleteLessonTopic,
  initializeDefaultTopics,
  LessonTopic,
  LessonTopicFormData,
} from '../services/lessonTopicsService';
import {
  fetchLessonTopicLinks,
  createLessonTopicLink,
  deleteLessonTopicLinkByTopicAndOutput,
  bulkUpdateLessonTopicOrder,
  LessonTopicLink,
} from '../services/lessonTopicLinksService';
import { useAuthStore } from '../store/authStore';
import { isAdmin, userHasStaffRole, getUserStaffRoles } from '../utils/permissions';
import Modal from '../components/Modal';
import { CurrencyInput } from '../components/CurrencyInput';
import { toast } from '../utils/toast';
import { numberToVietnameseText } from '../utils/numberToVietnameseText';
import { recordAction } from '../services/actionHistoryService';

/**
 * Lesson Plans Page Component - Giáo Án
 * Migrated from backup/assets/js/pages/lesson-plans.js
 */

const LEVEL_OPTIONS = ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

// Helper function to map old level values to new ones (from backup)
function mapOldLevelToNew(level: string | null | undefined): string | null {
  if (!level) return null;
  const mapping: Record<string, string> = {
    'Basic': 'Level 1',
    'Intermediate': 'Level 3',
    'Advanced': 'Level 5',
  };
  return mapping[level] || level;
}

// Helper function to normalize level (map old to new if needed, otherwise return as is)
function normalizeLevel(level: string | null | undefined): string | null {
  if (!level) return null;
  // If it's already in new format (Level 0-5), return as is
  if (/^Level [0-5]$/.test(level)) {
    return level;
  }
  // Otherwise, map old format to new
  return mapOldLevelToNew(level);
}

// Helper function to get display level (for showing in UI)
function getDisplayLevel(level: string | null | undefined): string {
  const normalized = normalizeLevel(level);
  return normalized || '-';
}

// Helper function to get tag level (for grouping) - from backup
function getTagLevel(tag: string): number {
  const tagLower = tag.toLowerCase();
  // Level 0
  if (['nhập/xuất', 'input/output', 'i/o', 'câu lệnh rẽ nhánh', 'conditional', 'if-else', 'vòng lặp', 'loop', 'iteration', 'mảng', 'array', 'chuỗi', 'string', 'struct', 'hàm', 'function', 'truy vấn', 'query'].some(t => tagLower.includes(t))) {
    return 0;
  }
  // Level 1
  if (['đệ quy', 'recursion', 'brute force', 'vét cạn', 'greedy', 'sorting', 'prefixsum', 'gcd', 'lcm', 'nguyên tố', 'prime'].some(t => tagLower.includes(t))) {
    return 1;
  }
  // Level 2
  if (['binary search', 'tìm kiếm nhị phân', 'hai con trỏ', 'two pointer', 'vector', 'pair', 'set', 'map', 'euclid'].some(t => tagLower.includes(t))) {
    return 2;
  }
  // Level 3
  if (['modular', 'tổ hợp', 'combination', 'stack', 'queue', 'graph', 'dfs', 'bfs', 'segment tree', 'fenwick', 'dp', 'dynamic programming', 'hashing', 'trie', 'kmp'].some(t => tagLower.includes(t))) {
    return 3;
  }
  // Level 4
  if (['dijkstra', 'floyd', 'dsu', 'mst', 'euler', 'lca', 'bitmask', 'game theory'].some(t => tagLower.includes(t))) {
    return 4;
  }
  // Level 5
  if (['sweep line', 'gauss', 'persistent', 'rollback', '2-sat', 'hld', 'centroid', 'flow', 'convex hull'].some(t => tagLower.includes(t))) {
    return 5;
  }
  return -1;
}

// Helper function to filter and sort tags with prefix matching - from backup
function filterTagsWithPrefixMatching(searchTerm: string, availableTags: string[], selectedTags: string[]) {
  const searchLower = searchTerm.toLowerCase().trim();
  
  const filteredTags = availableTags
    .filter(tag => !selectedTags.includes(tag))
    .map(tag => {
      const tagLower = tag.toLowerCase();
      const startsWith = tagLower.startsWith(searchLower);
      const contains = tagLower.includes(searchLower);
      return {
        tag,
        level: getTagLevel(tag),
        startsWith,
        contains,
        index: startsWith ? tagLower.indexOf(searchLower) : (contains ? tagLower.indexOf(searchLower) : -1)
      };
    })
    .filter(item => item.contains)
    .sort((a, b) => {
      // Sort: starts with first, then by level, then by index position
      if (a.startsWith && !b.startsWith) return -1;
      if (!a.startsWith && b.startsWith) return 1;
      if (a.level !== b.level) return a.level - b.level;
      return a.index - b.index;
    });
  
  return filteredTags;
}

// Predefined tags from learning roadmap (from backup)
const PREDEFINED_TAGS = [
  // Level 0
  'Nhập/Xuất', 'Input/Output', 'I/O',
  'Câu lệnh rẽ nhánh', 'Conditional Statement', 'If Statement',
  'if-else', 'If-Else',
  'Vòng lặp', 'Loop', 'Iteration',
  'for', 'For Loop',
  'while', 'While Loop',
  'do-while', 'Do-While Loop',
  'Mảng', 'Array',
  'Mảng hai chiều', '2D Array', 'Two Dimensional Array',
  'Chuỗi ký tự', 'String', 'Character String',
  'Xâu', 'String',
  'Struct', 'Structure',
  'Hàm void', 'Void Function',
  'Hàm trả về kết quả', 'Return Function', 'Function with Return',
  'Truy vấn', 'Query',
  'Queries',
  
  // Level 1
  'Lý thuyết độ phức tạp', 'Time Complexity', 'Complexity Theory',
  'Đệ quy', 'Recursion', 'Recursive',
  'Brute Force', 'Vét cạn', 'Exhaustive Search',
  'Quay lui', 'Backtracking',
  'Nhánh - cận', 'Branch and Bound',
  'Greedy', 'Greedy Algorithm',
  'Phép toán bit', 'Bit Manipulation', 'Bitwise Operation',
  'Sortings', 'Sorting', 'Sort Algorithm',
  'Đếm phân phối', 'Counting Sort', 'Distribution Counting',
  'Countings', 'Counting',
  'Prefixsum', 'Prefix Sum', 'Cumulative Sum',
  'Difference Array', 'Mảng hiệu',
  'Toán học', 'Mathematics', 'Math',
  'Ước', 'Divisor', 'Factor',
  'GCD', 'Greatest Common Divisor', 'Ước chung lớn nhất',
  'LCM', 'Least Common Multiple', 'Bội chung nhỏ nhất',
  'Nguyên tố', 'Prime Number', 'Prime',
  
  // Level 2
  'Tìm kiếm nhị phân', 'Binary Search',
  'Binary search',
  'Binary search answer', 'Binary Search on Answer',
  'Hai con trỏ', 'Two Pointers', 'Two Pointer Technique',
  'Vector', 'Vector',
  'Pair', 'Pair',
  'Set', 'Set',
  'Map', 'Map', 'Dictionary',
  'Chia đôi tập', 'Divide Set', 'Set Division',
  'Rời rạc hóa', 'Discretization', 'Coordinate Compression',
  'Kỹ thuật nén số', 'Number Compression', 'Coordinate Compression',
  'Lũy thừa nhị phân', 'Binary Exponentiation', 'Fast Exponentiation',
  'Thuật toán Euclid', "Euclid's Algorithm", 'Euclidean Algorithm',
  'Phương trình Diophantine', 'Diophantine Equation',
  'CRT', 'Chinese Remainder Theorem', 'Định lý số dư Trung Hoa',
  
  // Level 3
  'Nghịch đảo modulo', 'Modular Inverse', 'Modular Multiplicative Inverse',
  'Tổ hợp', 'Combination', 'C(n,k)',
  'Chỉnh hợp', 'Permutation', 'Arrangement',
  'Xác suất', 'Probability',
  'Bao hàm loại trừ', 'Inclusion-Exclusion Principle',
  'Phi hàm Euler', "Euler's Totient Function", 'Phi Function',
  'Stack', 'Stack',
  'Queue', 'Queue',
  'Deque', 'Deque', 'Double Ended Queue',
  'Priority queue', 'Priority Queue', 'Heap',
  'Monotonic stack', 'Monotonic Stack',
  'Đồ thị', 'Graph',
  'DFS', 'Depth First Search', 'Duyệt theo chiều sâu',
  'BFS', 'Breadth First Search', 'Duyệt theo chiều rộng',
  'Check chu trình', 'Cycle Detection', 'Detect Cycle',
  'Topo Sort', 'Topological Sort', 'Topological Sorting',
  'Loang', 'Flood Fill', 'BFS Flood',
  'Cây', 'Tree',
  'Small to large', 'Small to Large', 'DSU Small to Large',
  'Gộp set', 'Union Set', 'Set Union',
  'RMQ', 'Range Minimum Query', 'Range Maximum Query',
  'Segment Tree', 'Segment Tree', 'Cây phân đoạn',
  'Fenwick Tree', 'Fenwick Tree', 'Binary Indexed Tree', 'BIT',
  'Quy hoạch động', 'Dynamic Programming', 'DP',
  'DP Lis', 'Longest Increasing Subsequence', 'LIS',
  'DP Lcs', 'Longest Common Subsequence', 'LCS',
  'DP Knapsack', 'Knapsack Problem', '0-1 Knapsack',
  'Hashing', 'Hash', 'Hash Function',
  'Trie', 'Trie', 'Prefix Tree',
  'Manacher', "Manacher's Algorithm",
  'KMP', 'Knuth-Morris-Pratt', 'KMP Algorithm',
  'Z-function', 'Z Algorithm', 'Z-Array',
  'Bignum', 'Big Integer', 'Large Number',
  'Chia căn', 'Square Root Decomposition', 'Sqrt Decomposition',
  'Chia block', 'Block Decomposition',
  'Chia theo tổng số dương', 'Divide by Positive Sum',
  'Chia để trị', 'Divide and Conquer', 'D&C',
  'Kỹ thuật sinh test', 'Test Generation', 'Test Case Generation',
  'Viết trình chấm', 'Checker', 'Solution Checker',
  
  // Level 4
  'Heavy - light', 'Heavy Light Decomposition', 'HLD',
  "MO's", "Mo's Algorithm", 'Mo Algorithm',
  'Bitset', 'Bit Set', 'Bitset',
  'Tìm kiếm nhị phân song song', 'Parallel Binary Search',
  'Segment Tree Walk', 'Segment Tree Walk',
  'Segment Tree 2D', '2D Segment Tree',
  'Fenwick 2D', '2D Fenwick Tree', '2D BIT',
  'RMQ2D', '2D RMQ', '2D Range Query',
  'Dijkstra', "Dijkstra's Algorithm", 'Shortest Path',
  'Floyd', "Floyd-Warshall", 'All Pairs Shortest Path',
  'Ford-Bellman', 'Bellman-Ford', 'Bellman Ford Algorithm',
  'SPFA', 'Shortest Path Faster Algorithm',
  'DSU', 'Disjoint Set Union', 'Union Find',
  'Cây khung nhỏ nhất', 'Minimum Spanning Tree', 'MST',
  'MST',
  'Euler Tour', 'Euler Tour', 'Eulerian Tour',
  'LCA', 'Lowest Common Ancestor', 'LCA',
  'Khớp cầu', 'Articulation Point', 'Cut Vertex',
  'Thành phần liên thông mạnh', 'Strongly Connected Component', 'SCC',
  'Thành phần song liên thông', 'Biconnected Component',
  'Chu trình Euler', 'Eulerian Cycle', 'Euler Circuit',
  'Đường đi Euler', 'Eulerian Path', 'Euler Path',
  'DSU rollback', 'Rollback DSU', 'Persistent DSU',
  'DP Bitmask', 'Bitmask DP', 'DP with Bitmask',
  'DP digit', 'Digit DP', 'DP on Digits',
  'DP D&C', 'DP Divide and Conquer',
  'DP on tree', 'Tree DP', 'Dynamic Programming on Tree',
  'DP DAG', 'DP on DAG', 'Dynamic Programming on DAG',
  'Lý thuyết trò chơi', 'Game Theory',
  
  // Level 5
  'Sweep Line', 'Sweep Line Algorithm', 'Plane Sweep',
  'Khử gauss', 'Gaussian Elimination', 'Gauss Elimination',
  'Persistent Segment Tree', 'Persistent Segment Tree',
  'Rollback Segment Tree', 'Rollback Segment Tree',
  'Segmentree Beat', 'Segment Tree Beats',
  'DSU on tree', 'DSU on Tree', 'Small to Large on Tree',
  'Re - rooting', 'Rerooting', 'Tree Rerooting',
  '2 - SAT', '2-SAT', '2 Satisfiability',
  'HLD', 'Heavy Light Decomposition',
  'Centroid', 'Centroid Decomposition', 'Centroid Tree',
  'Clique', 'Clique', 'Maximal Clique',
  'Cặp ghép', 'Matching', 'Bipartite Matching',
  'Luồng', 'Flow', 'Network Flow', 'Max Flow',
  'DP SOS', 'Sum over Subsets', 'SOS DP',
  'QHĐ thứ tự từ điển', 'Lexicographic DP', 'DP Lexicographic Order',
  'Convex Hull Trick', 'Convex Hull Trick', 'CHT',
  'Li Chao Tree', 'Li Chao Tree', 'Line Segment Tree',
  'Convex Hull', 'Convex Hull', 'Graham Scan',
  'Nhân ma trận', 'Matrix Multiplication', 'Matrix Expo'
];

const STATUS_META = {
  paid: {
    label: 'Đã thanh toán',
    badge: 'badge-success',
  },
  pending: {
    label: 'Chưa thanh toán',
    badge: 'badge-warning',
  },
  deposit: {
    label: 'Đặt cọc',
    badge: 'badge-info',
  },
};

function LessonPlans() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'exercises'>(() => {
    const saved = localStorage.getItem('lessonPlansActiveTab');
    return (saved as any) || 'overview';
  });

  // Save tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('lessonPlansActiveTab', activeTab);
  }, [activeTab]);

  // Month state for overview tab
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [monthPopupOpen, setMonthPopupOpen] = useState(false);

  // Month state for tasks tab
  const [tasksSelectedMonth, setTasksSelectedMonth] = useState<string>(currentMonth);
  const [tasksMonthPopupOpen, setTasksMonthPopupOpen] = useState(false);
  
  // Filter state for tasks tab
  const [tasksTagFilter, setTasksTagFilter] = useState<string>('');
  
  // Selected outputs for bulk actions
  const [selectedOutputIds, setSelectedOutputIds] = useState<string[]>([]);

  const [filters, setFilters] = useState<LessonPlanFilters>({
    search: '',
    level: '',
    tag: '',
    status: 'all',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null);
  
  // Overview tab modals
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<LessonResource | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LessonTask | null>(null);
  
  
  const [formData, setFormData] = useState<LessonPlanFormData>({
    lesson_name: '',
    original_title: '',
    original_link: '',
    tag: '',
    level: '',
    cost: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    completed_by: '',
    link: '',
  });

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem('lessonPlansActiveTab', activeTab);
  }, [activeTab]);

  // Fetch data for tabs
  const { data: lessonResourcesData, isLoading: isResourcesLoading, refetch: refetchResources } = useDataLoading(() => fetchLessonResources(), [], {
    cacheKey: 'lesson-resources',
    staleTime: 5 * 60 * 1000,
  });
  const lessonResources = Array.isArray(lessonResourcesData) ? lessonResourcesData : [];

  const { data: lessonTasksData, isLoading: isTasksLoading, refetch: refetchTasks } = useDataLoading(() => fetchLessonTasks({ month: selectedMonth }), [selectedMonth], {
    cacheKey: `lesson-tasks-${selectedMonth}`,
    staleTime: 2 * 60 * 1000,
  });
  const lessonTasks = Array.isArray(lessonTasksData) ? lessonTasksData : [];

  const { data: lessonOutputsData, isLoading: isOutputsLoading, refetch: refetchOutputs } = useDataLoading(() => fetchLessonOutputs({ month: selectedMonth }), [selectedMonth], {
    cacheKey: `lesson-outputs-${selectedMonth}`,
    staleTime: 2 * 60 * 1000,
  });
  const lessonOutputs = Array.isArray(lessonOutputsData) ? lessonOutputsData : [];

  // Data loading for tasks tab (all outputs, filtered by tasksSelectedMonth)
  const { data: tasksOutputsData, refetch: refetchTasksOutputs } = useDataLoading(() => fetchLessonOutputs({ month: tasksSelectedMonth }), [tasksSelectedMonth], {
    cacheKey: `tasks-outputs-${tasksSelectedMonth}`,
    staleTime: 2 * 60 * 1000,
  });
  const tasksOutputs = Array.isArray(tasksOutputsData) ? tasksOutputsData : [];

  const { data: teachersData } = useDataLoading(() => fetchTeachers(), [], {
    cacheKey: 'teachers-for-lesson-plans',
    staleTime: 5 * 60 * 1000,
  });
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  // Data loading for exercises tab
  // Exercises tab should show ALL outputs, not filtered by month
  const { data: allLessonOutputsData, refetch: refetchAllOutputs } = useDataLoading(() => fetchLessonOutputs({}), [], {
    cacheKey: 'all-lesson-outputs',
    staleTime: 5 * 60 * 1000,
  });
  const allLessonOutputs = Array.isArray(allLessonOutputsData) ? allLessonOutputsData : [];

  const { data: lessonTopicsData, refetch: refetchTopics } = useDataLoading(() => fetchLessonTopics(), [], {
    cacheKey: 'lesson-topics',
    staleTime: 5 * 60 * 1000,
  });
  const lessonTopics = Array.isArray(lessonTopicsData) ? lessonTopicsData : [];

  const { data: lessonTopicLinksData, refetch: refetchTopicLinks } = useDataLoading(() => fetchLessonTopicLinks(), [], {
    cacheKey: 'lesson-topic-links',
    staleTime: 5 * 60 * 1000,
  });
  const lessonTopicLinks = Array.isArray(lessonTopicLinksData) ? lessonTopicLinksData : [];

  // Initialize default topics on mount
  useEffect(() => {
    if (lessonTopics.length === 0) {
      initializeDefaultTopics()
        .then(() => refetchTopics())
        .catch((err) => console.error('Failed to initialize default topics:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get permissions
  const isAdminUser = isAdmin();
  const staffRoles = getUserStaffRoles(user, teachers);
  const hasLessonPlanRole = userHasStaffRole('lesson_plan', user, teachers);
  const hasAccountantRole = userHasStaffRole('accountant', user, teachers);
  const isAssistant = user?.role === 'assistant';
  const assistantId = isAssistant ? user?.linkId : null;
  
  // Get current user's staff ID for lesson_plan role users
  const currentUserStaffId = useMemo(() => {
    if (!hasLessonPlanRole || !user) return null;
    
    // First try linkId
    if (user.linkId) {
      return user.linkId;
    }
    
    // Fallback: find in teachers list by userId or email
    if (teachers.length > 0) {
      let staffRecord = null;
      if (user.id) {
        staffRecord = teachers.find((t) => (t as any).userId === user.id);
      }
      if (!staffRecord && user.email) {
        staffRecord = teachers.find((t) => 
          t.email?.toLowerCase() === user.email?.toLowerCase()
        );
      }
      return staffRecord?.id || null;
    }
    
    return null;
  }, [hasLessonPlanRole, user, teachers]);

  // Filter tasks and outputs by month and assistant (for Overview tab)
  const filterByMonth = useCallback((item: LessonTask | LessonOutput, month: string) => {
    const itemDate = (item as any).created_at || (item as any).date;
    if (!itemDate) return true; // Show items without date
    return itemDate.toString().slice(0, 7) === month; // YYYY-MM format
  }, []);

  const visibleTasks = useMemo(() => {
    let filtered = lessonTasks;
    // Filter by month
    filtered = filtered.filter((t) => filterByMonth(t, selectedMonth));
    // Filter by assistant
    if (isAssistant && assistantId) {
      filtered = filtered.filter((t) => t.assistant_id === assistantId);
    }
    return filtered;
  }, [lessonTasks, selectedMonth, isAssistant, assistantId, filterByMonth]);

  const visibleOutputs = useMemo(() => {
    let filtered = lessonOutputs;
    // Filter by month
    filtered = filtered.filter((o) => filterByMonth(o, selectedMonth));
    // Filter by assistant
    if (isAssistant && assistantId) {
      filtered = filtered.filter((o) => o.assistant_id === assistantId);
    }
    return filtered;
  }, [lessonOutputs, selectedMonth, isAssistant, assistantId, filterByMonth]);

  // Get staff with lesson_plan role
  const lessonPlanStaff = useMemo(() => {
    return teachers.filter((t) => {
      const roles = t.roles || [];
      return roles.includes('lesson_plan');
    });
  }, [teachers]);

  const handleOpenModal = (plan?: LessonPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        lesson_name: plan.lesson_name || '',
        original_title: plan.original_title || '',
        original_link: plan.original_link || '',
        tag: plan.tag || '',
        level: plan.level || '',
        cost: plan.cost || 0,
        date: plan.date || new Date().toISOString().split('T')[0],
        status: plan.status || 'pending',
        completed_by: plan.completed_by || '',
        link: plan.link || '',
        contest_uploaded: plan.contest_uploaded || '',
      });
    } else {
      setEditingPlan(null);
      setFormData({
        lesson_name: '',
        original_title: '',
        original_link: '',
        tag: '',
        level: '',
        cost: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        completed_by: '',
        link: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.lesson_name.trim()) {
      toast.error('Tên giáo án không được để trống');
      return;
    }

    if (!formData.date) {
      toast.error('Vui lòng chọn ngày');
      return;
    }

    try {
      if (editingPlan) {
        await updateLessonPlan(editingPlan.id, formData);
        toast.success('Đã cập nhật giáo án');
      } else {
        await createLessonPlan(formData);
        toast.success('Đã thêm giáo án mới');
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      toast.error('Không thể lưu giáo án: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleDelete = async (planId: string) => {
    if (!window.confirm('Xóa giáo án này?')) return;

    try {
      // Get plan data before deleting for action history
      const planToDelete = lessonPlans.find(p => p.id === planId);
      
      await deleteLessonPlan(planId);
      
      // Record action history
      if (planToDelete) {
        try {
          await recordAction({
            entityType: 'lesson_output',
            entityId: planId,
            actionType: 'delete',
            beforeValue: planToDelete,
            afterValue: null,
            changedFields: null,
            description: `Xóa bài đã làm: ${planToDelete.lesson_name || planToDelete.original_title || planId}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
      }
      
      toast.success('Đã xóa giáo án');
      refetch();
    } catch (error: any) {
      toast.error('Không thể xóa giáo án: ' + (error.message || 'Lỗi không xác định'));
    }
  };


  // Month navigation handlers
  const handleMonthChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleYearChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-');
    const newYear = parseInt(year, 10) + delta;
    setSelectedMonth(`${newYear}-${month}`);
  };

  const handleMonthSelect = (monthNum: string) => {
    const [year] = selectedMonth.split('-');
    setSelectedMonth(`${year}-${monthNum}`);
    setMonthPopupOpen(false);
  };

  const monthLabel = formatMonthLabel(selectedMonth);
  const [year, month] = selectedMonth.split('-');
  const monthNum = parseInt(month, 10);

  // Month navigation handlers for tasks tab
  const handleTasksMonthChange = (delta: number) => {
    const [year, month] = tasksSelectedMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setTasksSelectedMonth(newMonth);
  };

  const handleTasksYearChange = (delta: number) => {
    const [year, month] = tasksSelectedMonth.split('-');
    const newYear = parseInt(year, 10) + delta;
    setTasksSelectedMonth(`${newYear}-${month}`);
  };

  const handleTasksMonthSelect = (monthNum: string) => {
    const [year] = tasksSelectedMonth.split('-');
    setTasksSelectedMonth(`${year}-${monthNum}`);
    setTasksMonthPopupOpen(false);
  };

  const tasksMonthLabel = formatMonthLabel(tasksSelectedMonth);
  const [tasksYear, tasksMonth] = tasksSelectedMonth.split('-');
  const tasksMonthNum = parseInt(tasksMonth, 10);

  // Filter tasks outputs by tag and assistant
  const filteredTasksOutputs = useMemo(() => {
    let filtered = tasksOutputs;
    if (isAssistant && assistantId) {
      filtered = filtered.filter((o) => o.assistant_id === assistantId);
    }
    if (tasksTagFilter) {
      filtered = filtered.filter((o) => o.tag === tasksTagFilter);
    }
    return filtered;
  }, [tasksOutputs, isAssistant, assistantId, tasksTagFilter]);

  // Get unique tags from all outputs (for filter dropdown)
  const uniqueTags = useMemo(() => {
    const allOutputs = isAssistant && assistantId ? tasksOutputs.filter((o) => o.assistant_id === assistantId) : tasksOutputs;
    return [...new Set(allOutputs.map((o) => o.tag).filter(Boolean))];
  }, [tasksOutputs, isAssistant, assistantId]);

  // Unique tags for exercises tab (all outputs, not filtered by month)
  const exercisesUniqueTags = useMemo(() => {
    const allOutputs = isAssistant && assistantId ? allLessonOutputs.filter((o) => o.assistant_id === assistantId) : allLessonOutputs;
    // Split tags by comma and get unique tags
    const allTags = allOutputs.map((o) => o.tag).filter(Boolean);
    const uniqueTags = new Set<string>();
    allTags.forEach((tag) => {
      tag.split(',').forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) uniqueTags.add(trimmed);
      });
    });
    return Array.from(uniqueTags).sort();
  }, [allLessonOutputs, isAssistant, assistantId]);

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h2>Giáo Án</h2>
      </div>

      {/* Tabs Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Tabs Navigation */}
        <div
          className="lesson-plans-tabs"
          style={{
            display: 'flex',
            position: 'relative',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: 'var(--spacing-2)',
            gap: 'var(--spacing-1)',
          }}
        >
          <button
            className={`lesson-plan-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            data-tab="overview"
          >
            <div className="lesson-plan-tab-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8 7h8" />
                <path d="M8 11h8" />
                <path d="M8 15h4" />
              </svg>
            </div>
            <span className="lesson-plan-tab-text">Tổng quan</span>
          </button>
          <button
            className={`lesson-plan-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
            data-tab="tasks"
          >
            <div className="lesson-plan-tab-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <span className="lesson-plan-tab-text">Công việc</span>
          </button>
          <button
            className={`lesson-plan-tab ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
            data-tab="exercises"
          >
            <div className="lesson-plan-tab-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <circle cx="12" cy="10" r="1.5" />
              </svg>
            </div>
            <span className="lesson-plan-tab-text">Bài Tập</span>
          </button>
          <div
            className="lesson-plan-tab-indicator"
            style={{
              position: 'absolute',
              bottom: 0,
              left: activeTab === 'overview' ? '0' : activeTab === 'tasks' ? '33.33%' : '66.66%',
              width: '33.33%',
              height: '3px',
              background: 'linear-gradient(90deg, var(--primary) 0%, rgba(59, 130, 246, 0.8) 100%)',
              transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 2,
              borderRadius: '3px 3px 0 0',
              boxShadow: '0 -2px 8px rgba(59, 130, 246, 0.4)',
            }}
          />
        </div>

        {/* Tab Panels */}
        <div style={{ padding: 'var(--spacing-6)' }}>
          {activeTab === 'overview' && (
            <OverviewTab
              lessonResources={lessonResources}
              lessonTasks={visibleTasks}
              lessonOutputs={visibleOutputs}
              lessonPlanStaff={lessonPlanStaff}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
              monthNum={monthNum}
              year={year}
              monthPopupOpen={monthPopupOpen}
              onMonthChange={handleMonthChange}
              onYearChange={handleYearChange}
              onMonthSelect={handleMonthSelect}
              onMonthPopupToggle={() => setMonthPopupOpen(!monthPopupOpen)}
              isAdmin={isAdminUser}
              hasLessonPlanRole={hasLessonPlanRole}
              isResourcesLoading={isResourcesLoading}
              isTasksLoading={isTasksLoading}
              isOutputsLoading={isOutputsLoading}
              onAddResource={() => {
                setEditingResource(null);
                setResourceModalOpen(true);
              }}
              onEditResource={(id: string) => {
                const resource = lessonResources.find((r) => r.id === id);
                setEditingResource(resource || null);
                setResourceModalOpen(true);
              }}
              onDeleteResource={async (id: string) => {
                if (window.confirm('Bạn có chắc chắn muốn xóa tài nguyên này?')) {
                  try {
                    const resourceToDelete = lessonResources.find(r => r.id === id);
                    await deleteLessonResource(id);
                    
                    // Record action history
                    if (resourceToDelete) {
                      try {
                        await recordAction({
                          entityType: 'lesson_resource',
                          entityId: id,
                          actionType: 'delete',
                          beforeValue: resourceToDelete,
                          afterValue: null,
                          changedFields: null,
                          description: `Xóa tài nguyên: ${resourceToDelete.title || id}`,
                        });
                      } catch (err) {
                        // Silently fail - action history is not critical
                      }
                    }
                    
                    await refetchResources();
                    toast.success('Đã xóa tài nguyên');
                  } catch (error: any) {
                    toast.error('Lỗi khi xóa tài nguyên');
                  }
                }
              }}
              onAddTask={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
              onEditTask={(id: string) => {
                const task = lessonTasks.find((t) => t.id === id);
                setEditingTask(task || null);
                setTaskModalOpen(true);
              }}
              onDeleteTask={async (id: string) => {
                if (window.confirm('Bạn có chắc chắn muốn xóa task này?')) {
                  try {
                    const taskToDelete = lessonTasks.find(t => t.id === id);
                    await deleteLessonTask(id);
                    
                    // Record action history
                    if (taskToDelete) {
                      try {
                        await recordAction({
                          entityType: 'lesson_task',
                          entityId: id,
                          actionType: 'delete',
                          beforeValue: taskToDelete,
                          afterValue: null,
                          changedFields: null,
                          description: `Xóa task: ${taskToDelete.title || id}`,
                        });
                      } catch (err) {
                        // Silently fail - action history is not critical
                      }
                    }
                    
                    await refetchTasks();
                    toast.success('Đã xóa task');
                  } catch (error: any) {
                    toast.error('Lỗi khi xóa task');
                  }
                }
              }}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksTab
              outputs={filteredTasksOutputs}
              uniqueTags={uniqueTags}
              selectedMonth={tasksSelectedMonth}
              monthLabel={tasksMonthLabel}
              monthNum={tasksMonthNum}
              year={tasksYear}
              monthPopupOpen={tasksMonthPopupOpen}
              onMonthChange={handleTasksMonthChange}
              onYearChange={handleTasksYearChange}
              onMonthSelect={handleTasksMonthSelect}
              onMonthPopupToggle={() => setTasksMonthPopupOpen(!tasksMonthPopupOpen)}
              tagFilter={tasksTagFilter}
              onTagFilterChange={setTasksTagFilter}
              selectedOutputIds={selectedOutputIds}
              onSelectedOutputIdsChange={setSelectedOutputIds}
              isAdmin={isAdminUser}
              isAssistant={isAssistant}
              hasAccountantRole={hasAccountantRole}
              hasLessonPlanRole={hasLessonPlanRole}
              lessonPlanStaff={lessonPlanStaff}
              currentUserStaffId={currentUserStaffId}
              onRefetch={refetchTasksOutputs}
            />
          )}

          {activeTab === 'exercises' && (
              <ExercisesTab
              topics={lessonTopics}
              topicLinks={lessonTopicLinks}
              outputs={allLessonOutputs}
              uniqueTags={exercisesUniqueTags}
              isAdmin={isAdminUser}
              isAssistant={isAssistant}
              assistantId={assistantId}
              lessonPlanStaff={lessonPlanStaff}
              onRefetchTopics={refetchTopics}
              onRefetchTopicLinks={refetchTopicLinks}
              onRefetchOutputs={refetchAllOutputs}
            />
          )}
        </div>
      </div>

      {/* Resource Modal */}
      <Modal
        isOpen={resourceModalOpen}
        onClose={() => {
          setResourceModalOpen(false);
          setEditingResource(null);
        }}
        size="md"
        title={editingResource ? 'Sửa tài nguyên' : 'Thêm tài nguyên mới'}
      >
        <ResourceModal
          resource={editingResource}
          onClose={() => {
            setResourceModalOpen(false);
            setEditingResource(null);
          }}
          onSuccess={async () => {
            await refetchResources();
            setResourceModalOpen(false);
            setEditingResource(null);
          }}
        />
      </Modal>

      {/* Task Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        size="md"
        title={editingTask ? 'Sửa task' : 'Thêm task mới'}
      >
        <TaskModal
          task={editingTask}
          lessonPlanStaff={lessonPlanStaff}
          currentUserStaffId={hasLessonPlanRole ? currentUserStaffId : null}
          onClose={() => {
            setTaskModalOpen(false);
            setEditingTask(null);
          }}
          onSuccess={async () => {
            await refetchTasks();
            setTaskModalOpen(false);
            setEditingTask(null);
          }}
        />
      </Modal>

      {/* Lesson Plan Form Modal */}
      <Modal
        title={editingPlan ? 'Chỉnh sửa giáo án' : 'Thêm giáo án mới'}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="lessonName" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Tên giáo án *
            </label>
            <input
              id="lessonName"
              type="text"
              className="form-control"
              value={formData.lesson_name}
              onChange={(e) => setFormData({ ...formData, lesson_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="originalTitle" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Tiêu đề gốc
            </label>
            <input
              id="originalTitle"
              type="text"
              className="form-control"
              value={formData.original_title || ''}
              onChange={(e) => setFormData({ ...formData, original_title: e.target.value })}
              placeholder="Ví dụ: Light - VNOI"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="originalLink" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Link gốc
            </label>
            <input
              id="originalLink"
              type="url"
              className="form-control"
              value={formData.original_link || ''}
              onChange={(e) => setFormData({ ...formData, original_link: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <div className="form-group">
              <label htmlFor="lessonTag" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                Tag
              </label>
              <input
                id="lessonTag"
                type="text"
                className="form-control"
                value={formData.tag || ''}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="lessonLevel" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                Cấp độ
              </label>
              <select
                id="lessonLevel"
                className="form-control"
                value={formData.level || ''}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              >
                <option value="">Chọn cấp độ</option>
                {LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <div className="form-group">
              <label htmlFor="lessonDate" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                Ngày *
              </label>
              <input
                id="lessonDate"
                type="date"
                className="form-control"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="lessonStatus" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                Trạng thái
              </label>
              <select
                id="lessonStatus"
                className="form-control"
                value={formData.status || 'pending'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                {Object.entries(STATUS_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="lessonCost" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Chi phí
            </label>
            <CurrencyInput
              id="lessonCost"
              className="form-control"
              value={formData.cost || 0}
              onChange={(value) => setFormData({ ...formData, cost: value })}
              placeholder="Nhập chi phí (VD: 30000)"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="completedBy" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Người hoàn thành
            </label>
            <input
              id="completedBy"
              type="text"
              className="form-control"
              value={formData.completed_by || ''}
              onChange={(e) => setFormData({ ...formData, completed_by: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="lessonLink" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Link
            </label>
            <input
              id="lessonLink"
              type="url"
              className="form-control"
              value={formData.link || ''}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
            <button type="button" className="btn" onClick={handleCloseModal}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editingPlan ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  lessonResources,
  lessonTasks,
  lessonOutputs,
  lessonPlanStaff,
  selectedMonth,
  monthLabel,
  monthNum,
  year,
  monthPopupOpen,
  onMonthChange,
  onYearChange,
  onMonthSelect,
  onMonthPopupToggle,
  isAdmin,
  hasLessonPlanRole,
  isResourcesLoading,
  isTasksLoading,
  isOutputsLoading,
  onAddResource,
  onEditResource,
  onDeleteResource,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  lessonResources: LessonResource[];
  lessonTasks: LessonTask[];
  lessonOutputs: LessonOutput[];
  lessonPlanStaff: any[];
  selectedMonth: string;
  monthLabel: string;
  monthNum: number;
  year: string;
  monthPopupOpen: boolean;
  onMonthChange: (delta: number) => void;
  onYearChange: (delta: number) => void;
  onMonthSelect: (monthNum: string) => void;
  onMonthPopupToggle: () => void;
  isAdmin: boolean;
  hasLessonPlanRole: boolean;
  isResourcesLoading: boolean;
  isTasksLoading: boolean;
  isOutputsLoading: boolean;
  onAddResource: () => void;
  onEditResource: (id: string) => void;
  onDeleteResource: (id: string) => Promise<void>;
  onAddTask: () => void;
  onEditTask: (id: string) => void;
  onDeleteTask: (id: string) => Promise<void>;
}) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="overview-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* Tài nguyên giáo án */}
      <div className="overview-section-card">
        <div className="overview-section-header">
          <div className="overview-section-title">
            <div
              className="overview-section-icon"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text)' }}>Tài nguyên giáo án</h3>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: '2px' }}>
                {lessonResources.length} tài nguyên
              </p>
            </div>
          </div>
          {(isAdmin || hasLessonPlanRole) && (
            <button
              type="button"
              className="btn btn-primary btn-add-icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Button clicked, calling onAddResource');
                onAddResource();
              }}
              title="Thêm tài nguyên"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 'var(--spacing-1)', 
                padding: 'var(--spacing-2)', 
                cursor: 'pointer',
                position: 'relative',
                zIndex: 10,
                border: 'none',
                outline: 'none',
                pointerEvents: 'auto'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
        <div className="table-container" style={{ marginTop: 'var(--spacing-4)' }}>
          <table className="table-striped overview-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Tiêu đề</th>
                <th style={{ width: '10%' }}>Link</th>
                <th style={{ width: '55%' }}>Tags</th>
              </tr>
            </thead>
            <tbody>
              {isResourcesLoading ? (
                Array(3).fill(null).map((_, idx) => (
                  <tr key={`skeleton-resource-${idx}`}>
                    <td><div className="skeleton-line" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton-line" style={{ width: '60%' }}></div></td>
                    <td><div className="skeleton-line" style={{ width: '70%' }}></div></td>
                  </tr>
                ))
              ) : lessonResources.length > 0 ? (
                lessonResources.map((resource) => (
                  <tr
                    key={resource.id}
                    className="overview-table-row"
                    style={{ cursor: (isAdmin || hasLessonPlanRole) ? 'pointer' : 'default' }}
                    onClick={(e) => {
                      // Don't trigger if clicking button or link
                      if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                      if ((isAdmin || hasLessonPlanRole) && resource.id) {
                        onEditResource(resource.id);
                      }
                    }}
                  >
                    <td>
                      <strong style={{ color: 'var(--text)', fontWeight: '500' }}>{resource.title || '-'}</strong>
                    </td>
                    <td>
                      {resource.resource_link ? (
                        <a
                          href={resource.resource_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={resource.resource_link}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--primary)' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                          -
                        </span>
                      )}
                    </td>
                    <td style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)', alignItems: 'center' }}>
                        {Array.isArray(resource.tags) && resource.tags.length > 0 ? (
                          resource.tags.map((t, idx) => (
                            <span key={idx} className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                            -
                          </span>
                        )}
                      </div>
                      {(isAdmin || hasLessonPlanRole) && (
                        <div className="row-delete-icon">
                          <button
                            className="btn-delete-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteResource(resource.id);
                            }}
                            title="Xóa"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="overview-empty-state">
                    <div>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}
                      >
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>Chưa có tài nguyên nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân công task */}
      <div className="overview-section-card">
        <div className="overview-section-header">
          <div className="overview-section-title">
            <div
              className="overview-section-icon"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'rgb(16, 185, 129)' }}>
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text)' }}>Phân công task cho nhân sự</h3>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: '2px' }}>{lessonTasks.length} task</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <div className="session-month-nav" style={{ position: 'relative' }}>
              <button
                type="button"
                className="session-month-btn"
                onClick={() => onMonthChange(-1)}
                title="Tháng trước"
              >
                ◀
              </button>
              <button
                type="button"
                className="session-month-label-btn"
                onClick={onMonthPopupToggle}
                title="Chọn tháng/năm"
              >
                <span className="session-month-label">Tháng {monthLabel}</span>
              </button>
              <button
                type="button"
                className="session-month-btn"
                onClick={() => onMonthChange(1)}
                title="Tháng sau"
              >
                ▶
              </button>
              {monthPopupOpen && (
                <div className="session-month-popup">
                  <div className="session-month-popup-header">
                    <button
                      type="button"
                      className="session-month-year-btn"
                      onClick={() => onYearChange(-1)}
                    >
                      ‹
                    </button>
                    <span className="session-month-year-label">{year}</span>
                    <button
                      type="button"
                      className="session-month-year-btn"
                      onClick={() => onYearChange(1)}
                    >
                      ›
                    </button>
                  </div>
                  <div className="session-month-grid">
                    {monthNames.map((label, idx) => {
                      const val = String(idx + 1).padStart(2, '0');
                      const isActive = val === String(monthNum).padStart(2, '0');
                      return (
                        <button
                          key={val}
                          type="button"
                          className={`session-month-cell${isActive ? ' active' : ''}`}
                          onClick={() => onMonthSelect(val)}
                          data-month={val}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {(isAdmin || hasLessonPlanRole) && (
              <button
                className="btn btn-primary btn-add-icon"
                onClick={onAddTask}
                title="Thêm task"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', padding: 'var(--spacing-2)', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="table-container" style={{ marginTop: 'var(--spacing-4)' }}>
          <table className="table-striped overview-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Tên bài</th>
                <th style={{ width: '25%' }}>Người phụ trách</th>
                <th style={{ width: '15%' }}>Deadline</th>
                <th style={{ width: '25%' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {isTasksLoading ? (
                Array(3).fill(null).map((_, idx) => (
                  <tr key={`skeleton-task-${idx}`}>
                    <td><div className="skeleton-line" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton-line" style={{ width: '60%' }}></div></td>
                    <td><div className="skeleton-line" style={{ width: '50%' }}></div></td>
                    <td><div className="skeleton-line" style={{ width: '40%' }}></div></td>
                  </tr>
                ))
              ) : lessonTasks.length > 0 ? (
                lessonTasks.map((task) => {
                  const staffMember = lessonPlanStaff.find((s) => s.id === task.assistant_id);
                  return (
                    <tr
                      key={task.id}
                      className="overview-table-row"
                      style={{ cursor: (isAdmin || hasLessonPlanRole) ? 'pointer' : 'default' }}
                      onClick={(e) => {
                        // Don't trigger if clicking button
                        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
                        if ((isAdmin || hasLessonPlanRole) && task.id) {
                          onEditTask(task.id);
                        }
                      }}
                    >
                      <td>
                        <strong style={{ color: 'var(--text)', fontWeight: '500' }}>{task.title || '-'}</strong>
                      </td>
                      <td>
                        {staffMember ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span style={{ fontSize: 'var(--font-size-sm)' }}>{staffMember.fullName || staffMember.full_name || '-'}</span>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                            -
                          </span>
                        )}
                      </td>
                      <td>
                        {task.due_date ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span style={{ fontSize: 'var(--font-size-sm)' }}>{formatDate(task.due_date)}</span>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                            -
                          </span>
                        )}
                      </td>
                      <td style={{ position: 'relative' }}>
                        <span
                          className={`badge ${
                            task.status === 'completed'
                              ? 'badge-success'
                              : task.status === 'in_progress'
                              ? 'badge-info'
                              : task.status === 'cancelled'
                              ? 'badge-muted'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}
                        >
                          {task.status === 'completed'
                            ? 'Hoàn thành'
                            : task.status === 'in_progress'
                            ? 'Đang làm'
                            : task.status === 'cancelled'
                            ? 'Đã hủy'
                            : 'Chờ xử lý'}
                        </span>
                        {isAdmin && (
                          <div className="row-delete-icon">
                            <button
                              className="btn-delete-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask(task.id);
                              }}
                              title="Xóa"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="overview-empty-state">
                    <div>
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}
                    >
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>Chưa có task nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danh sách bài đã hoàn thành */}
      <div className="overview-section-card">
        <div className="overview-section-header">
          <div className="overview-section-title">
            <div
              className="overview-section-icon"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'rgb(139, 92, 246)' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text)' }}>Danh sách bài giáo án đã hoàn thành</h3>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: '2px' }}>
                {lessonOutputs.length} bài đã hoàn thành
              </p>
            </div>
          </div>
        </div>
        <div className="table-container" style={{ marginTop: 'var(--spacing-4)' }}>
          <table className="table-striped overview-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Tên bài</th>
                <th style={{ width: '30%' }}>Tag</th>
                <th style={{ width: '30%' }}>Level</th>
              </tr>
            </thead>
            <tbody>
              {isOutputsLoading ? (
                Array(5).fill(null).map((_, idx) => (
                  <tr key={`skeleton-output-${idx}`}>
                    <td><div className="skeleton-line" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton-line" style={{ width: '60%' }}></div></td>
                    <td><div className="skeleton-line" style={{ width: '50%' }}></div></td>
                  </tr>
                ))
              ) : lessonOutputs.length > 0 ? (
                lessonOutputs
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .slice(0, 10)
                  .map((output) => (
                    <tr key={output.id} className="overview-table-row">
                      <td>
                        <strong style={{ color: 'var(--text)', fontWeight: '500' }}>{output.lesson_name || '-'}</strong>
                      </td>
                      <td>
                        {output.tag ? (
                          <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                            {output.tag}
                          </span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                            -
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            fontSize: 'var(--font-size-xs)',
                            padding: '4px 10px',
                            fontWeight: '500',
                          }}
                        >
                          {getDisplayLevel(output.level)}
                        </span>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={3} className="overview-empty-state">
                    <div>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>Chưa có bài nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Tasks Tab Component
function TasksTab({
  outputs,
  uniqueTags,
  selectedMonth,
  monthLabel,
  monthNum,
  year,
  monthPopupOpen,
  onMonthChange,
  onYearChange,
  onMonthSelect,
  onMonthPopupToggle,
  tagFilter,
  onTagFilterChange,
  selectedOutputIds,
  onSelectedOutputIdsChange,
  isAdmin,
  isAssistant,
  hasAccountantRole,
  hasLessonPlanRole,
  lessonPlanStaff,
  currentUserStaffId,
  onRefetch,
}: {
  outputs: LessonOutput[];
  uniqueTags: string[];
  selectedMonth: string;
  monthLabel: string;
  monthNum: number;
  year: string;
  monthPopupOpen: boolean;
  onMonthChange: (delta: number) => void;
  onYearChange: (delta: number) => void;
  onMonthSelect: (monthNum: string) => void;
  onMonthPopupToggle: () => void;
  onResetMonth?: () => void;
  tagFilter: string;
  onTagFilterChange: (tag: string) => void;
  selectedOutputIds: string[];
  onSelectedOutputIdsChange: (ids: string[]) => void;
  isAdmin: boolean;
  isAssistant: boolean;
  hasAccountantRole: boolean;
  hasLessonPlanRole: boolean;
  lessonPlanStaff: any[];
  currentUserStaffId: string | null;
  onRefetch: () => Promise<void>;
}) {
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingOutput, setEditingOutput] = useState<LessonOutput | null>(null);
  const [addFormData, setAddFormData] = useState<LessonOutputFormData>({
    lesson_name: '',
    original_title: '',
    original_link: '',
    tag: '',
    level: '',
    date: new Date().toISOString().split('T')[0],
    cost: 0,
    status: 'pending',
    contest_uploaded: '',
    link: '',
    assistant_id: currentUserStaffId || undefined,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [costPreview, setCostPreview] = useState({ formatted: '0 đ', words: 'Không đồng' });
  const [duplicateTitleMatches, setDuplicateTitleMatches] = useState<Array<{
    title: string;
    originalTitle: string;
    level: string;
    tag: string;
    createdAt: string;
  }>>([]);
  const [duplicateOriginalTitleMatches, setDuplicateOriginalTitleMatches] = useState<Array<{
    title: string;
    originalTitle: string;
    level: string;
    tag: string;
    createdAt: string;
  }>>([]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Filter tags with prefix matching
  const filteredTags = useMemo(() => {
    return filterTagsWithPrefixMatching(tagSearchInput, PREDEFINED_TAGS, selectedTags);
  }, [tagSearchInput, selectedTags]);

  // Popular tags for empty search
  const popularTags = useMemo(() => {
    const popular = ['DFS', 'BFS', 'DP', 'Segment Tree', 'Greedy', 'Binary Search', 'Graph', 'Tree'];
    return popular.filter(t => !selectedTags.includes(t) && PREDEFINED_TAGS.includes(t)).slice(0, 6);
  }, [selectedTags]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectedOutputIdsChange(filteredOutputs.map((o) => o.id));
    } else {
      onSelectedOutputIdsChange([]);
    }
  };

  const handleSelectOutput = (id: string, checked: boolean) => {
    if (checked) {
      onSelectedOutputIdsChange([...selectedOutputIds, id]);
    } else {
      onSelectedOutputIdsChange(selectedOutputIds.filter((i) => i !== id));
    }
  };

  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);

  const handleBulkUpdateStatus = async (status: 'paid' | 'pending' | 'deposit') => {
    if (selectedOutputIds.length === 0) return;
    try {
      await bulkUpdateLessonOutputStatuses(selectedOutputIds, status);
      toast.success(`Đã cập nhật trạng thái ${selectedOutputIds.length} bài`);
      onSelectedOutputIdsChange([]);
      setBulkStatusModalOpen(false);
      await onRefetch();
    } catch (error: any) {
      toast.error('Không thể cập nhật trạng thái: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleDeleteOutput = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài đã làm này?')) return;
    try {
      const outputToDelete = outputs.find(o => o.id === id);
      await deleteLessonOutput(id);
      
      // Record action history
      if (outputToDelete) {
        try {
          await recordAction({
            entityType: 'lesson_output',
            entityId: id,
            actionType: 'delete',
            beforeValue: outputToDelete,
            afterValue: null,
            changedFields: null,
            description: `Xóa bài đã làm: ${outputToDelete.lesson_name || outputToDelete.original_title || id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
      }
      
      toast.success('Đã xóa bài đã làm');
      await onRefetch();
    } catch (error: any) {
      toast.error('Không thể xóa bài đã làm: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const [isEditOutputModalOpen, setIsEditOutputModalOpen] = useState(false);
  const [editingOutputId, setEditingOutputId] = useState<string | null>(null);

  const handleRowClick = (outputId: string, e: React.MouseEvent) => {
    // Don't open modal if clicking on checkbox, button, or link
    const target = e.target as HTMLElement;
    if (
      target.closest('input[type="checkbox"]') ||
      target.closest('button') ||
      target.closest('a') ||
      target.closest('.link-actions')
    ) {
      return;
    }
    setEditingOutputId(outputId);
    setIsEditOutputModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...addFormData,
        tag: selectedTags.join(','),
      };
      if (editingOutput) {
        const oldOutput = { ...editingOutput };
        const updatedOutput = await updateLessonOutput(editingOutput.id, submitData);
        
        // Record action history
        try {
          const changedFields: Record<string, { old: any; new: any }> = {};
          if (oldOutput.lesson_name !== updatedOutput.lesson_name) changedFields.lesson_name = { old: oldOutput.lesson_name, new: updatedOutput.lesson_name };
          if (oldOutput.original_title !== updatedOutput.original_title) changedFields.original_title = { old: oldOutput.original_title, new: updatedOutput.original_title };
          if (oldOutput.tag !== updatedOutput.tag) changedFields.tag = { old: oldOutput.tag, new: updatedOutput.tag };
          if (oldOutput.level !== updatedOutput.level) changedFields.level = { old: oldOutput.level, new: updatedOutput.level };
          if (oldOutput.cost !== updatedOutput.cost) changedFields.cost = { old: oldOutput.cost, new: updatedOutput.cost };
          if (oldOutput.date !== updatedOutput.date) changedFields.date = { old: oldOutput.date, new: updatedOutput.date };
          if (oldOutput.status !== updatedOutput.status) changedFields.status = { old: oldOutput.status, new: updatedOutput.status };
          if (oldOutput.completed_by !== updatedOutput.completed_by) changedFields.completed_by = { old: oldOutput.completed_by, new: updatedOutput.completed_by };
          if (oldOutput.link !== updatedOutput.link) changedFields.link = { old: oldOutput.link, new: updatedOutput.link };
          
          await recordAction({
            entityType: 'lesson_output',
            entityId: updatedOutput.id,
            actionType: 'update',
            beforeValue: oldOutput,
            afterValue: updatedOutput,
            changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
            description: `Cập nhật bài đã làm: ${updatedOutput.lesson_name || updatedOutput.original_title || updatedOutput.id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
        
        toast.success('Đã cập nhật bài');
      } else {
        const newOutput = await createLessonOutput(submitData);
        
        // Record action history
        try {
          await recordAction({
            entityType: 'lesson_output',
            entityId: newOutput.id,
            actionType: 'create',
            beforeValue: null,
            afterValue: newOutput,
            changedFields: null,
            description: `Tạo bài đã làm mới: ${newOutput.lesson_name || newOutput.original_title || newOutput.id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
        
        toast.success('Đã thêm bài');
      }
      setIsAddFormOpen(false);
      setEditingOutput(null);
      setSelectedTags([]);
      setTagSearchInput('');
      setAddFormData({
        lesson_name: '',
        original_title: '',
        original_link: '',
        tag: '',
        level: '',
        date: new Date().toISOString().split('T')[0],
        cost: 0,
        status: 'pending',
        contest_uploaded: '',
        link: '',
        assistant_id: currentUserStaffId || undefined,
      });
      setCostPreview({ formatted: '0 đ', words: 'Không đồng' });
      setDuplicateTitleMatches([]);
      setDuplicateOriginalTitleMatches([]);
      await onRefetch();
    } catch (error: any) {
      toast.error(`Không thể ${editingOutput ? 'cập nhật' : 'thêm'} bài: ` + (error.response?.data?.error || error.message || 'Lỗi không xác định'));
    }
  };

  useEffect(() => {
    if (editingOutput) {
      setAddFormData({
        lesson_name: editingOutput.lesson_name,
        original_title: editingOutput.original_title || '',
        original_link: editingOutput.original_link || '',
        tag: editingOutput.tag || '',
        level: editingOutput.level || '',
        date: editingOutput.date,
        cost: editingOutput.cost || 0,
        status: editingOutput.status || 'pending',
        contest_uploaded: editingOutput.contest_uploaded || '',
        link: editingOutput.link || '',
        assistant_id: editingOutput.assistant_id || undefined,
      });
      if (editingOutput.tag) {
        setSelectedTags(editingOutput.tag.split(',').map((t) => t.trim()).filter(Boolean));
      }
      setIsAddFormOpen(true);
    } else if (isAddFormOpen && !editingOutput && currentUserStaffId && !addFormData.assistant_id) {
      // When opening form for new output (not editing), auto-set assistant_id if not already set
      setAddFormData(prev => ({ ...prev, assistant_id: currentUserStaffId }));
    }
  }, [editingOutput, isAddFormOpen, currentUserStaffId, addFormData.assistant_id]);

  // Update cost preview when cost changes
  useEffect(() => {
    const numericValue = Number(addFormData.cost) || 0;
    const formatted = formatCurrencyVND(numericValue);
    const words = numberToVietnameseText(numericValue);
    setCostPreview({ formatted, words });
  }, [addFormData.cost]);

  // Check for duplicate titles with prefix matching
  useEffect(() => {
    if (!addFormData.lesson_name.trim()) {
      setDuplicateTitleMatches([]);
      return;
    }
    const normalizedInput = addFormData.lesson_name.trim().toLowerCase();
    const matches = outputs
      .filter((o) => {
        if (editingOutput && o.id === editingOutput.id) return false;
        const name = (o.lesson_name || '').trim().toLowerCase();
        const original = (o.original_title || '').trim().toLowerCase();
        return name.startsWith(normalizedInput) || original.startsWith(normalizedInput);
      })
      .map((o) => ({
        title: o.lesson_name || '-',
        originalTitle: o.original_title || '-',
        level: getDisplayLevel(o.level),
        tag: o.tag || '-',
        createdAt: o.created_at || o.date || '-',
      }));
    setDuplicateTitleMatches(matches);
  }, [addFormData.lesson_name, outputs, editingOutput]);

  useEffect(() => {
    if (!addFormData.original_title.trim()) {
      setDuplicateOriginalTitleMatches([]);
      return;
    }
    const normalizedInput = addFormData.original_title.trim().toLowerCase();
    const matches = outputs
      .filter((o) => {
        if (editingOutput && o.id === editingOutput.id) return false;
        const name = (o.lesson_name || '').trim().toLowerCase();
        const original = (o.original_title || '').trim().toLowerCase();
        return original.startsWith(normalizedInput) || name.startsWith(normalizedInput);
      })
      .map((o) => ({
        title: o.lesson_name || '-',
        originalTitle: o.original_title || '-',
        level: getDisplayLevel(o.level),
        tag: o.tag || '-',
        createdAt: o.created_at || o.date || '-',
      }));
    setDuplicateOriginalTitleMatches(matches);
  }, [addFormData.original_title, outputs, editingOutput]);

  const canManage = isAdmin || isAssistant || hasLessonPlanRole;
  // Chỉ admin, assistant và accountant mới có thể bulk update status - lesson_plan role không được phép
  const canBulkUpdate = isAdmin || isAssistant || hasAccountantRole;
  // Chỉ admin, assistant và accountant mới có thể chỉnh sửa payment status - lesson_plan role không được phép
  const canEditPaymentStatus = isAdmin || isAssistant || hasAccountantRole;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [filterTagSearchInput, setFilterTagSearchInput] = useState('');
  const [filterTagDropdownOpen, setFilterTagDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const filterTagDropdownRef = useRef<HTMLDivElement>(null);

  // Filter tags with prefix matching for filter
  // Union PREDEFINED_TAGS + dynamic tags from outputs (like backup)
  const filteredFilterTags = useMemo(() => {
    // Get all unique tags from outputs
    const allTags = outputs.map((o) => o.tag).filter(Boolean);
    const uniqueTags = new Set<string>();
    allTags.forEach((tag) => {
      tag.split(',').forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) uniqueTags.add(trimmed);
      });
    });
    // Union PREDEFINED_TAGS and dynamic tags
    const availableTags = Array.from(new Set([...PREDEFINED_TAGS, ...uniqueTags])).sort();
    
    const searchLower = filterTagSearchInput.toLowerCase().trim();
    
    // Filter and map tags with level info (like backup)
    const filtered = availableTags
      .filter(tag => !selectedFilterTags.includes(tag))
      .map(tag => {
        const tagLower = tag.toLowerCase();
        const startsWith = tagLower.startsWith(searchLower);
        const contains = tagLower.includes(searchLower);
        return {
          tag,
          level: getTagLevel(tag),
          startsWith,
          contains,
          index: startsWith ? tagLower.indexOf(searchLower) : (contains ? tagLower.indexOf(searchLower) : -1)
        };
      })
      .filter(item => item.contains)
      .sort((a, b) => {
        if (a.startsWith && !b.startsWith) return -1;
        if (!a.startsWith && b.startsWith) return 1;
        if (a.level !== b.level) return a.level - b.level;
        return a.index - b.index;
      });
    
    return filtered;
  }, [filterTagSearchInput, selectedFilterTags, outputs]);

  // Popular tags for filter (when no search term)
  const popularFilterTags = useMemo(() => {
    const popular = ['DFS', 'BFS', 'DP', 'Segment Tree', 'Greedy', 'Binary Search', 'Graph', 'Tree'];
    return popular.filter(t => !selectedFilterTags.includes(t) && PREDEFINED_TAGS.includes(t)).slice(0, 6);
  }, [selectedFilterTags]);

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterTagDropdownRef.current && !filterTagDropdownRef.current.contains(event.target as Node)) {
        setFilterTagDropdownOpen(false);
      }
    };
    if (filterTagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [filterTagDropdownOpen]);

  // Apply filters to outputs
  const filteredOutputs = useMemo(() => {
    let filtered = [...outputs];

    // Search filter
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          (o.lesson_name || '').toLowerCase().includes(search) ||
          (o.tag || '').toLowerCase().includes(search) ||
          (o.original_title || '').toLowerCase().includes(search)
      );
    }

    // Tag filter (multi-select)
    if (selectedFilterTags.length > 0) {
      filtered = filtered.filter((o) => {
        const outputTags = (o.tag || '').split(',').map((t) => t.trim()).filter(Boolean);
        return selectedFilterTags.some((selectedTag) =>
          outputTags.some((outputTag) => outputTag.toLowerCase() === selectedTag.toLowerCase())
        );
      });
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    // Staff filter
    if (staffFilter) {
      filtered = filtered.filter((o) => o.assistant_id === staffFilter);
    }

    // Date range filter
    if (dateFromFilter) {
      filtered = filtered.filter((o) => !o.date || o.date >= dateFromFilter);
    }
    if (dateToFilter) {
      filtered = filtered.filter((o) => !o.date || o.date <= dateToFilter);
    }

    // Month filter: Hide outputs without date when filtering by month
    // (Month filter is applied at API level, but we need to filter out outputs without date)
    if (selectedMonth) {
      filtered = filtered.filter((o) => {
        // If output has no date, don't show it when filtering by month
        if (!o.date && !o.created_at) return false;
        return true;
      });
    }

    return filtered;
  }, [outputs, searchFilter, selectedFilterTags, statusFilter, staffFilter, dateFromFilter, dateToFilter, selectedMonth]);

  const handleClearFilters = () => {
    setSearchFilter('');
    setSelectedFilterTags([]);
    setFilterTagSearchInput('');
    setStatusFilter('');
    setStaffFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    // Reset month filter to current month
    if (onResetMonth) {
      onResetMonth();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      {/* Filter Controls */}
      <div
        className="card"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-4)',
        }}
      >
        <div
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Bộ lọc nhanh</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transition: 'transform 0.2s ease', transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>{filtersOpen ? 'Thu gọn' : 'Mở bộ lọc'}</span>
          </div>
        </div>

        {filtersOpen && (
          <div style={{ marginTop: 'var(--spacing-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
            {/* Search */}
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                Tìm kiếm
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '12px',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                    pointerEvents: 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tìm theo tên hoặc tag"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Tag Filter */}
            <div style={{ flex: '1 1 280px' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                Tag
              </label>
              <div className="tag-select-container" ref={filterTagDropdownRef} style={{ position: 'relative' }}>
                <div className="tag-input-wrapper" onClick={() => setFilterTagDropdownOpen(true)}>
                  <div className="selected-tags-container">
                    {selectedFilterTags.length > 0 && (
                      <span className="tag-count-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        </svg>
                        {selectedFilterTags.length}
                      </span>
                    )}
                    {selectedFilterTags.map((tag) => (
                      <span
                        key={tag}
                        className="tag-badge-selected"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFilterTags(selectedFilterTags.filter((t) => t !== tag));
                        }}
                      >
                        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.9 }}>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="tag-search-input"
                    placeholder="Tìm kiếm và chọn tag..."
                    autoComplete="off"
                    value={filterTagSearchInput}
                    onChange={(e) => {
                      setFilterTagSearchInput(e.target.value);
                      setFilterTagDropdownOpen(true);
                    }}
                    onFocus={() => setFilterTagDropdownOpen(true)}
                  />
                </div>
                {filterTagDropdownOpen && (
                  <div
                    className="tag-dropdown"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 1000,
                      marginTop: '4px',
                    }}
                  >
                    {(() => {
                      const searchLower = filterTagSearchInput.toLowerCase().trim();
                      
                      if (filteredFilterTags.length === 0) {
                        if (searchLower) {
                          return (
                            <div className="tag-dropdown-empty" style={{ padding: 'var(--spacing-5)', textAlign: 'center', color: 'var(--muted)' }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, margin: '0 auto var(--spacing-3)', display: 'block' }}>
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              </svg>
                              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>Không tìm thấy tag nào</p>
                              <p style={{ margin: 'var(--spacing-2) 0 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>Thử tìm kiếm với từ khóa khác</p>
                            </div>
                          );
                        } else {
                          // Show popular tags when empty
                          return (
                            <>
                              {popularFilterTags.length > 0 && (
                                <div style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tags phổ biến</span>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                                    {popularFilterTags.map((tag, idx) => (
                                      <span
                                        key={`filter-popular-${tag}-${idx}`}
                                        className="tag-suggestion-chip"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!selectedFilterTags.includes(tag)) {
                                            setSelectedFilterTags([...selectedFilterTags, tag]);
                                            setFilterTagSearchInput('');
                                            setFilterTagDropdownOpen(false);
                                          }
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '4px 10px',
                                          fontSize: 'var(--font-size-xs)',
                                          background: 'var(--bg)',
                                          border: '1px solid var(--border)',
                                          borderRadius: 'var(--radius)',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          color: 'var(--text)',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = 'var(--primary)';
                                          e.currentTarget.style.color = 'white';
                                          e.currentTarget.style.borderColor = 'var(--primary)';
                                          e.currentTarget.style.transform = 'scale(1.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = 'var(--bg)';
                                          e.currentTarget.style.color = 'var(--text)';
                                          e.currentTarget.style.borderColor = 'var(--border)';
                                          e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ padding: 'var(--spacing-3)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--font-size-xs)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, marginRight: '4px', verticalAlign: 'middle' }}>
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                Gõ để tìm kiếm tag...
                              </div>
                            </>
                          );
                        }
                      }
                      
                      // Group by level if no search term
                      const levelGroups: Record<string | number, typeof filteredFilterTags> = {};
                      filteredFilterTags.forEach(item => {
                        const level = item.level >= 0 ? item.level : 'other';
                        if (!levelGroups[level]) levelGroups[level] = [];
                        levelGroups[level].push(item);
                      });
                      
                      const levelNames: Record<string | number, string> = {
                        0: 'Level 0: Nền tảng',
                        1: 'Level 1: Thuật toán cơ bản',
                        2: 'Level 2: Tìm kiếm & Toán',
                        3: 'Level 3: Thuật toán quan trọng',
                        4: 'Level 4: Nâng cao',
                        5: 'Level 5: Chuyên sâu',
                        other: 'Khác'
                      };
                      
                      const levelColors: Record<string | number, string> = {
                        0: 'rgba(59, 130, 246, 0.1)',
                        1: 'rgba(34, 197, 94, 0.1)',
                        2: 'rgba(251, 191, 36, 0.1)',
                        3: 'rgba(168, 85, 247, 0.1)',
                        4: 'rgba(239, 68, 68, 0.1)',
                        5: 'rgba(236, 72, 153, 0.1)',
                        other: 'rgba(107, 114, 128, 0.1)'
                      };
                      
                      // Render grouped or flat list
                      if (!searchLower && Object.keys(levelGroups).length > 1) {
                        // Grouped view
                        return (
                          <div className="tag-dropdown-list">
                            {Object.keys(levelGroups).sort((a, b) => {
                              if (a === 'other') return 1;
                              if (b === 'other') return -1;
                              return Number(a) - Number(b);
                            }).map((level) => {
                              const tags = levelGroups[level].slice(0, 8);
                              return (
                                <div key={level} className="tag-level-group" data-level={level}>
                                  <div className="tag-level-header" style={{ padding: 'var(--spacing-2) var(--spacing-3)', background: levelColors[level], borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{levelNames[level]}</span>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>({tags.length})</span>
                                  </div>
                                  {tags.map((item, idx) => {
                                    const tag = item.tag;
                                    return (
                                      <div
                                        key={`filter-${level}-${tag}-${idx}`}
                                        className="tag-dropdown-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!selectedFilterTags.includes(tag)) {
                                            setSelectedFilterTags([...selectedFilterTags, tag]);
                                            setFilterTagSearchInput('');
                                            setFilterTagDropdownOpen(false);
                                          }
                                        }}
                                        style={{
                                          padding: 'var(--spacing-2) var(--spacing-3)',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          borderBottom: '1px solid var(--border)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 'var(--spacing-2)',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = 'var(--bg)';
                                          e.currentTarget.style.transform = 'translateX(2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = '';
                                          e.currentTarget.style.transform = 'translateX(0)';
                                        }}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0, opacity: 0.6 }}>
                                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                          <line x1="7" y1="7" x2="7.01" y2="7" />
                                        </svg>
                                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }}>{tag}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // Flat list view (when searching)
                        return (
                          <div className="tag-dropdown-list">
                            <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)' }}>
                                {filteredFilterTags.length} kết quả
                              </span>
                              {filteredFilterTags.length > 15 && (
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>Hiển thị 15 đầu tiên</span>
                              )}
                            </div>
                            {filteredFilterTags.slice(0, 15).map((item, idx) => {
                              const tag = item.tag;
                              let displayTag = tag;
                              if (searchLower) {
                                const tagLower = tag.toLowerCase();
                                const matchIndex = tagLower.indexOf(searchLower);
                                if (matchIndex !== -1) {
                                  const before = tag.substring(0, matchIndex);
                                  const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                                  const after = tag.substring(matchIndex + searchLower.length);
                                  displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                                }
                              }
                              return (
                                <div
                                  key={`filter-flat-${tag}-${idx}`}
                                  className="tag-dropdown-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!selectedFilterTags.includes(tag)) {
                                      setSelectedFilterTags([...selectedFilterTags, tag]);
                                      setFilterTagSearchInput('');
                                      setFilterTagDropdownOpen(false);
                                    }
                                  }}
                                  style={{
                                    padding: 'var(--spacing-3)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-2)',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--bg)';
                                    e.currentTarget.style.transform = 'translateX(2px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                  }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                    <line x1="7" y1="7" x2="7.01" y2="7" />
                                  </svg>
                                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }} dangerouslySetInnerHTML={{ __html: displayTag }} />
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                Trạng thái
              </label>
              <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="paid">Đã thanh toán</option>
                <option value="pending">Chưa thanh toán</option>
                <option value="deposit">Cọc</option>
              </select>
            </div>

            {/* Staff Filter */}
            {lessonPlanStaff && lessonPlanStaff.length > 0 && (
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                  Nhân sự
                </label>
                <select className="form-control" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                  <option value="">Tất cả nhân sự</option>
                  {lessonPlanStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName || staff.full_name || staff.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                Khoảng ngày
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
                <input
                  type="date"
                  className="form-control"
                  placeholder="Từ ngày"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                />
                <input
                  type="date"
                  className="form-control"
                  placeholder="Đến ngày"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            <div style={{ flex: '0 0 140px' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                &nbsp;
              </label>
              <button type="button" className="btn btn-outline" onClick={handleClearFilters} style={{ width: '100%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Xóa lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Output Form - Collapsible */}
      {canManage && (
        <div className="card" style={{ padding: 'var(--spacing-5)', marginBottom: 'var(--spacing-4)', border: '2px dashed var(--border)' }}>
          <div
            onClick={() => setIsAddFormOpen(!isAddFormOpen)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isAddFormOpen ? 'var(--spacing-4)' : 0,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--font-size-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
                pointerEvents: 'none',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              Thêm bài mới
            </h3>
            <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'transform 0.2s ease',
                  transform: isAddFormOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {isAddFormOpen && (
            <form onSubmit={handleAddSubmit}>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                  Tên bài <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Tên bài giáo án"
                  value={addFormData.lesson_name}
                  onChange={(e) => setAddFormData({ ...addFormData, lesson_name: e.target.value })}
                />
                {duplicateTitleMatches.length > 0 && (
                  <div style={{ marginTop: 'var(--spacing-2)' }}>
                    <div style={{ color: '#d97706', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
                      ⚠️ Có bài trùng tiền tố tên bài hoặc tên gốc
                    </div>
                    {duplicateTitleMatches.map((match, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid #fcd34d',
                          backgroundColor: '#fef9c3',
                          padding: 'var(--spacing-2)',
                          borderRadius: 'var(--radius)',
                          marginTop: 'var(--spacing-2)',
                          fontSize: '0.875rem',
                          color: '#374151',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-2)' }}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }}
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>{match.title}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--spacing-1) var(--spacing-2)', fontSize: '0.8125rem' }}>
                              <span style={{ color: '#6b7280' }}>Tên gốc:</span>
                              <span>{match.originalTitle}</span>
                              <span style={{ color: '#6b7280' }}>Level:</span>
                              <span>{match.level}</span>
                              <span style={{ color: '#6b7280' }}>Tag:</span>
                              <span>{match.tag}</span>
                              <span style={{ color: '#6b7280' }}>Ngày tạo:</span>
                              <span>{formatDate(match.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Tên gốc</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: Light - VNOI, DOSI - Sưu tầm, DOIDAU - Unicorns"
                  value={addFormData.original_title}
                  onChange={(e) => setAddFormData({ ...addFormData, original_title: e.target.value })}
                />
                <small className="text-muted" style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: '0.875rem' }}>
                  Quy tắc ghi tên gốc: Tên bài gốc + nguồn
                </small>
                {duplicateOriginalTitleMatches.length > 0 && (
                  <div style={{ marginTop: 'var(--spacing-2)' }}>
                    <div style={{ color: '#d97706', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
                      ⚠️ Có bài trùng tiền tố tên bài hoặc tên gốc
                    </div>
                    {duplicateOriginalTitleMatches.map((match, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid #fcd34d',
                          backgroundColor: '#fef9c3',
                          padding: 'var(--spacing-2)',
                          borderRadius: 'var(--radius)',
                          marginTop: 'var(--spacing-2)',
                          fontSize: '0.875rem',
                          color: '#374151',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-2)' }}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }}
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>{match.title}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--spacing-1) var(--spacing-2)', fontSize: '0.8125rem' }}>
                              <span style={{ color: '#6b7280' }}>Tên gốc:</span>
                              <span>{match.originalTitle}</span>
                              <span style={{ color: '#6b7280' }}>Level:</span>
                              <span>{match.level}</span>
                              <span style={{ color: '#6b7280' }}>Tag:</span>
                              <span>{match.tag}</span>
                              <span style={{ color: '#6b7280' }}>Ngày tạo:</span>
                              <span>{formatDate(match.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Link gốc</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://..."
                  value={addFormData.original_link || ''}
                  onChange={(e) => setAddFormData({ ...addFormData, original_link: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 'var(--spacing-3)' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Tag</label>
                  <div style={{ position: 'relative' }}>
                    <div className="tag-input-wrapper" onClick={() => setTagDropdownOpen(true)}>
                      <div className="selected-tags-container">
                        {selectedTags.length > 0 && (
                          <span className="tag-count-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            </svg>
                            {selectedTags.length}
                          </span>
                        )}
                        {selectedTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="tag-badge-selected"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTags(selectedTags.filter((_, i) => i !== idx));
                            }}
                          >
                            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.9 }}>
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="tag-search-input"
                        placeholder="Tìm kiếm và chọn tag..."
                        autoComplete="off"
                        value={tagSearchInput}
                        onChange={(e) => {
                          setTagSearchInput(e.target.value);
                          setTagDropdownOpen(true);
                        }}
                        onFocus={() => setTagDropdownOpen(true)}
                      />
                    </div>
                    {tagDropdownOpen && (
                      <div
                        className="tag-dropdown"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          boxShadow: 'var(--shadow-lg)',
                          zIndex: 1000,
                          marginTop: '4px',
                        }}
                        onMouseLeave={() => setTagDropdownOpen(false)}
                      >
                        {filteredTags.length === 0 ? (
                          tagSearchInput.trim() ? (
                            <div className="tag-dropdown-empty" style={{ padding: 'var(--spacing-5)', textAlign: 'center', color: 'var(--muted)' }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, margin: '0 auto var(--spacing-3)', display: 'block' }}>
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              </svg>
                              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>Không tìm thấy tag nào</p>
                              <p style={{ margin: 'var(--spacing-2) 0 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>Thử tìm kiếm với từ khóa khác</p>
                            </div>
                          ) : (
                            <>
                              {popularTags.length > 0 && (
                                <div style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tags phổ biến</span>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                                    {popularTags.map((tag, idx) => (
                                      <span
                                        key={`add-popular-${tag}-${idx}`}
                                        className="tag-suggestion-chip"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!selectedTags.includes(tag)) {
                                            setSelectedTags([...selectedTags, tag]);
                                            setTagSearchInput('');
                                            setTagDropdownOpen(false);
                                          }
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '4px 10px',
                                          fontSize: 'var(--font-size-xs)',
                                          background: 'var(--bg)',
                                          border: '1px solid var(--border)',
                                          borderRadius: 'var(--radius)',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          color: 'var(--text)',
                                        }}
                                        onMouseEnter={(e) => {
                                          const el = e.currentTarget;
                                          el.style.background = 'var(--primary)';
                                          el.style.color = 'white';
                                          el.style.borderColor = 'var(--primary)';
                                          el.style.transform = 'scale(1.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                          const el = e.currentTarget;
                                          el.style.background = 'var(--bg)';
                                          el.style.color = 'var(--text)';
                                          el.style.borderColor = 'var(--border)';
                                          el.style.transform = 'scale(1)';
                                        }}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ padding: 'var(--spacing-3)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--font-size-xs)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, marginRight: '4px', verticalAlign: 'middle' }}>
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                Gõ để tìm kiếm tag...
                              </div>
                            </>
                          )
                        ) : (
                          (() => {
                            // Group by level if no search term
                            const levelGroups: Record<string | number, typeof filteredTags> = {};
                            filteredTags.forEach(item => {
                              const level = item.level >= 0 ? item.level : 'other';
                              if (!levelGroups[level]) levelGroups[level] = [];
                              levelGroups[level].push(item);
                            });

                            const levelNames: Record<string | number, string> = {
                              0: 'Level 0: Nền tảng',
                              1: 'Level 1: Thuật toán cơ bản',
                              2: 'Level 2: Tìm kiếm & Toán',
                              3: 'Level 3: Thuật toán quan trọng',
                              4: 'Level 4: Nâng cao',
                              5: 'Level 5: Chuyên sâu',
                              other: 'Khác'
                            };

                            const levelColors: Record<string | number, string> = {
                              0: 'rgba(59, 130, 246, 0.1)',
                              1: 'rgba(34, 197, 94, 0.1)',
                              2: 'rgba(251, 191, 36, 0.1)',
                              3: 'rgba(168, 85, 247, 0.1)',
                              4: 'rgba(239, 68, 68, 0.1)',
                              5: 'rgba(236, 72, 153, 0.1)',
                              other: 'rgba(107, 114, 128, 0.1)'
                            };

                            // Helper to highlight match in tag name
                            const highlightMatch = (tag: string, search: string) => {
                              if (!search.trim()) return tag;
                              const tagLower = tag.toLowerCase();
                              const searchLower = search.toLowerCase();
                              const matchIndex = tagLower.indexOf(searchLower);
                              if (matchIndex === -1) return tag;
                              const before = tag.substring(0, matchIndex);
                              const match = tag.substring(matchIndex, matchIndex + search.length);
                              const after = tag.substring(matchIndex + search.length);
                              return (
                                <>
                                  {before}
                                  <strong style={{ color: 'var(--primary)', fontWeight: 600 }}>{match}</strong>
                                  {after}
                                </>
                              );
                            };

                            // Render grouped or flat list
                            if (!tagSearchInput.trim() && Object.keys(levelGroups).length > 1) {
                              // Grouped view
                              return (
                                <div className="tag-dropdown-list">
                                  {Object.keys(levelGroups).sort((a, b) => {
                                    if (a === 'other') return 1;
                                    if (b === 'other') return -1;
                                    return Number(a) - Number(b);
                                  }).map(level => {
                                    const tags = levelGroups[level].slice(0, 8);
                                    return (
                                      <div key={level} className="tag-level-group" data-level={level}>
                                        <div
                                          className="tag-level-header"
                                          style={{
                                            padding: 'var(--spacing-2) var(--spacing-3)',
                                            background: levelColors[level],
                                            borderBottom: '1px solid var(--border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-2)',
                                          }}
                                        >
                                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {levelNames[level]}
                                          </span>
                                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>
                                            ({tags.length})
                                          </span>
                                        </div>
                                        {tags.map((item, idx) => (
                                          <div
                                            key={`exercise-${level}-${item.tag}-${idx}`}
                                            className="tag-dropdown-item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!selectedTags.includes(item.tag)) {
                                                setSelectedTags([...selectedTags, item.tag]);
                                                setTagSearchInput('');
                                                setTagDropdownOpen(false);
                                              }
                                            }}
                                            style={{
                                              padding: 'var(--spacing-2) var(--spacing-3)',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s ease',
                                              borderBottom: '1px solid var(--border)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 'var(--spacing-2)',
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = 'var(--bg)';
                                              e.currentTarget.style.transform = 'translateX(2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = '';
                                              e.currentTarget.style.transform = 'translateX(0)';
                                            }}
                                          >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0, opacity: 0.6 }}>
                                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                              <line x1="7" y1="7" x2="7.01" y2="7" />
                                            </svg>
                                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }}>
                                              {item.tag}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } else {
                              // Flat list view (when searching)
                              return (
                                <div className="tag-dropdown-list">
                                  <div
                                    style={{
                                      padding: 'var(--spacing-2) var(--spacing-3)',
                                      borderBottom: '1px solid var(--border)',
                                      background: 'var(--bg)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}
                                  >
                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--muted)' }}>
                                      {filteredTags.length} kết quả
                                    </span>
                                    {filteredTags.length > 15 && (
                                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>
                                        Hiển thị 15 đầu tiên
                                      </span>
                                    )}
                                  </div>
                                  {filteredTags.slice(0, 15).map((item, idx) => (
                                    <div
                                      key={`add-flat-${item.tag}-${idx}`}
                                      className="tag-dropdown-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!selectedTags.includes(item.tag)) {
                                          setSelectedTags([...selectedTags, item.tag]);
                                          setTagSearchInput('');
                                          setTagDropdownOpen(false);
                                        }
                                      }}
                                      style={{
                                        padding: 'var(--spacing-3)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        borderBottom: '1px solid var(--border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-2)',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--bg)';
                                        e.currentTarget.style.transform = 'translateX(2px)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '';
                                        e.currentTarget.style.transform = 'translateX(0)';
                                      }}
                                    >
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                        <line x1="7" y1="7" x2="7.01" y2="7" />
                                      </svg>
                                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }}>
                                        {highlightMatch(item.tag, tagSearchInput)}
                                      </span>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                      </svg>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                          })()
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Level</label>
                  <select
                    className="form-control"
                    value={addFormData.level}
                    onChange={(e) => setAddFormData({ ...addFormData, level: e.target.value })}
                  >
                    <option value="">-- Chọn level --</option>
                    {LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 'var(--spacing-3)' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                    Ngày <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    required
                    value={addFormData.date}
                    onChange={(e) => setAddFormData({ ...addFormData, date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Chi phí</label>
                  <CurrencyInput
                    value={addFormData.cost || 0}
                    onChange={(value) => setAddFormData({ ...addFormData, cost: value })}
                    showHint={false}
                  />
                  <small className="cost-preview text-muted" style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text)' }}>{costPreview.formatted}</div>
                    <div style={{ color: 'var(--muted)', marginTop: '2px' }}>{costPreview.words}</div>
                  </small>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Trạng thái</label>
                <select
                  className="form-control"
                  value={addFormData.status}
                  onChange={(e) => setAddFormData({ ...addFormData, status: e.target.value as any })}
                >
                  <option value="pending">Chưa thanh toán</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="deposit">Cọc</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Contest</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="VD: Bài này đã được đưa vào contest ABC ngày 12/11..."
                  value={addFormData.contest_uploaded}
                  onChange={(e) => setAddFormData({ ...addFormData, contest_uploaded: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Link</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://example.com/lesson"
                  value={addFormData.link}
                  onChange={(e) => setAddFormData({ ...addFormData, link: e.target.value })}
                />
              </div>

              {isAdmin && lessonPlanStaff && lessonPlanStaff.length > 0 && (
                <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Người phụ trách</label>
                  <select
                    className="form-control"
                    value={addFormData.assistant_id || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, assistant_id: e.target.value || undefined })}
                  >
                    <option value="">-- Chọn người phụ trách --</option>
                    {lessonPlanStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName || staff.full_name || staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setIsAddFormOpen(false);
                    setEditingOutput(null);
                    setSelectedTags([]);
                    setTagSearchInput('');
                    setAddFormData({
                      lesson_name: '',
                      original_title: '',
                      original_link: '',
                      tag: '',
                      level: '',
                      date: new Date().toISOString().split('T')[0],
                      cost: 0,
                      status: 'pending',
                      contest_uploaded: '',
                      link: '',
                      assistant_id: undefined,
                    });
                    setCostPreview({ formatted: '0 đ', words: 'Không đồng' });
                    setDuplicateTitleWarning('');
                    setDuplicateOriginalTitleWarning('');
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingOutput ? 'Cập nhật bài' : 'Thêm bài'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Bài giáo án đã làm</h3>
          {/* Month Navigation */}
          <div className="session-month-nav" style={{ position: 'relative' }}>
            <button
              type="button"
              className="session-month-btn"
              onClick={() => onMonthChange(-1)}
              title="Tháng trước"
            >
              ◀
            </button>
            <button
              type="button"
              className="session-month-label-btn"
              onClick={onMonthPopupToggle}
              title="Chọn tháng/năm"
            >
              <span className="session-month-label">Tháng {monthLabel}</span>
            </button>
            <button
              type="button"
              className="session-month-btn"
              onClick={() => onMonthChange(1)}
              title="Tháng sau"
            >
              ▶
            </button>
            {monthPopupOpen && (
              <div className="session-month-popup">
                <div className="session-month-popup-header">
                  <button
                    type="button"
                    className="session-month-year-btn"
                    onClick={() => onYearChange(-1)}
                  >
                    ‹
                  </button>
                  <span className="session-month-year-label">{year}</span>
                  <button
                    type="button"
                    className="session-month-year-btn"
                    onClick={() => onYearChange(1)}
                  >
                    ›
                  </button>
                </div>
                <div className="session-month-grid">
                  {monthNames.map((label, idx) => {
                    const val = String(idx + 1).padStart(2, '0');
                    const isActive = val === String(monthNum).padStart(2, '0');
                    return (
                      <button
                        key={val}
                        type="button"
                        className={`session-month-cell${isActive ? ' active' : ''}`}
                        onClick={() => onMonthSelect(val)}
                        data-month={val}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Bulk Actions */}
          {canBulkUpdate && selectedOutputIds.length > 0 && (
            <div
              className="bulk-actions"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}
            >
              <span className="selected-count" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                Đã chọn: {selectedOutputIds.length} bài
              </span>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setBulkStatusModalOpen(true)}
                style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Chuyển trạng thái thanh toán
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => onSelectedOutputIdsChange([])}
                style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)' }}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table-striped" id="outputsTable" style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead>
              <tr>
                {canBulkUpdate && (
                  <th style={{ width: '50px', padding: 'var(--spacing-2)', textAlign: 'center', borderBottom: '2px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      checked={selectedOutputIds.length === filteredOutputs.length && filteredOutputs.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                    />
                  </th>
                )}
                <th style={{ width: '180px', padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tag</th>
                <th style={{ width: '120px', padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Level</th>
                <th style={{ width: 'auto', minWidth: '250px', padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tên bài</th>
                <th style={{ width: '150px', padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                <th style={{ width: '200px', padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Contest</th>
                <th style={{ width: '120px', padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Link</th>
                {canManage && (
                  <th style={{ width: '50px', padding: 'var(--spacing-3)', textAlign: 'center', borderBottom: '2px solid var(--border)' }}></th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredOutputs.length > 0 ? (
                filteredOutputs
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .map((output) => (
                    <tr
                      key={output.id}
                      data-output-id={output.id}
                      className={canBulkUpdate ? 'overview-table-row' : ''}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onClick={(e) => {
                        handleRowClick(output.id, e);
                      }}
                    >
                    {canBulkUpdate && (
                      <td style={{ padding: 'var(--spacing-2)', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedOutputIds.includes(output.id)}
                          onChange={(e) => handleSelectOutput(output.id, e.target.checked)}
                          style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                        />
                      </td>
                    )}
                    <td style={{ padding: 'var(--spacing-3)', width: '180px', minWidth: '180px' }}>
                      {output.tag ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                          {(output.tag || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                              {tag}
                            </span>
                          ))}
                          {(output.tag || '').split(',').filter(Boolean).length > 2 && (
                            <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                              +{(output.tag || '').split(',').filter(Boolean).length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                          -
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--spacing-3)', width: '120px', minWidth: '120px' }}>
                      {output.level ? (
                        <span
                          className="badge"
                          style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            fontSize: 'var(--font-size-xs)',
                            padding: '4px 10px',
                            fontWeight: '500',
                          }}
                        >
                          {getDisplayLevel(output.level)}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                          -
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <strong style={{ color: 'var(--text)', fontWeight: '500' }}>{output.lesson_name || '-'}</strong>
                    </td>
                    <td style={{ padding: 'var(--spacing-3)', width: '150px', minWidth: '150px' }}>
                      {output.status ? (
                        <span
                          className={`badge ${
                            output.status === 'paid'
                              ? 'badge-success'
                              : output.status === 'deposit'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                          style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', fontWeight: '500' }}
                        >
                          {output.status === 'paid' ? 'Đã thanh toán' : output.status === 'deposit' ? 'Cọc' : 'Chưa thanh toán'}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                          -
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--spacing-3)', width: '200px', minWidth: '200px' }}>
                      {output.contest_uploaded ? (
                        <span
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            maxWidth: '100%',
                          }}
                          title={output.contest_uploaded}
                        >
                          {output.contest_uploaded}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                          -
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      {output.link ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(output.link || '');
                              toast.success('Đã sao chép link');
                            }}
                            title="Sao chép link"
                            style={{
                              width: '28px',
                              height: '28px',
                              padding: 0,
                              transition: 'all 0.2s ease',
                              border: '1px solid var(--border)',
                              background: 'var(--bg)',
                              borderRadius: 'var(--radius)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                            </svg>
                          </button>
                          <a
                            href={output.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-icon"
                            title="Mở link"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '28px',
                              height: '28px',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                          -
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td style={{ padding: 'var(--spacing-2)', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-delete-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOutput(output.id);
                          }}
                          title="Xóa"
                          style={{
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderRadius: 'var(--radius)',
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6 + (canBulkUpdate ? 1 : 0) + (canManage ? 1 : 0)}
                    className="text-center text-muted py-4"
                    style={{
                      padding: 'var(--spacing-8)',
                      textAlign: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ opacity: 0.3, color: 'var(--muted)' }}
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>Chưa có bài nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Status Update Modal */}
      {bulkStatusModalOpen && (
        <Modal
          isOpen={bulkStatusModalOpen}
          onClose={() => setBulkStatusModalOpen(false)}
          title="Chuyển trạng thái thanh toán"
        >
          <div style={{ padding: 'var(--spacing-4)' }}>
            <p style={{ margin: '0 0 var(--spacing-4) 0', fontSize: 'var(--font-size-base)', color: 'var(--text)' }}>
              Chọn trạng thái thanh toán cho <strong>{selectedOutputIds.length}</strong> bài đã chọn:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              <button
                type="button"
                className="btn btn-block"
                onClick={() => handleBulkUpdateStatus('paid')}
                style={{
                  justifyContent: 'flex-start',
                  padding: 'var(--spacing-3)',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#047857',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Đã thanh toán
              </button>
              <button
                type="button"
                className="btn btn-block"
                onClick={() => handleBulkUpdateStatus('deposit')}
                style={{
                  justifyContent: 'flex-start',
                  padding: 'var(--spacing-3)',
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  color: '#92400e',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Cọc
              </button>
              <button
                type="button"
                className="btn btn-block"
                onClick={() => handleBulkUpdateStatus('pending')}
                style={{
                  justifyContent: 'flex-start',
                  padding: 'var(--spacing-3)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#991b1b',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Chưa thanh toán
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Output Modal */}
      {isEditOutputModalOpen && editingOutputId && (
        <EditOutputModal
          outputId={editingOutputId}
          outputs={outputs}
          lessonPlanStaff={lessonPlanStaff}
          isAdmin={isAdmin}
          isAssistant={isAssistant}
          hasAccountantRole={hasAccountantRole}
          hasLessonPlanRole={hasLessonPlanRole}
          onClose={() => {
            setIsEditOutputModalOpen(false);
            setEditingOutputId(null);
          }}
          onRefetch={onRefetch}
        />
      )}
    </div>
  );
}

// Edit Output Modal Component
function EditOutputModal({
  outputId,
  outputs,
  lessonPlanStaff,
  isAdmin,
  isAssistant,
  hasAccountantRole,
  hasLessonPlanRole,
  onClose,
  onRefetch,
}: {
  outputId: string;
  outputs: LessonOutput[];
  lessonPlanStaff: any[];
  isAdmin: boolean;
  isAssistant: boolean;
  hasAccountantRole: boolean;
  hasLessonPlanRole: boolean;
  onClose: () => void;
  onRefetch: () => Promise<void>;
}) {
  const output = outputs.find((o) => o.id === outputId);
  const [formData, setFormData] = useState<LessonOutputFormData>({
    lesson_name: output?.lesson_name || '',
    original_title: output?.original_title || '',
    original_link: output?.original_link || '',
    tag: output?.tag || '',
    level: output?.level || '',
    date: output?.date || new Date().toISOString().split('T')[0],
    cost: output?.cost || 0,
    status: output?.status || 'pending',
    contest_uploaded: output?.contest_uploaded || '',
    link: output?.link || '',
    assistant_id: output?.assistant_id || undefined,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [costPreview, setCostPreview] = useState({ formatted: '0 đ', words: 'Không đồng' });
  const [duplicateTitleMatches, setDuplicateTitleMatches] = useState<Array<{
    title: string;
    originalTitle: string;
    level: string;
    tag: string;
    createdAt: string;
  }>>([]);
  const [duplicateOriginalTitleMatches, setDuplicateOriginalTitleMatches] = useState<Array<{
    title: string;
    originalTitle: string;
    level: string;
    tag: string;
    createdAt: string;
  }>>([]);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Filter tags with prefix matching
  const filteredTags = useMemo(() => {
    return filterTagsWithPrefixMatching(tagSearchInput, PREDEFINED_TAGS, selectedTags);
  }, [tagSearchInput, selectedTags]);

  // Popular tags for empty search
  const popularTags = useMemo(() => {
    const popular = ['DFS', 'BFS', 'DP', 'Segment Tree', 'Greedy', 'Binary Search', 'Graph', 'Tree'];
    return popular.filter(t => !selectedTags.includes(t) && PREDEFINED_TAGS.includes(t)).slice(0, 6);
  }, [selectedTags]);

  // Initialize selected tags from output.tag
  useEffect(() => {
    if (output?.tag) {
      setSelectedTags(output.tag.split(',').map((t) => t.trim()).filter(Boolean));
    }
  }, [output]);

  // Update cost preview when cost changes
  useEffect(() => {
    const numericValue = Number(formData.cost) || 0;
    const formatted = formatCurrencyVND(numericValue);
    const words = numberToVietnameseText(numericValue);
    setCostPreview({ formatted, words });
  }, [formData.cost]);

  // Check for duplicate titles with prefix matching
  useEffect(() => {
    if (!formData.lesson_name.trim()) {
      setDuplicateTitleMatches([]);
      return;
    }
    const normalizedInput = formData.lesson_name.trim().toLowerCase();
    const matches = outputs
      .filter((o) => {
        if (o.id === outputId) return false;
        const name = (o.lesson_name || '').trim().toLowerCase();
        const original = (o.original_title || '').trim().toLowerCase();
        return name.startsWith(normalizedInput) || original.startsWith(normalizedInput);
      })
      .map((o) => ({
        title: o.lesson_name || '-',
        originalTitle: o.original_title || '-',
        level: getDisplayLevel(o.level),
        tag: o.tag || '-',
        createdAt: o.created_at || o.date || '-',
      }));
    setDuplicateTitleMatches(matches);
  }, [formData.lesson_name, outputs, outputId]);

  useEffect(() => {
    if (!formData.original_title.trim()) {
      setDuplicateOriginalTitleMatches([]);
      return;
    }
    const normalizedInput = formData.original_title.trim().toLowerCase();
    const matches = outputs
      .filter((o) => {
        if (o.id === outputId) return false;
        const name = (o.lesson_name || '').trim().toLowerCase();
        const original = (o.original_title || '').trim().toLowerCase();
        return original.startsWith(normalizedInput) || name.startsWith(normalizedInput);
      })
      .map((o) => ({
        title: o.lesson_name || '-',
        originalTitle: o.original_title || '-',
        level: getDisplayLevel(o.level),
        tag: o.tag || '-',
        createdAt: o.created_at || o.date || '-',
      }));
    setDuplicateOriginalTitleMatches(matches);
  }, [formData.original_title, outputs, outputId]);


  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    if (tagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tagDropdownOpen]);

  const canEditAllFields = isAdmin || isAssistant;
  const statusOnlyMode = !canEditAllFields && hasAccountantRole;
  // Chặn lesson_plan role chỉnh sửa payment status
  const canEditPaymentStatus = isAdmin || isAssistant || hasAccountantRole;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!output) return;

    try {
      const submitData = {
        ...formData,
        tag: selectedTags.join(','),
      };
      await updateLessonOutput(outputId, submitData);
      toast.success('Đã cập nhật bài đã làm');
      await onRefetch();
      onClose();
    } catch (error: any) {
      toast.error('Không thể cập nhật bài đã làm: ' + (error.response?.data?.error || error.message || 'Lỗi không xác định'));
    }
  };

  if (!output) {
    return null;
  }

  return (
    <Modal title="Sửa bài đã làm" isOpen={true} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
            Tên bài <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            className="form-control"
            required
            placeholder="Tên bài giáo án"
            value={formData.lesson_name}
            onChange={(e) => setFormData({ ...formData, lesson_name: e.target.value })}
            disabled={statusOnlyMode}
          />
          {duplicateTitleMatches.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-2)' }}>
              <div style={{ color: '#d97706', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
                ⚠️ Có bài trùng tiền tố tên bài hoặc tên gốc
              </div>
              {duplicateTitleMatches.map((match, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #fcd34d',
                    backgroundColor: '#fef9c3',
                    padding: 'var(--spacing-2)',
                    borderRadius: 'var(--radius)',
                    marginTop: 'var(--spacing-2)',
                    fontSize: '0.875rem',
                    color: '#374151',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-2)' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>{match.title}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--spacing-1) var(--spacing-2)', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#6b7280' }}>Tên gốc:</span>
                        <span>{match.originalTitle}</span>
                        <span style={{ color: '#6b7280' }}>Level:</span>
                        <span>{match.level}</span>
                        <span style={{ color: '#6b7280' }}>Tag:</span>
                        <span>{match.tag}</span>
                        <span style={{ color: '#6b7280' }}>Ngày tạo:</span>
                        <span>{formatDate(match.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Tên gốc</label>
          <input
            type="text"
            className="form-control"
            placeholder="VD: Light - VNOI, DOSI - Sưu tầm, DOIDAU - Unicorns"
            value={formData.original_title}
            onChange={(e) => setFormData({ ...formData, original_title: e.target.value })}
            disabled={statusOnlyMode}
          />
          <small style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Quy tắc ghi tên gốc: Tên bài gốc + nguồn
          </small>
          {duplicateOriginalTitleMatches.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-2)' }}>
              <div style={{ color: '#d97706', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
                ⚠️ Có bài trùng tiền tố tên bài hoặc tên gốc
              </div>
              {duplicateOriginalTitleMatches.map((match, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #fcd34d',
                    backgroundColor: '#fef9c3',
                    padding: 'var(--spacing-2)',
                    borderRadius: 'var(--radius)',
                    marginTop: 'var(--spacing-2)',
                    fontSize: '0.875rem',
                    color: '#374151',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-2)' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>{match.title}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--spacing-1) var(--spacing-2)', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#6b7280' }}>Tên gốc:</span>
                        <span>{match.originalTitle}</span>
                        <span style={{ color: '#6b7280' }}>Level:</span>
                        <span>{match.level}</span>
                        <span style={{ color: '#6b7280' }}>Tag:</span>
                        <span>{match.tag}</span>
                        <span style={{ color: '#6b7280' }}>Ngày tạo:</span>
                        <span>{formatDate(match.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Link gốc</label>
          <input
            type="url"
            className="form-control"
            placeholder="https://..."
            value={formData.original_link || ''}
            onChange={(e) => setFormData({ ...formData, original_link: e.target.value })}
            disabled={statusOnlyMode}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Tag</label>
            <div className="tag-select-container" ref={tagDropdownRef} style={{ position: 'relative' }}>
              <div className="tag-input-wrapper" onClick={() => setTagDropdownOpen(true)}>
                <div className="selected-tags-container">
                  {selectedTags.length > 0 && (
                    <span className="tag-count-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      </svg>
                      {selectedTags.length}
                    </span>
                  )}
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="tag-badge-selected"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTags(selectedTags.filter((t) => t !== tag));
                      }}
                    >
                      <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.9 }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  className="tag-search-input"
                  placeholder="Tìm kiếm và chọn tag..."
                  autoComplete="off"
                  value={tagSearchInput}
                  onChange={(e) => {
                    setTagSearchInput(e.target.value);
                    setTagDropdownOpen(true);
                  }}
                  onFocus={() => setTagDropdownOpen(true)}
                  disabled={statusOnlyMode}
                />
              </div>
              {tagDropdownOpen && (
                <div
                  className="tag-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    marginTop: '4px',
                  }}
                >
                  {filteredTags.length === 0 ? (
                    tagSearchInput.trim() ? (
                      <div className="tag-dropdown-empty" style={{ padding: 'var(--spacing-5)', textAlign: 'center', color: 'var(--muted)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, margin: '0 auto var(--spacing-3)', display: 'block' }}>
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>Không tìm thấy tag nào</p>
                        <p style={{ margin: 'var(--spacing-2) 0 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>Thử tìm kiếm với từ khóa khác</p>
                      </div>
                    ) : (
                      <>
                        {popularTags.length > 0 && (
                          <div style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tags phổ biến</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                              {popularTags.map((tag, idx) => (
                                <span
                                  key={`exercise-popular-${tag}-${idx}`}
                                  className="tag-suggestion-chip"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!selectedTags.includes(tag)) {
                                      setSelectedTags([...selectedTags, tag]);
                                      setTagSearchInput('');
                                      setTagDropdownOpen(false);
                                    }
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    fontSize: 'var(--font-size-xs)',
                                    background: 'var(--bg)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    color: 'var(--text)',
                                  }}
                                  onMouseEnter={(e) => {
                                    const el = e.currentTarget;
                                    el.style.background = 'var(--primary)';
                                    el.style.color = 'white';
                                    el.style.borderColor = 'var(--primary)';
                                    el.style.transform = 'scale(1.05)';
                                  }}
                                  onMouseLeave={(e) => {
                                    const el = e.currentTarget;
                                    el.style.background = 'var(--bg)';
                                    el.style.color = 'var(--text)';
                                    el.style.borderColor = 'var(--border)';
                                    el.style.transform = 'scale(1)';
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ padding: 'var(--spacing-3)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--font-size-xs)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, marginRight: '4px', verticalAlign: 'middle' }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          Gõ để tìm kiếm tag...
                        </div>
                      </>
                    )
                  ) : (
                    (() => {
                      // Group by level if no search term
                      const levelGroups: Record<string | number, typeof filteredTags> = {};
                      filteredTags.forEach(item => {
                        const level = item.level >= 0 ? item.level : 'other';
                        if (!levelGroups[level]) levelGroups[level] = [];
                        levelGroups[level].push(item);
                      });

                      const levelNames: Record<string | number, string> = {
                        0: 'Level 0: Nền tảng',
                        1: 'Level 1: Thuật toán cơ bản',
                        2: 'Level 2: Tìm kiếm & Toán',
                        3: 'Level 3: Thuật toán quan trọng',
                        4: 'Level 4: Nâng cao',
                        5: 'Level 5: Chuyên sâu',
                        other: 'Khác'
                      };

                      const levelColors: Record<string | number, string> = {
                        0: 'rgba(59, 130, 246, 0.1)',
                        1: 'rgba(34, 197, 94, 0.1)',
                        2: 'rgba(251, 191, 36, 0.1)',
                        3: 'rgba(168, 85, 247, 0.1)',
                        4: 'rgba(239, 68, 68, 0.1)',
                        5: 'rgba(236, 72, 153, 0.1)',
                        other: 'rgba(107, 114, 128, 0.1)'
                      };

                      // Helper to highlight match in tag name
                      const highlightMatch = (tag: string, search: string) => {
                        if (!search.trim()) return tag;
                        const tagLower = tag.toLowerCase();
                        const searchLower = search.toLowerCase();
                        const matchIndex = tagLower.indexOf(searchLower);
                        if (matchIndex === -1) return tag;
                        const before = tag.substring(0, matchIndex);
                        const match = tag.substring(matchIndex, matchIndex + search.length);
                        const after = tag.substring(matchIndex + search.length);
                        return (
                          <>
                            {before}
                            <strong style={{ color: 'var(--primary)', fontWeight: 600 }}>{match}</strong>
                            {after}
                          </>
                        );
                      };

                      // Render grouped or flat list
                      if (!tagSearchInput.trim() && Object.keys(levelGroups).length > 1) {
                        // Grouped view
                        return (
                          <div className="tag-dropdown-list">
                            {Object.keys(levelGroups).sort((a, b) => {
                              if (a === 'other') return 1;
                              if (b === 'other') return -1;
                              return Number(a) - Number(b);
                            }).map(level => {
                              const tags = levelGroups[level].slice(0, 8);
                              return (
                                <div key={level} className="tag-level-group" data-level={level}>
                                  <div
                                    className="tag-level-header"
                                    style={{
                                      padding: 'var(--spacing-2) var(--spacing-3)',
                                      background: levelColors[level],
                                      borderBottom: '1px solid var(--border)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--spacing-2)',
                                    }}
                                  >
                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      {levelNames[level]}
                                    </span>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>
                                      ({tags.length})
                                    </span>
                                  </div>
                                  {tags.map((item, idx) => (
                                    <div
                                      key={`exercise-group-${level}-${item.tag}-${idx}`}
                                      className="tag-dropdown-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!selectedTags.includes(item.tag)) {
                                          setSelectedTags([...selectedTags, item.tag]);
                                          setTagSearchInput('');
                                          setTagDropdownOpen(false);
                                        }
                                      }}
                                      style={{
                                        padding: 'var(--spacing-2) var(--spacing-3)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        borderBottom: '1px solid var(--border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-2)',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--bg)';
                                        e.currentTarget.style.transform = 'translateX(2px)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '';
                                        e.currentTarget.style.transform = 'translateX(0)';
                                      }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0, opacity: 0.6 }}>
                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                        <line x1="7" y1="7" x2="7.01" y2="7" />
                                      </svg>
                                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }}>
                                        {item.tag}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // Flat list view (when searching)
                        return (
                          <div className="tag-dropdown-list">
                            <div
                              style={{
                                padding: 'var(--spacing-2) var(--spacing-3)',
                                borderBottom: '1px solid var(--border)',
                                background: 'var(--bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--muted)' }}>
                                {filteredTags.length} kết quả
                              </span>
                              {filteredTags.length > 15 && (
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>
                                  Hiển thị 15 đầu tiên
                                </span>
                              )}
                            </div>
                            {filteredTags.slice(0, 15).map(item => (
                              <div
                                key={item.tag}
                                className="tag-dropdown-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!selectedTags.includes(item.tag)) {
                                    setSelectedTags([...selectedTags, item.tag]);
                                    setTagSearchInput('');
                                    setTagDropdownOpen(false);
                                  }
                                }}
                                style={{
                                  padding: 'var(--spacing-3)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  borderBottom: '1px solid var(--border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--spacing-2)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--bg)';
                                  e.currentTarget.style.transform = 'translateX(2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                  <line x1="7" y1="7" x2="7.01" y2="7" />
                                </svg>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }}>
                                  {highlightMatch(item.tag, tagSearchInput)}
                                </span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </div>
                            ))}
                          </div>
                        );
                      }
                    })()
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Level</label>
            <select
              className="form-control"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              disabled={statusOnlyMode}
            >
              <option value="">-- Chọn level --</option>
              <option value="Level 0">Level 0</option>
              <option value="Level 1">Level 1</option>
              <option value="Level 2">Level 2</option>
              <option value="Level 3">Level 3</option>
              <option value="Level 4">Level 4</option>
              <option value="Level 5">Level 5</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
              Ngày <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="date"
              className="form-control"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              disabled={statusOnlyMode}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Chi phí</label>
            <CurrencyInput
              value={formData.cost || 0}
              onChange={(value) => setFormData({ ...formData, cost: value })}
              showHint={false}
              disabled={statusOnlyMode}
            />
            <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem' }}>
              <div style={{ fontWeight: '500', color: 'var(--text)' }}>{costPreview.formatted}</div>
              <div style={{ color: 'var(--muted)', marginTop: '2px' }}>{costPreview.words}</div>
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Trạng thái</label>
          <select
            className="form-control"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            disabled={!canEditPaymentStatus}
          >
            <option value="pending">Chưa thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="deposit">Cọc</option>
          </select>
          {!canEditPaymentStatus && (
            <small style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
              Bạn không có quyền chỉnh sửa trạng thái thanh toán
            </small>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Contest</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="VD: Bài này đã được đưa vào contest ABC ngày 12/11..."
            value={formData.contest_uploaded}
            onChange={(e) => setFormData({ ...formData, contest_uploaded: e.target.value })}
            disabled={statusOnlyMode}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Link</label>
          <input
            type="url"
            className="form-control"
            placeholder="https://example.com/lesson"
            value={formData.link}
            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
            disabled={statusOnlyMode}
          />
        </div>

        {isAdmin && lessonPlanStaff && lessonPlanStaff.length > 0 && (
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Người phụ trách</label>
            <select
              className="form-control"
              value={formData.assistant_id || ''}
              onChange={(e) => setFormData({ ...formData, assistant_id: e.target.value || undefined })}
              disabled={statusOnlyMode}
            >
              <option value="">-- Chọn người phụ trách --</option>
              {lessonPlanStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName || staff.full_name || staff.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary">
            Cập nhật
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Exercises Tab Component
function ExercisesTab({
  topics,
  topicLinks,
  outputs,
  uniqueTags,
  isAdmin,
  isAssistant,
  assistantId,
  lessonPlanStaff,
  onRefetchTopics,
  onRefetchTopicLinks,
  onRefetchOutputs,
}: {
  topics: LessonTopic[];
  topicLinks: LessonTopicLink[];
  outputs: LessonOutput[];
  uniqueTags: string[];
  isAdmin: boolean;
  isAssistant: boolean;
  assistantId: string | null | undefined;
  lessonPlanStaff: any[];
  onRefetchTopics: () => Promise<void>;
  onRefetchTopicLinks: () => Promise<void>;
  onRefetchOutputs: () => Promise<void>;
}) {
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<LessonTopic | null>(null);
  const [topicFormData, setTopicFormData] = useState<LessonTopicFormData>({ name: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [isAddToTopicModalOpen, setIsAddToTopicModalOpen] = useState(false);
  const [selectedOutputForTopic, setSelectedOutputForTopic] = useState<LessonOutput | null>(null);
  const [selectedTopicsForAdd, setSelectedTopicsForAdd] = useState<string[]>([]);
  const [isExerciseDetailModalOpen, setIsExerciseDetailModalOpen] = useState(false);
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<LessonOutput | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    if (tagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tagDropdownOpen]);

  // Get all unique tags from outputs (split by comma) + PREDEFINED_TAGS (union)
  const allUniqueTags = useMemo(() => {
    const allTags = outputs.map((o) => o.tag).filter(Boolean);
    const uniqueTags = new Set<string>();
    allTags.forEach((tag) => {
      tag.split(',').forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) uniqueTags.add(trimmed);
      });
    });
    // Union PREDEFINED_TAGS and dynamic tags (like backup)
    return Array.from(new Set([...PREDEFINED_TAGS, ...uniqueTags])).sort();
  }, [outputs]);

  // Filter tags with prefix matching for filter (like TasksTab)
  const filteredFilterTags = useMemo(() => {
    const searchLower = tagSearchInput.toLowerCase().trim();
    
    // Filter and map tags with level info (like backup)
    const filtered = allUniqueTags
      .filter(tag => !selectedTags.includes(tag))
      .map(tag => {
        const tagLower = tag.toLowerCase();
        const startsWith = tagLower.startsWith(searchLower);
        const contains = tagLower.includes(searchLower);
        return {
          tag,
          level: getTagLevel(tag),
          startsWith,
          contains,
          index: startsWith ? tagLower.indexOf(searchLower) : (contains ? tagLower.indexOf(searchLower) : -1)
        };
      })
      .filter(item => item.contains)
      .sort((a, b) => {
        if (a.startsWith && !b.startsWith) return -1;
        if (!a.startsWith && b.startsWith) return 1;
        if (a.level !== b.level) return a.level - b.level;
        return a.index - b.index;
      });
    
    return filtered;
  }, [tagSearchInput, selectedTags, allUniqueTags]);

  // Popular tags for filter (when no search term)
  const popularFilterTags = useMemo(() => {
    const popular = ['DFS', 'BFS', 'DP', 'Segment Tree', 'Greedy', 'Binary Search', 'Graph', 'Tree'];
    return popular.filter(t => !selectedTags.includes(t) && PREDEFINED_TAGS.includes(t)).slice(0, 6);
  }, [selectedTags]);

  // Filter outputs by assistant, tags, search, status, staff, and date range
  const filteredOutputs = useMemo(() => {
    let filtered = outputs;
    if (isAssistant && assistantId) {
      filtered = filtered.filter((o) => o.assistant_id === assistantId);
    }
    if (selectedTags.length > 0) {
      filtered = filtered.filter((o) => {
        if (!o.tag) return false;
        const exerciseTags = o.tag.split(',').map((t) => t.trim()).filter(Boolean);
        return selectedTags.some((selectedTag) =>
          exerciseTags.some((exerciseTag) => exerciseTag.toLowerCase() === selectedTag.toLowerCase())
        );
      });
    }
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          (o.lesson_name || '').toLowerCase().includes(search) ||
          (o.tag || '').toLowerCase().includes(search)
      );
    }
    if (statusFilter) {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }
    if (staffFilter) {
      filtered = filtered.filter((o) => o.assistant_id === staffFilter);
    }
    if (dateFromFilter) {
      filtered = filtered.filter((o) => o.date && o.date >= dateFromFilter);
    }
    if (dateToFilter) {
      filtered = filtered.filter((o) => o.date && o.date <= dateToFilter);
    }
    return filtered;
  }, [outputs, isAssistant, assistantId, selectedTags, searchFilter, statusFilter, staffFilter, dateFromFilter, dateToFilter]);

  // Get default and custom topics
  const defaultTopics = useMemo(() => {
    return topics
      .filter((t) => t.is_default)
      .sort((a, b) => {
        if (a.id === 'all') return -1;
        if (b.id === 'all') return 1;
        return (a.level || 0) - (b.level || 0);
      });
  }, [topics]);

  const customTopics = useMemo(() => {
    return topics.filter((t) => !t.is_default).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [topics]);

  // Get outputs for selected topic (with order)
  const topicOutputs = useMemo(() => {
    if (selectedTopicId === 'all') {
      return filteredOutputs;
    }

    // Filter by level if it's a level topic
    const selectedTopic = topics.find((t) => t.id === selectedTopicId);
    if (selectedTopic?.level !== null && selectedTopic?.level !== undefined) {
      return filteredOutputs.filter((o) => o.level === `Level ${selectedTopic.level}`);
    }

    // Filter by topic links for custom topics and sort by order_index
    const linksForTopic = topicLinks.filter((link) => link.topic_id === selectedTopicId);
    const linkedOutputIds = linksForTopic.map((link) => link.lesson_output_id);
    const outputs = filteredOutputs.filter((o) => linkedOutputIds.includes(o.id));
    
    // Sort by order_index
    return outputs.sort((a, b) => {
      const linkA = linksForTopic.find((l) => l.lesson_output_id === a.id);
      const linkB = linksForTopic.find((l) => l.lesson_output_id === b.id);
      const orderA = linkA?.order_index ?? 0;
      const orderB = linkB?.order_index ?? 0;
      return orderA - orderB;
    });
  }, [selectedTopicId, filteredOutputs, topics, topicLinks]);

  // Check if current topic is custom and can be dragged
  const canDragDrop = useMemo(() => {
    if (selectedTopicId === 'all') return false;
    const selectedTopic = topics.find((t) => t.id === selectedTopicId);
    return isAdmin && selectedTopic && !selectedTopic.is_default && selectedTopic.level === null;
  }, [selectedTopicId, topics, isAdmin]);

  // Drag and drop handlers
  const [draggedOutputId, setDraggedOutputId] = useState<string | null>(null);
  const [dragOverOutputId, setDragOverOutputId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, outputId: string) => {
    if (!canDragDrop) return;
    setDraggedOutputId(outputId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', outputId);
  };

  const handleDragOver = (e: React.DragEvent, outputId: string) => {
    if (!canDragDrop || !draggedOutputId || draggedOutputId === outputId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverOutputId(outputId);
  };

  const handleDragLeave = () => {
    setDragOverOutputId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetOutputId: string) => {
    e.preventDefault();
    if (!canDragDrop || !draggedOutputId || draggedOutputId === targetOutputId || selectedTopicId === 'all') {
      setDraggedOutputId(null);
      setDragOverOutputId(null);
      return;
    }

    try {
      // Get current order
      const currentLinks = topicLinks.filter((l) => l.topic_id === selectedTopicId);
      const draggedIndex = topicOutputs.findIndex((o) => o.id === draggedOutputId);
      const targetIndex = topicOutputs.findIndex((o) => o.id === targetOutputId);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedOutputId(null);
        setDragOverOutputId(null);
        return;
      }

      // Reorder outputs
      const reorderedOutputs = [...topicOutputs];
      const [removed] = reorderedOutputs.splice(draggedIndex, 1);
      reorderedOutputs.splice(targetIndex, 0, removed);

      // Update order_index for all links
      const updates = reorderedOutputs.map((output, index) => {
        const link = currentLinks.find((l) => l.lesson_output_id === output.id);
        if (link) {
          return { id: link.id, order_index: index };
        }
        // If link doesn't exist, create it first (this shouldn't happen, but handle it)
        return null;
      }).filter((u): u is { id: string; order_index: number } => u !== null);

      if (updates.length > 0) {
        await bulkUpdateLessonTopicOrder(updates);
        toast.success('Đã cập nhật thứ tự');
        await onRefetchTopicLinks();
      }

      setDraggedOutputId(null);
      setDragOverOutputId(null);
    } catch (error: any) {
      toast.error('Không thể cập nhật thứ tự: ' + (error.response?.data?.error || error.message));
      setDraggedOutputId(null);
      setDragOverOutputId(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedOutputId(null);
    setDragOverOutputId(null);
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newTopic = await createLessonTopic(topicFormData);
      
      // Record action history
      try {
        await recordAction({
          entityType: 'lesson_topic',
          entityId: newTopic.id,
          actionType: 'create',
          beforeValue: null,
          afterValue: newTopic,
          changedFields: null,
          description: `Tạo chuyên đề mới: ${newTopic.name || newTopic.id}`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }
      
      toast.success('Đã thêm chuyên đề');
      setIsAddTopicModalOpen(false);
      setTopicFormData({ name: '' });
      await onRefetchTopics();
    } catch (error: any) {
      toast.error('Không thể thêm chuyên đề: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic) return;
    try {
      const oldTopic = { ...editingTopic };
      const updatedTopic = await updateLessonTopic(editingTopic.id, topicFormData);
      
      // Record action history
      try {
        const changedFields: Record<string, { old: any; new: any }> = {};
        if (oldTopic.name !== updatedTopic.name) changedFields.name = { old: oldTopic.name, new: updatedTopic.name };
        if (oldTopic.level !== updatedTopic.level) changedFields.level = { old: oldTopic.level, new: updatedTopic.level };
        
        await recordAction({
          entityType: 'lesson_topic',
          entityId: updatedTopic.id,
          actionType: 'update',
          beforeValue: oldTopic,
          afterValue: updatedTopic,
          changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
          description: `Cập nhật chuyên đề: ${updatedTopic.name || updatedTopic.id}`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }
      
      toast.success('Đã cập nhật chuyên đề');
      setEditingTopic(null);
      setTopicFormData({ name: '' });
      await onRefetchTopics();
    } catch (error: any) {
      toast.error('Không thể cập nhật chuyên đề: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteTopic = async (id: string) => {
    const topicToDelete = topics.find(t => t.id === id);
    if (!window.confirm('Xóa chuyên đề này?')) return;
    try {
      await deleteLessonTopic(id);
      
      // Record action history
      if (topicToDelete) {
        try {
          await recordAction({
            entityType: 'lesson_topic',
            entityId: id,
            actionType: 'delete',
            beforeValue: topicToDelete,
            afterValue: null,
            changedFields: null,
            description: `Xóa chuyên đề: ${topicToDelete.name || id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
      }
      
      toast.success('Đã xóa chuyên đề');
      await onRefetchTopics();
      if (selectedTopicId === id) {
        setSelectedTopicId('all');
      }
    } catch (error: any) {
      toast.error('Không thể xóa chuyên đề: ' + (error.response?.data?.error || error.message));
    }
  };

  useEffect(() => {
    if (editingTopic) {
      setTopicFormData({ name: editingTopic.name, level: editingTopic.level || null });
    } else {
      setTopicFormData({ name: '' });
    }
  }, [editingTopic]);

  // Get available topics for "Add to Topic" modal
  const availableTopicsForAdd = useMemo(() => {
    if (!selectedOutputForTopic) return [];
    const linkedTopicIds = topicLinks.filter((l) => l.lesson_output_id === selectedOutputForTopic.id).map((l) => l.topic_id);
    return topics.filter((t) => !t.is_default && !linkedTopicIds.includes(t.id));
  }, [selectedOutputForTopic, topics, topicLinks]);

  const handleAddToTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutputForTopic || selectedTopicsForAdd.length === 0) {
      toast.error('Vui lòng chọn ít nhất một chuyên đề');
      return;
    }

    try {
      // Get max order index for each topic
      const maxOrders: Record<string, number> = {};
      selectedTopicsForAdd.forEach((topicId) => {
        const topicLinksForTopic = topicLinks.filter((l) => l.topic_id === topicId);
        maxOrders[topicId] = Math.max(0, ...topicLinksForTopic.map((l) => l.order_index || 0));
      });

      // Create links
      const promises = selectedTopicsForAdd.map((topicId, index) => {
        const orderIndex = (maxOrders[topicId] || 0) + index + 1;
        return createLessonTopicLink({
          topic_id: topicId,
          lesson_output_id: selectedOutputForTopic.id,
          order_index: orderIndex,
        });
      });

      await Promise.all(promises);
      toast.success('Đã thêm bài vào chuyên đề');
      setIsAddToTopicModalOpen(false);
      setSelectedOutputForTopic(null);
      setSelectedTopicsForAdd([]);
      await onRefetchTopicLinks();
      await onRefetchOutputs();
    } catch (error: any) {
      toast.error('Không thể thêm bài vào chuyên đề: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleToggleTopicSelection = (topicId: string) => {
    setSelectedTopicsForAdd((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((id) => id !== topicId);
      } else {
        return [...prev, topicId];
      }
    });
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--spacing-4)', height: 'calc(100vh - 300px)', minHeight: '500px' }}>
      {/* Sidebar chuyên đề */}
      <div
        style={{
          width: '260px',
          flexShrink: 0,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: 'var(--spacing-4)',
          overflowY: 'auto',
        }}
      >
        <div className="topic-list">
          {defaultTopics.map((topic) => (
            <div
              key={topic.id}
              className={`topic-item${selectedTopicId === topic.id ? ' active' : ''}`}
              data-topic-id={topic.id}
              onClick={() => setSelectedTopicId(topic.id)}
              style={{
                padding: 'var(--spacing-3)',
                marginBottom: 'var(--spacing-1)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: 'var(--font-size-sm)',
                background:
                  selectedTopicId === topic.id
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
                    : 'transparent',
                color: selectedTopicId === topic.id ? 'var(--primary)' : 'var(--text)',
                fontWeight: selectedTopicId === topic.id ? '600' : '500',
                border: selectedTopicId === topic.id ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
              }}
            >
              {topic.name}
            </div>
          ))}

          {customTopics.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border)' }}>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--spacing-2)',
                  fontWeight: '600',
                }}
              >
                Chuyên đề tùy chỉnh
              </div>
              {customTopics.map((topic) => (
                <div
                  key={topic.id}
                  className={`topic-item custom-topic${selectedTopicId === topic.id ? ' active' : ''}`}
                  data-topic-id={topic.id}
                  onClick={() => setSelectedTopicId(topic.id)}
                  onMouseEnter={(e) => {
                    const actions = e.currentTarget.querySelector('.topic-actions') as HTMLElement;
                    if (actions) actions.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    const actions = e.currentTarget.querySelector('.topic-actions') as HTMLElement;
                    if (actions) actions.style.opacity = '0';
                  }}
                  style={{
                    padding: 'var(--spacing-3)',
                    marginBottom: 'var(--spacing-1)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: selectedTopicId === topic.id ? 'var(--primary)' : 'var(--text)',
                    border: selectedTopicId === topic.id ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
                    background: selectedTopicId === topic.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                  }}
                >
                  <span style={{ flex: 1 }}>{topic.name}</span>
                  {isAdmin && (
                    <div className="topic-actions" style={{ display: 'flex', gap: 'var(--spacing-1)', opacity: 0, transition: 'opacity 0.2s' }}>
                      <button
                        type="button"
                        className="btn-icon edit-topic-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTopic(topic);
                        }}
                        title="Sửa"
                        style={{
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn-icon delete-topic-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTopic(topic.id);
                        }}
                        title="Xóa"
                        style={{
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          color: 'var(--danger)',
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danh sách bài */}
      <div className="exercises-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Filter Controls */}
        <div
          className="card"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-4)',
            marginBottom: 'var(--spacing-4)',
          }}
        >
          <div
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Bộ lọc nhanh</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ transition: 'transform 0.2s ease', transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>{filtersOpen ? 'Thu gọn' : 'Mở bộ lọc'}</span>
            </div>
          </div>

          {filtersOpen && (
            <div style={{ marginTop: 'var(--spacing-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
              {/* Search */}
              <div style={{ flex: '1 1 220px' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                  Tìm kiếm
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '12px',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Tìm theo tên hoặc tag"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>

              {/* Tag Filter */}
              <div className="filter-item" style={{ flex: '1 1 280px' }}>
                <label className="text-sm text-muted mb-1 block" style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                  Tag
                </label>
                <div className="tag-select-container" ref={tagDropdownRef} style={{ position: 'relative' }}>
                  <div
                    className="tag-input-wrapper"
                    onClick={() => setTagDropdownOpen(true)}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 'var(--spacing-1)',
                      padding: 'var(--spacing-2) var(--spacing-3)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      minHeight: '42px',
                      cursor: 'text',
                    }}
                  >
                    <div className="selected-tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)', flex: 1 }}>
                      {selectedTags.length > 0 && (
                        <span
                          className="tag-count-badge"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            fontSize: 'var(--font-size-xs)',
                            background: 'var(--bg)',
                            color: 'var(--muted)',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: '500',
                            marginRight: 'var(--spacing-1)',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                          </svg>
                          {selectedTags.length}
                        </span>
                      )}
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="tag-badge-selected"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            fontSize: 'var(--font-size-xs)',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: '500',
                          }}
                        >
                          {tag}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTags(selectedTags.filter((t) => t !== tag));
                            }}
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="tag-search-input"
                      placeholder="Tìm kiếm và chọn tag..."
                      autoComplete="off"
                      value={tagSearchInput}
                      onChange={(e) => {
                        setTagSearchInput(e.target.value);
                        setTagDropdownOpen(true);
                      }}
                      onFocus={() => setTagDropdownOpen(true)}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        padding: 0,
                        fontSize: 'var(--font-size-sm)',
                      }}
                    />
                  </div>
                  {tagDropdownOpen && (
                    <div
                      className="tag-dropdown"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 1000,
                        maxHeight: '250px',
                        overflowY: 'auto',
                        marginTop: '4px',
                      }}
                    >
                      {(() => {
                        const searchLower = tagSearchInput.toLowerCase().trim();
                        
                        if (filteredFilterTags.length === 0) {
                          if (searchLower) {
                            return (
                              <div className="tag-dropdown-empty" style={{ padding: 'var(--spacing-5)', textAlign: 'center', color: 'var(--muted)' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, margin: '0 auto var(--spacing-3)', display: 'block' }}>
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>Không tìm thấy tag nào</p>
                                <p style={{ margin: 'var(--spacing-2) 0 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>Thử tìm kiếm với từ khóa khác</p>
                              </div>
                            );
                          } else {
                            // Show popular tags when empty
                            return (
                              <>
                                {popularFilterTags.length > 0 && (
                                  <div style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                      </svg>
                                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tags phổ biến</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                                      {popularFilterTags.map((tag, idx) => (
                                        <span
                                          key={`popular-${tag}-${idx}`}
                                          className="tag-suggestion-chip"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!selectedTags.includes(tag)) {
                                              setSelectedTags([...selectedTags, tag]);
                                              setTagSearchInput('');
                                              setTagDropdownOpen(false);
                                            }
                                          }}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 10px',
                                            fontSize: 'var(--font-size-xs)',
                                            background: 'var(--bg)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            color: 'var(--text)',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--primary)';
                                            e.currentTarget.style.color = 'white';
                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--bg)';
                                            e.currentTarget.style.color = 'var(--text)';
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.transform = 'scale(1)';
                                          }}
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div style={{ padding: 'var(--spacing-3)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--font-size-xs)' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, marginRight: '4px', verticalAlign: 'middle' }}>
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                  </svg>
                                  Gõ để tìm kiếm tag...
                                </div>
                              </>
                            );
                          }
                        }
                        
                        // Group by level if no search term
                        const levelGroups: Record<string | number, typeof filteredFilterTags> = {};
                        filteredFilterTags.forEach(item => {
                          const level = item.level >= 0 ? item.level : 'other';
                          if (!levelGroups[level]) levelGroups[level] = [];
                          levelGroups[level].push(item);
                        });
                        
                        const levelNames: Record<string | number, string> = {
                          0: 'Level 0: Nền tảng',
                          1: 'Level 1: Thuật toán cơ bản',
                          2: 'Level 2: Tìm kiếm & Toán',
                          3: 'Level 3: Thuật toán quan trọng',
                          4: 'Level 4: Nâng cao',
                          5: 'Level 5: Chuyên sâu',
                          other: 'Khác'
                        };
                        
                        const levelColors: Record<string | number, string> = {
                          0: 'rgba(59, 130, 246, 0.1)',
                          1: 'rgba(34, 197, 94, 0.1)',
                          2: 'rgba(251, 191, 36, 0.1)',
                          3: 'rgba(168, 85, 247, 0.1)',
                          4: 'rgba(239, 68, 68, 0.1)',
                          5: 'rgba(236, 72, 153, 0.1)',
                          other: 'rgba(107, 114, 128, 0.1)'
                        };
                        
                        // Render grouped or flat list
                        if (!searchLower && Object.keys(levelGroups).length > 1) {
                          // Grouped view
                          return (
                            <div className="tag-dropdown-list">
                              {Object.keys(levelGroups).sort((a, b) => {
                                if (a === 'other') return 1;
                                if (b === 'other') return -1;
                                return Number(a) - Number(b);
                              }).map((level) => {
                                const tags = levelGroups[level].slice(0, 8);
                                return (
                                  <div key={level} className="tag-level-group" data-level={level}>
                                    <div className="tag-level-header" style={{ padding: 'var(--spacing-2) var(--spacing-3)', background: levelColors[level], borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{levelNames[level]}</span>
                                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>({tags.length})</span>
                                    </div>
                                    {tags.map((item, idx) => {
                                      const tag = item.tag;
                                      return (
                                        <div
                                          key={`${level}-${tag}-${idx}`}
                                          className="tag-dropdown-item"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!selectedTags.includes(tag)) {
                                              setSelectedTags([...selectedTags, tag]);
                                              setTagSearchInput('');
                                              setTagDropdownOpen(false);
                                            }
                                          }}
                                          style={{
                                            padding: 'var(--spacing-2) var(--spacing-3)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            borderBottom: '1px solid var(--border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-2)',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--bg)';
                                            e.currentTarget.style.transform = 'translateX(2px)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '';
                                            e.currentTarget.style.transform = 'translateX(0)';
                                          }}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0, opacity: 0.6 }}>
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                            <line x1="7" y1="7" x2="7.01" y2="7" />
                                          </svg>
                                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }}>{tag}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        } else {
                          // Flat list view (when searching)
                          return (
                            <div className="tag-dropdown-list">
                              <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--muted)' }}>
                                  {filteredFilterTags.length} kết quả
                                </span>
                                {filteredFilterTags.length > 15 && (
                                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', opacity: 0.7 }}>Hiển thị 15 đầu tiên</span>
                                )}
                              </div>
                              {filteredFilterTags.slice(0, 15).map((item, idx) => {
                                const tag = item.tag;
                                let displayTag = tag;
                                if (searchLower) {
                                  const tagLower = tag.toLowerCase();
                                  const matchIndex = tagLower.indexOf(searchLower);
                                  if (matchIndex !== -1) {
                                    const before = tag.substring(0, matchIndex);
                                    const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                                    const after = tag.substring(matchIndex + searchLower.length);
                                    displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                                  }
                                }
                                return (
                                  <div
                                    key={`filtered-${tag}-${idx}`}
                                    className="tag-dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!selectedTags.includes(tag)) {
                                        setSelectedTags([...selectedTags, tag]);
                                        setTagSearchInput('');
                                        setTagDropdownOpen(false);
                                      }
                                    }}
                                    style={{
                                      padding: 'var(--spacing-3)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      borderBottom: '1px solid var(--border)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--spacing-2)',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'var(--bg)';
                                      e.currentTarget.style.transform = 'translateX(2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '';
                                      e.currentTarget.style.transform = 'translateX(0)';
                                    }}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                      <line x1="7" y1="7" x2="7.01" y2="7" />
                                    </svg>
                                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', flex: 1 }} dangerouslySetInnerHTML={{ __html: displayTag }} />
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Filter */}
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                  Trạng thái
                </label>
                <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="pending">Chưa thanh toán</option>
                  <option value="deposit">Cọc</option>
                </select>
              </div>

              {/* Staff Filter */}
              {lessonPlanStaff && lessonPlanStaff.length > 0 && (
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                    Nhân sự
                  </label>
                  <select className="form-control" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                    <option value="">Tất cả nhân sự</option>
                    {lessonPlanStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName || staff.full_name || staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Range */}
              <div style={{ flex: '1 1 240px' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                  Khoảng ngày
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
                  <input
                    type="date"
                    className="form-control"
                    placeholder="Từ ngày"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                  />
                  <input
                    type="date"
                    className="form-control"
                    placeholder="Đến ngày"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* Clear Filters Button */}
              <div style={{ flex: '0 0 140px' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', fontWeight: '500' }}>
                  &nbsp;
                </label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setSearchFilter('');
                    setSelectedTags([]);
                    setTagSearchInput('');
                    setStatusFilter('');
                    setStaffFilter('');
                    setDateFromFilter('');
                    setDateToFilter('');
                  }}
                  style={{ width: '100%' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Xóa lọc
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)', paddingBottom: 'var(--spacing-3)', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAddTopicModalOpen(true)}
                title="Thêm chuyên đề"
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius)',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
            <span>Các bài đã làm</span>
          </h3>
        </div>

        <div className="exercises-list" style={{ flex: 1, overflowY: 'auto' }}>
          {topicOutputs.length > 0 ? (
            <div
              className="table-container"
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              <table className="table-striped exercises-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ width: '15%', padding: 'var(--spacing-3)', fontWeight: '600', color: 'var(--text)' }}>Tag</th>
                    <th style={{ width: '50%', padding: 'var(--spacing-3)', fontWeight: '600', color: 'var(--text)' }}>Tên Bài</th>
                    <th style={{ width: '35%', padding: 'var(--spacing-3)', fontWeight: '600', color: 'var(--text)' }}>Link</th>
                  </tr>
                </thead>
                <tbody id="exercisesTableBody" className={canDragDrop ? 'sortable-list' : ''}>
                  {topicOutputs.map((output, index) => (
                    <tr
                      key={output.id}
                      data-output-id={output.id}
                      data-order={index}
                      className={`exercise-row${canDragDrop ? ' draggable-row' : ''}${draggedOutputId === output.id ? ' dragging' : ''}`}
                      draggable={canDragDrop}
                      onDragStart={(e) => handleDragStart(e, output.id)}
                      onDragOver={(e) => handleDragOver(e, output.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, output.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('.link-actions')) {
                          return;
                        }
                        if (!draggedOutputId) {
                          setSelectedExerciseDetail(output);
                          setIsExerciseDetailModalOpen(true);
                        }
                      }}
                      style={{
                        cursor: canDragDrop ? 'grab' : 'pointer',
                        transition: 'all 0.2s ease',
                        position: canDragDrop ? 'relative' : 'static',
                      }}
                      onMouseEnter={(e) => {
                        const addBtn = e.currentTarget.querySelector('.add-to-topic-btn') as HTMLElement;
                        if (addBtn) addBtn.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        const addBtn = e.currentTarget.querySelector('.add-to-topic-btn') as HTMLElement;
                        if (addBtn) addBtn.style.opacity = '0';
                      }}
                    >
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        {output.tag ? (
                          <span className="badge badge-info">{output.tag}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        <strong style={{ color: 'var(--text)' }}>{output.lesson_name || '-'}</strong>
                      </td>
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                          {output.link ? (
                            <>
                              <div className="link-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                <button
                                  type="button"
                                  className="btn-icon copy-link-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(output.link || '');
                                    toast.success('Đã sao chép link');
                                  }}
                                  title="Sao chép link"
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    padding: 0,
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" />
                                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                                  </svg>
                                </button>
                                <a
                                  href={output.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="link-icon"
                                  onClick={(e) => e.stopPropagation()}
                                  title={output.link}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </a>
                              </div>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn-icon add-to-topic-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOutputForTopic(output);
                                    // Get available topics (custom topics that this output is not already in)
                                    const linkedTopicIds = topicLinks.filter((l) => l.lesson_output_id === output.id).map((l) => l.topic_id);
                                    const availableTopics = topics.filter((t) => !t.is_default && !linkedTopicIds.includes(t.id));
                                    if (availableTopics.length === 0) {
                                      toast.info('Bài đã có trong tất cả các chuyên đề tùy chỉnh');
                                      return;
                                    }
                                    setIsAddToTopicModalOpen(true);
                                  }}
                                  title="Thêm vào chuyên đề"
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    padding: 0,
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    color: 'var(--primary)',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                                -
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn-icon add-to-topic-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOutputForTopic(output);
                                    // Get available topics (custom topics that this output is not already in)
                                    const linkedTopicIds = topicLinks.filter((l) => l.lesson_output_id === output.id).map((l) => l.topic_id);
                                    const availableTopics = topics.filter((t) => !t.is_default && !linkedTopicIds.includes(t.id));
                                    if (availableTopics.length === 0) {
                                      toast.info('Bài đã có trong tất cả các chuyên đề tùy chỉnh');
                                      return;
                                    }
                                    setIsAddToTopicModalOpen(true);
                                  }}
                                  title="Thêm vào chuyên đề"
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    padding: 0,
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    color: 'var(--primary)',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-container" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table className="table-striped exercises-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ width: '15%', padding: 'var(--spacing-3)', fontWeight: '600', color: 'var(--text)' }}>Tag</th>
                    <th style={{ width: '50%', padding: 'var(--spacing-3)', fontWeight: '600', color: 'var(--text)' }}>Tên Bài</th>
                    <th style={{ width: '35%', padding: 'var(--spacing-3)', fontWeight: '600', color: 'var(--text)' }}>Link</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-8" style={{ padding: 'var(--spacing-8)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>Chưa có bài nào trong chuyên đề này</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add to Topic Modal */}
      <Modal
        title="Thêm bài vào chuyên đề"
        isOpen={isAddToTopicModalOpen}
        onClose={() => {
          setIsAddToTopicModalOpen(false);
          setSelectedOutputForTopic(null);
          setSelectedTopicsForAdd([]);
        }}
        size="md"
      >
        {selectedOutputForTopic && (
          <form onSubmit={handleAddToTopic}>
            <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text)', marginBottom: 'var(--spacing-1)' }}>
                    Chọn chuyên đề để thêm bài
                  </label>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--primary)' }}>"{selectedOutputForTopic.lesson_name || '-'}"</strong>
                  </p>
                </div>
              </div>
              <div
                style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-2)',
                  background: 'var(--bg)',
                }}
              >
                {availableTopicsForAdd.length > 0 ? (
                  availableTopicsForAdd.map((topic) => (
                    <label
                      key={topic.id}
                      onClick={() => handleToggleTopicSelection(topic.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: 'var(--spacing-3)',
                        marginBottom: 'var(--spacing-2)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius)',
                        transition: 'all 0.2s ease',
                        border: selectedTopicsForAdd.includes(topic.id) ? '2px solid var(--primary)' : '2px solid transparent',
                        background: selectedTopicsForAdd.includes(topic.id) ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface)',
                      }}
                    >
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          marginRight: 'var(--spacing-3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.2s ease',
                          background: selectedTopicsForAdd.includes(topic.id) ? 'var(--primary)' : 'var(--surface)',
                          borderColor: selectedTopicsForAdd.includes(topic.id) ? 'var(--primary)' : 'var(--border)',
                        }}
                      >
                        {selectedTopicsForAdd.includes(topic.id) && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', color: 'var(--text)' }}>{topic.name}</span>
                      </div>
                    </label>
                  ))
                ) : (
                  <div style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--muted)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: 'var(--spacing-2)' }}>
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>Không còn chuyên đề nào để thêm</p>
                  </div>
                )}
              </div>
            </div>
            <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setIsAddToTopicModalOpen(false);
                  setSelectedOutputForTopic(null);
                  setSelectedTopicsForAdd([]);
                }}
                style={{ minWidth: '100px' }}
              >
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" style={{ minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-2)' }} disabled={selectedTopicsForAdd.length === 0}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Thêm vào chuyên đề
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Exercise Detail Modal */}
      <Modal
        title="Chi tiết bài tập"
        isOpen={isExerciseDetailModalOpen}
        onClose={() => {
          setIsExerciseDetailModalOpen(false);
          setSelectedExerciseDetail(null);
        }}
        size="lg"
      >
        {selectedExerciseDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text)', marginBottom: 'var(--spacing-2)' }}>
                {selectedExerciseDetail.lesson_name}
              </h3>
              {selectedExerciseDetail.original_title && (
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>{selectedExerciseDetail.original_title}</p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Tag</label>
                <div>
                  {selectedExerciseDetail.tag ? (
                    <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                      {selectedExerciseDetail.tag}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>-</span>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Level</label>
                <div>
                  {selectedExerciseDetail.level ? (
                    <span className="badge" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}>
                      {selectedExerciseDetail.level}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>-</span>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Ngày</label>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)' }}>
                  {selectedExerciseDetail.date ? new Date(selectedExerciseDetail.date).toLocaleDateString('vi-VN') : '-'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Trạng thái</label>
                <div>
                  {selectedExerciseDetail.status ? (
                    <span
                      className={`badge ${
                        selectedExerciseDetail.status === 'paid' ? 'badge-success' : selectedExerciseDetail.status === 'deposit' ? 'badge-info' : 'badge-warning'
                      }`}
                      style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}
                    >
                      {selectedExerciseDetail.status === 'paid' ? 'Đã thanh toán' : selectedExerciseDetail.status === 'deposit' ? 'Cọc' : 'Chưa thanh toán'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>-</span>
                  )}
                </div>
              </div>
              {selectedExerciseDetail.cost && (
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Chi phí</label>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', fontWeight: '500' }}>{formatCurrencyVND(selectedExerciseDetail.cost)}</div>
                </div>
              )}
            </div>

            {selectedExerciseDetail.contest_uploaded && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Contest</label>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{selectedExerciseDetail.contest_uploaded}</div>
              </div>
            )}

            {selectedExerciseDetail.link && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Link</label>
                <a
                  href={selectedExerciseDetail.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}
                >
                  {selectedExerciseDetail.link}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit Topic Modal */}
      <Modal
        title={editingTopic ? 'Chỉnh sửa chuyên đề' : 'Thêm chuyên đề mới'}
        isOpen={isAddTopicModalOpen || editingTopic !== null}
        onClose={() => {
          setIsAddTopicModalOpen(false);
          setEditingTopic(null);
          setTopicFormData({ name: '' });
        }}
        size="md"
      >
        <form onSubmit={editingTopic ? handleEditTopic : handleAddTopic}>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
            <label htmlFor="topicName" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Tên chuyên đề *
            </label>
            <input
              id="topicName"
              type="text"
              className="form-control"
              value={topicFormData.name}
              onChange={(e) => setTopicFormData({ ...topicFormData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsAddTopicModalOpen(false);
                setEditingTopic(null);
                setTopicFormData({ name: '' });
              }}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editingTopic ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Resource Modal Component
function ResourceModal({
  resource,
  onClose,
  onSuccess,
}: {
  resource: LessonResource | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState<LessonResourceFormData>({
    title: resource?.title || '',
    resource_link: resource?.resource_link || '',
    description: resource?.description || '',
    tags: resource?.tags || [],
  });
  const [tagsInput, setTagsInput] = useState<string>(Array.isArray(resource?.tags) ? resource.tags.join(', ') : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resource_link?.trim()) {
      toast.error('Link tài nguyên không được để trống');
      return;
    }

    setIsSubmitting(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const submitData = { ...formData, tags };
      
      if (resource) {
        const oldResource = { ...resource };
        const updatedResource = await updateLessonResource(resource.id, submitData);
        
        // Record action history
        try {
          const changedFields: Record<string, { old: any; new: any }> = {};
          if (oldResource.title !== updatedResource.title) changedFields.title = { old: oldResource.title, new: updatedResource.title };
          if (oldResource.resource_link !== updatedResource.resource_link) changedFields.resource_link = { old: oldResource.resource_link, new: updatedResource.resource_link };
          if (oldResource.description !== updatedResource.description) changedFields.description = { old: oldResource.description, new: updatedResource.description };
          if (JSON.stringify(oldResource.tags) !== JSON.stringify(updatedResource.tags)) changedFields.tags = { old: oldResource.tags, new: updatedResource.tags };
          
          await recordAction({
            entityType: 'lesson_resource',
            entityId: updatedResource.id,
            actionType: 'update',
            beforeValue: oldResource,
            afterValue: updatedResource,
            changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
            description: `Cập nhật tài nguyên: ${updatedResource.title || updatedResource.id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
        
        toast.success('Đã cập nhật tài nguyên');
      } else {
        const newResource = await createLessonResource(submitData);
        
        // Record action history
        try {
          await recordAction({
            entityType: 'lesson_resource',
            entityId: newResource.id,
            actionType: 'create',
            beforeValue: null,
            afterValue: newResource,
            changedFields: null,
            description: `Tạo tài nguyên mới: ${newResource.title || newResource.id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
        
        toast.success('Đã thêm tài nguyên mới');
      }
      await onSuccess();
    } catch (error: any) {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Link tài nguyên <span className="text-danger">*</span>
        </label>
        <input
          type="url"
          className="form-control"
          value={formData.resource_link || ''}
          onChange={(e) => setFormData({ ...formData, resource_link: e.target.value })}
          required
          placeholder="https://example.com/resource"
        />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Tiêu đề
        </label>
        <input
          type="text"
          className="form-control"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Tên tài nguyên"
        />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Mô tả
        </label>
        <textarea
          className="form-control"
          rows={3}
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Mô tả về tài nguyên"
        />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Tags (phân cách bằng dấu phẩy)
        </label>
        <input
          type="text"
          className="form-control"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="C++, Thuật toán, Cơ bản"
        />
      </div>
      <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {resource ? 'Cập nhật' : 'Tạo mới'}
        </button>
      </div>
    </form>
  );
}

// Task Modal Component
function TaskModal({
  task,
  lessonPlanStaff,
  currentUserStaffId,
  onClose,
  onSuccess,
}: {
  task: LessonTask | null;
  lessonPlanStaff: any[];
  currentUserStaffId: string | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState<LessonTaskFormData>({
    title: task?.title || '',
    description: task?.description || '',
    assistant_id: task?.assistant_id || (currentUserStaffId || ''),
    due_date: task?.due_date || '',
    status: task?.status || 'pending',
    priority: task?.priority || 'medium',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Auto-set assistant_id when creating new task (task is null) and currentUserStaffId is available
  useEffect(() => {
    if (!task && currentUserStaffId && !formData.assistant_id) {
      setFormData(prev => ({ ...prev, assistant_id: currentUserStaffId }));
    }
  }, [task, currentUserStaffId, formData.assistant_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Tiêu đề không được để trống');
      return;
    }

    setIsSubmitting(true);
    try {
      if (task) {
        const oldTask = { ...task };
        const updatedTask = await updateLessonTask(task.id, formData);
        
        // Record action history
        try {
          const changedFields: Record<string, { old: any; new: any }> = {};
          if (oldTask.title !== updatedTask.title) changedFields.title = { old: oldTask.title, new: updatedTask.title };
          if (oldTask.description !== updatedTask.description) changedFields.description = { old: oldTask.description, new: updatedTask.description };
          if (oldTask.assistant_id !== updatedTask.assistant_id) changedFields.assistant_id = { old: oldTask.assistant_id, new: updatedTask.assistant_id };
          if (oldTask.due_date !== updatedTask.due_date) changedFields.due_date = { old: oldTask.due_date, new: updatedTask.due_date };
          if (oldTask.status !== updatedTask.status) changedFields.status = { old: oldTask.status, new: updatedTask.status };
          if (oldTask.priority !== updatedTask.priority) changedFields.priority = { old: oldTask.priority, new: updatedTask.priority };
          
          await recordAction({
            entityType: 'lesson_task',
            entityId: updatedTask.id,
            actionType: 'update',
            beforeValue: oldTask,
            afterValue: updatedTask,
            changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
            description: `Cập nhật task: ${updatedTask.title || updatedTask.id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
        
        toast.success('Đã cập nhật task');
      } else {
        const newTask = await createLessonTask(formData);
        
        // Record action history
        try {
          await recordAction({
            entityType: 'lesson_task',
            entityId: newTask.id,
            actionType: 'create',
            beforeValue: null,
            afterValue: newTask,
            changedFields: null,
            description: `Tạo task mới: ${newTask.title || newTask.id}`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
        
        toast.success('Đã thêm task mới');
      }
      await onSuccess();
    } catch (error: any) {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Tiêu đề <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          className="form-control"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Mô tả
        </label>
        <textarea
          className="form-control"
          rows={3}
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Mô tả chi tiết về task"
        />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Người phụ trách
        </label>
        <select
          className="form-control"
          value={formData.assistant_id || ''}
          onChange={(e) => setFormData({ ...formData, assistant_id: e.target.value || undefined })}
        >
          <option value="">-- Chọn người phụ trách --</option>
          {lessonPlanStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName || s.full_name || s.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
            Trạng thái
          </label>
          <select
            className="form-control"
            value={formData.status || 'pending'}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
          >
            <option value="pending">Chờ xử lý</option>
            <option value="in_progress">Đang làm</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
            Ưu tiên
          </label>
          <select
            className="form-control"
            value={formData.priority || 'medium'}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
          >
            <option value="low">Thấp</option>
            <option value="medium">Trung bình</option>
            <option value="high">Cao</option>
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
          Hạn chót
        </label>
        <input
          type="date"
          className="form-control"
          value={formData.due_date || ''}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value || undefined })}
        />
      </div>
      <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {task ? 'Cập nhật' : 'Tạo mới'}
        </button>
      </div>
    </form>
  );
}

export default LessonPlans;

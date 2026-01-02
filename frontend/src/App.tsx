/**
 * Main App Component
 * Migrated from backup/index.html and logic.js
 * Optimized with lazy loading for better performance
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { SkeletonLoader } from './components/SkeletonLoader';

// Lazy load pages for code splitting - only load when needed
const Home = lazy(() => import('./pages/Home'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Classes = lazy(() => import('./pages/Classes'));
const Teachers = lazy(() => import('./pages/Teachers'));
const Staff = lazy(() => import('./pages/Staff'));
const Costs = lazy(() => import('./pages/Costs'));
const Categories = lazy(() => import('./pages/Categories'));
const LessonPlans = lazy(() => import('./pages/LessonPlans'));
const ActionHistory = lazy(() => import('./pages/ActionHistory'));
const Coding = lazy(() => import('./pages/Coding'));
const Payments = lazy(() => import('./pages/Payments'));
const Schedule = lazy(() => import('./pages/Schedule'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const ClassDetail = lazy(() => import('./pages/ClassDetail'));
const StaffDetail = lazy(() => import('./pages/StaffDetail'));
const StaffCSKHDetail = lazy(() => import('./pages/StaffCSKHDetail'));

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: '400px',
    flexDirection: 'column',
    gap: '16px'
  }}>
    <SkeletonLoader />
    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Đang tải trang...</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Home />
            </Suspense>
          } 
        />
        <Route 
          path="/home" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Home />
            </Suspense>
          } 
        />
        <Route 
          path="/login" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Home initialAuthMode="login" />
            </Suspense>
          } 
        />
        <Route 
          path="/register" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Register />
            </Suspense>
          } 
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Students />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <StudentDetail />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Classes />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <ClassDetail />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teachers"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Teachers />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Staff />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <StaffDetail />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id/cskh"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <StaffCSKHDetail />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/costs"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Costs />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Categories />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson-plans"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <LessonPlans />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/action-history"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <ActionHistory />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coding"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Coding />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Payments />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Schedule />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


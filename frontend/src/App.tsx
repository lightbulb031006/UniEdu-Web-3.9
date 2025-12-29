/**
 * Main App Component
 * Migrated from backup/index.html and logic.js
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Classes from './pages/Classes';
import Teachers from './pages/Teachers';
import Staff from './pages/Staff';
import Costs from './pages/Costs';
import Categories from './pages/Categories';
import LessonPlans from './pages/LessonPlans';
import ActionHistory from './pages/ActionHistory';
import Coding from './pages/Coding';
import Payments from './pages/Payments';
import Schedule from './pages/Schedule';
import StudentDetail from './pages/StudentDetail';
import ClassDetail from './pages/ClassDetail';
import StaffDetail from './pages/StaffDetail';
import StaffCSKHDetail from './pages/StaffCSKHDetail';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Home initialAuthMode="login" />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <Layout>
                <Students />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <StudentDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes"
          element={
            <ProtectedRoute>
              <Layout>
                <Classes />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ClassDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teachers"
          element={
            <ProtectedRoute>
              <Layout>
                <Teachers />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <Layout>
                <Staff />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <StaffDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id/cskh"
          element={
            <ProtectedRoute>
              <Layout>
                <StaffCSKHDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/costs"
          element={
            <ProtectedRoute>
              <Layout>
                <Costs />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <Layout>
                <Categories />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson-plans"
          element={
            <ProtectedRoute>
              <Layout>
                <LessonPlans />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/action-history"
          element={
            <ProtectedRoute>
              <Layout>
                <ActionHistory />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coding"
          element={
            <ProtectedRoute>
              <Layout>
                <Coding />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Layout>
                <Payments />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Layout>
                <Schedule />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


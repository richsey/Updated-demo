import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

// Layouts
import StudentLayout from "./layouts/StudentLayout";
import AdminLayout from "./layouts/AdminLayout";

// Student pages
import StudentDashboard from "./pages/student/Dashboard";
import Courses from "./pages/student/Courses";
import CourseDetails from "./pages/student/CourseDetails";
import LearningMaterial from "./pages/student/LearningMaterial";
import QuizList from "./pages/student/QuizList";
import QuizPage from "./pages/student/QuizPage";

import Recommendations from "./pages/student/Recommendations";
import Progress from "./pages/student/Progress";
import PastQuestions from "./pages/student/PastQuestions";
import PracticeQuiz from "./pages/student/PracticeQuiz";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageCourses from "./pages/admin/ManageCourses";
import UploadCourse from "./pages/admin/UploadCourse";
import UploadMaterial from "./pages/admin/UploadMaterial";
import CreateQuiz from "./pages/admin/CreateQuiz";
import ManageQuestions from "./pages/admin/ManageQuestions";
import StudentAnalytics from "./pages/admin/StudentAnalytics";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Student — requires login */}
            <Route element={<ProtectedRoute requiredRole="student" />}>
              <Route element={<StudentLayout />}>
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/courses/:courseId" element={<CourseDetails />} />
                <Route path="/materials/:materialId" element={<LearningMaterial />} />
                <Route path="/quizzes" element={<QuizList />} />
                <Route path="/quizzes/:quizId" element={<QuizPage />} />
                <Route path="/practice" element={<PracticeQuiz />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/past-questions" element={<PastQuestions />} />
              </Route>
            </Route>

            {/* Admin — requires admin role */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/courses" element={<ManageCourses />} />
                <Route path="/admin/upload-course" element={<UploadCourse />} />
                <Route path="/admin/upload-material" element={<UploadMaterial />} />
                <Route path="/admin/create-quiz" element={<CreateQuiz />} />
                <Route path="/admin/manage-questions" element={<ManageQuestions />} />
                <Route path="/admin/analytics" element={<StudentAnalytics />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

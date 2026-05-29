import { useEffect, useState, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { FilterProvider } from "@/lib/filterContext";
import { CommandPaletteProvider } from "@/lib/commandPalette";
import { AuthProvider } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";
import DashboardPage from "@/pages/DashboardPage";
import SchoolDetailPage from "@/pages/SchoolDetailPage";
import SchoolCoursesPage from "@/pages/SchoolCoursesPage";
import CourseSubjectsPage from "@/pages/CourseSubjectsPage";
import CourseOverviewPage from "@/pages/CourseOverviewPage";
import SubjectDetailPage from "@/pages/SubjectDetailPage";
// Login flow bypassed for now — app opens directly on the dashboard.
// import LoginPage from "@/pages/LoginPage";
import CommandPalette from "@/components/ui/CommandPalette";
import Loader from "@/components/ui/Loader";

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <Loader />;

  return (
    // AuthProvider must wrap the router so both the public /login route and the
    // RequireAuth gate can read the same auth state.
    <AuthProvider>
      <Routes>
        {/* Login bypassed for now — /login route disabled so any path falls
            through to the dashboard. To restore, uncomment the LoginPage import
            and this route, and re-enable the check in RequireAuth below.
        <Route path="/login" element={<LoginPage />} />
        */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <FilterProvider>
                <CommandPaletteProvider>
                  <DashboardShell>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/course/:courseId" element={<CourseOverviewPage />} />
                      <Route path="/school/:schoolId" element={<SchoolDetailPage />} />
                      <Route path="/school/:schoolId/courses" element={<SchoolCoursesPage />} />
                      <Route
                        path="/school/:schoolId/course/:courseId"
                        element={<CourseSubjectsPage />}
                      />
                      <Route
                        path="/school/:schoolId/course/:courseId/subject/:subjectId"
                        element={<SubjectDetailPage />}
                      />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </DashboardShell>
                  <CommandPalette />
                </CommandPaletteProvider>
              </FilterProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

// Route guard. Login is currently bypassed, so this just renders its children
// (the dashboard is the landing page). To re-enable auth, uncomment the block
// below (and restore the useAuth/useLocation imports + the /login route).
function RequireAuth({ children }: { children: ReactNode }) {
  // const { user } = useAuth();
  // const location = useLocation();
  // if (!user) {
  //   return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  // }
  return <>{children}</>;
}

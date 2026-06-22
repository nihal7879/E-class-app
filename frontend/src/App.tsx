import { useEffect, useState, type ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { FilterProvider } from "@/lib/filterContext";
import { CommandPaletteProvider } from "@/lib/commandPalette";
import { AuthProvider, useAuth } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";
import DashboardPage from "@/pages/DashboardPage";
import SchoolDetailPage from "@/pages/SchoolDetailPage";
import SchoolCoursesPage from "@/pages/SchoolCoursesPage";
import CourseSubjectsPage from "@/pages/CourseSubjectsPage";
import CourseOverviewPage from "@/pages/CourseOverviewPage";
import SubjectDetailPage from "@/pages/SubjectDetailPage";
import LoginPage from "@/pages/LoginPage";
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
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <FilterProvider>
                <CommandPaletteProvider>
                  <DashboardShell>
                    <Routes>
                      <Route path="/" element={<HomeRedirect />} />
                      <Route
                        path="/dashboard"
                        element={
                          <InstituteOnly>
                            <DashboardPage />
                          </InstituteOnly>
                        }
                      />
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
                      <Route path="*" element={<HomeRedirect />} />
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

// Route guard. Redirects unauthenticated users to /login, preserving the
// path they were trying to reach (via router state) so LoginPage can bounce
// them back there after a successful sign-in.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

// Where "home" goes per account type: an institute lands on the dashboard, a
// school login lands on its own school page (it has no institute view).
function schoolHome(user: ReturnType<typeof useAuth>["user"]): string | null {
  return user?.loginType === "S" && user.schoolName
    ? `/school/${encodeURIComponent(user.schoolName)}`
    : null;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={schoolHome(user) ?? "/dashboard"} replace />;
}

// Gate for institute-only pages (the dashboard). A school login is bounced to
// its school page so it can never see cross-school / institute-wide data.
function InstituteOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const home = schoolHome(user);
  return home ? <Navigate to={home} replace /> : <>{children}</>;
}

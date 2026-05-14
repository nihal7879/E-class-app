import { Routes, Route, Navigate } from "react-router-dom";
import { FilterProvider } from "@/lib/filterContext";
import { CommandPaletteProvider } from "@/lib/commandPalette";
import DashboardShell from "@/components/layout/DashboardShell";
import DashboardPage from "@/pages/DashboardPage";
import SchoolDetailPage from "@/pages/SchoolDetailPage";
import SchoolCoursesPage from "@/pages/SchoolCoursesPage";
import CourseSubjectsPage from "@/pages/CourseSubjectsPage";
import SubjectDetailPage from "@/pages/SubjectDetailPage";
import CommandPalette from "@/components/ui/CommandPalette";

export default function App() {
  return (
    <FilterProvider>
      <CommandPaletteProvider>
        <DashboardShell>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
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
  );
}

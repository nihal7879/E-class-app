// Response shapes for backend routes under /api.
// Keep in sync with backend/src/routes/*.ts.

export interface FilterCatalogue {
  years: number[];
  months: number[];
  schools: string[];
  courses: string[];
  divisions: string[];
  genders: string[];
  minDate: string | null;
  maxDate: string | null;
}

export interface KpiResponse {
  totalLogins: number;
  activeSessions: number;       // logins with session_time >= 1 minute
  totalSessionMs: number;
  avgSessionMs: number;
  uniqueUsers: number;
  videoViews: number;
  videoWatchMs: number;
  mcqAttempts: number;
  avgPercentage: number;
  totalSchools: number;
  totalCourses: number;
}

export interface DailyActivityPoint {
  date: string;          // YYYY-MM-DD
  logins: number;
  uniqueStudents: number;
  videoViews: number;
  mcqAttempts: number;
}
export interface DailyActivityResponse {
  series: DailyActivityPoint[];
}

export interface SchoolCompositionItem {
  school: string;
  logins: number;
  sessions: number;
  uniqueStudents: number;
  totalSessionMs: number;
  videoViews: number;
  videoDurationMs: number;
  mcqAttempts: number;
  courses: number;
  total: number;
}
export interface SchoolCompositionResponse {
  items: SchoolCompositionItem[];
}

export interface SchoolDetailResponse {
  school: string;
  totalLogins: number;
  activeSessions: number;
  totalSessionMs: number;
  avgSessionMs: number;
  uniqueUsers: number;
  videoViews: number;
  videoWatchMs: number;
  courses: number;
  mcqAttempts: number;
  avgPercentage: number;
}

export interface SchoolCourseItem {
  course: string;
  videoViews: number;
  videoWatchMs: number;
  uniqueStudents: number;
  subjects: number;
  mcqAttempts: number;
  avgPercentage: number;
}
export interface SchoolCoursesResponse {
  school: string;
  items: SchoolCourseItem[];
}

export interface CourseDetailResponse {
  course: string;
  videoViews: number;
  videoWatchMs: number;
  uniqueStudents: number;
  subjects: number;
  schools: number;
  mcqAttempts: number;
  avgPercentage: number;
  rightAnswers: number;
  totalQuestions: number;
}

export interface CourseSubjectItem {
  subject: string;
  videoViews: number;
  videoWatchMs: number;
  chapters: number;
  students: number;
  mcqAttempts: number;
  avgPercentage: number;
}
export interface CourseSubjectsResponse {
  course: string;
  items: CourseSubjectItem[];
}

export interface CourseSchoolItem {
  school: string;
  students: number;
  videoViews: number;
  videoWatchMs: number;
  mcqAttempts: number;
  avgPercentage: number;
}
export interface CourseSchoolsResponse {
  course: string;
  items: CourseSchoolItem[];
}

export interface SubjectStudentItem {
  userId: number;
  enrollmentId: string;
  studentName: string;
  division: string;
  videoViews: number;
  videoDurationMs: number;
  chaptersTouched: number;
  mcqAttempts: number;
  avgPercentage: number;
}
export interface SubjectStudentsResponse {
  subject: string;
  items: SubjectStudentItem[];
}

export interface ChapterBreakdownItem {
  chapter: string;
  videoViews: number;
  videoWatchMs: number;
  contents: number;
  students: number;
  mcqAttempts: number;
}
export interface SubjectDetailResponse {
  subject: string;
  videoViews: number;
  videoWatchMs: number;
  uniqueStudents: number;
  chapters: number;
  mcqAttempts: number;
  avgPercentage: number;
  chapterBreakdown: ChapterBreakdownItem[];
}

export interface VideoUsageSummary {
  totalViews: number;
  totalWatchMs: number;
  uniqueVideos: number;
  uniqueViewers: number;
}
export interface VideoUsageItem {
  contentName: string;
  contentType: string | null;
  subject: string | null;
  chapter: string | null;
  course: string | null;
  totalViews: number;
  totalWatchMs: number;
  uniqueViewers: number;
}
export interface VideoUsageResponse {
  summary: VideoUsageSummary;
  items: VideoUsageItem[];
}

export interface McqSummary {
  attempts: number;
  avgPercentage: number;
  rightAnswers: number;
  totalQuestions: number;
  marksObtained: number;
  totalMarks: number;
  uniqueStudents: number;
}
export interface McqResultItem {
  subject: string;
  course: string;
  attempts: number;
  avgPercentage: number;
  rightAnswers: number;
  totalQuestions: number;
  uniqueStudents: number;
}
export interface McqResultsResponse {
  summary: McqSummary;
  items: McqResultItem[];
}

export interface StudentItem {
  userId: number;
  enrollmentId: string | null;
  studentName: string | null;
  school: string | null;
  division: string | null;
  logins: number;
  activeSessions: number;       // sessions where session_time >= 1 min
  totalSessionMs: number;
  videoViews: number;
  videoWatchMs: number;
  mcqAttempts: number;
  avgPercentage: number;
}
export interface StudentsResponse {
  items: StudentItem[];
  totalStudents: number;
}

export interface VideoSubjectBreakdown {
  subject: string;
  durationMs: number;
  views: number;
}
export interface VideoCourseBreakdown {
  course: string;
  durationMs: number;
  views: number;
  students: number;
  subjects: VideoSubjectBreakdown[];
}
export interface VideoOverviewResponse {
  totalViews: number;
  totalDurationMs: number;
  uniqueStudents: number;
  uniqueContent: number;
  courses: VideoCourseBreakdown[];
  contentTypeMix: { type: string; views: number; durationMs: number }[];
}

export interface McqSubjectBreakdown {
  subject: string;
  attempts: number;
  avgPercentage: number;
}
export interface McqCourseBreakdown {
  course: string;
  attempts: number;
  avgPercentage: number;
  students: number;
  subjects: McqSubjectBreakdown[];
}
export interface McqOverviewResponse {
  totalAttempts: number;
  avgPercentage: number;
  uniqueStudents: number;
  avgTimeSpentMs: number;
  courses: McqCourseBreakdown[];
  scoreDistribution: { bucket: string; count: number }[];
}







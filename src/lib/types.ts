export type UserKind = "Student" | "Teacher";

export interface LoginRow {
  "Student/Teacher": UserKind;
  School: string;
  UserID: number;
  EnrollmentID: string;
  StudentName: string;
  Division: string;
  EmailID: string;
  Gender: "Male" | "Female" | string;
  LoginDate: string; // "YYYY-MM-DD"
  LoginTime: number; // ms since midnight
  LogoutDate: string;
  LogoutTime: number;
  SessionTime: number; // ms
}

export interface VideoRow {
  "Student/Teacher": UserKind;
  School: string;
  UserID: number;
  EnrollmentID: string;
  StudentName: string;
  Division: string;
  EmailID: string;
  Gender: "Male" | "Female" | string;
  Course: string;
  Subject: string;
  Chapter: string;
  ContentName: string;
  ContentType: string;
  TotalViewDuration: number; // ms
  TotalViewCount: number;
  LastAccessDate: string;
  LastAccessTime: number;
}

export interface McqRow {
  "Student/Teacher": UserKind;
  School: string;
  UserID: number;
  EnrollmentID: string;
  StudentName: string;
  Division: string;
  EmailID: string;
  Gender: "Male" | "Female" | string;
  Course: string;
  Subject: string;
  Chapter: string;
  TotalQuestion: number;
  RightQuestionCount: number;
  TotalMarks: number;
  MarksObtained: number;
  Percentage: number;
  AttemptedDate: string; // YYYY-MM-DD
  AttemptedTime: number;
  TimeSpent: number;
}

export interface FilterState {
  year: number | "all";
  month: number | "all"; // 1..12
  schools: string[]; // empty = all
  courses: string[]; // empty = all
  divisions: string[]; // empty = all
  genders: string[]; // empty = all
}

export interface SchoolTrendPoint {
  date: string; // YYYY-MM-DD
  [schoolName: string]: number | string;
}

export interface SchoolSessionStat {
  school: string;
  logins: number;
  sessions: number;
  totalSessionMs: number;
  uniqueStudents: number;
}

export interface SchoolCompositionStat {
  school: string;
  logins: number;
  sessions: number;
  videoViews: number;
  videoDurationMs: number; // total watch time across videos
  mcqAttempts: number;
  total: number; // sum of the four metrics
  courses: number; // unique courses for this school
}

export interface StudentStat {
  enrollmentId: string;
  studentName: string;
  sessions: number;
  totalSessionMs: number;
  logins: number;
}

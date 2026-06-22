import { z } from "zod";

// Multi-value filters arrive as either a single string (?schools=A) or a
// repeated param array (?schools=A&schools=B). We DO NOT split on commas —
// some school/course names contain commas (e.g. "Jilha Parishad Prathamik
// Shala, Nandanmal"), and a CSV split would shred them into non-matching
// halves and return empty results. Clients that need multiple values must
// use the repeated-param form.
const CsvList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [];
    const raw = Array.isArray(v) ? v : [v];
    return raw.map((s) => s.trim()).filter(Boolean);
  });

const YearOrAll = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "all" || v === "" ? "all" : Number(v)))
  .pipe(z.union([z.literal("all"), z.number().int().min(2000).max(2100)]));

const MonthOrAll = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "all" || v === "" ? "all" : Number(v)))
  .pipe(z.union([z.literal("all"), z.number().int().min(1).max(12)]));

const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .optional();

export const FilterQuerySchema = z.object({
  year: YearOrAll.default("all"),
  month: MonthOrAll.default("all"),
  institutes: CsvList, // institute IDs (numeric, kept as strings for the IN list)
  mediums: CsvList,    // medium IDs
  schools: CsvList,
  courses: CsvList,
  divisions: CsvList,
  genders: CsvList,
  dateFrom: DateString,
  dateTo: DateString,
});

export type FilterQuery = z.infer<typeof FilterQuerySchema>;

export interface ClauseOptions {
  dateColumn: string;          // e.g. "lh.login_date" or "vu.last_access_date"
  instituteColumn?: string;    // e.g. "u.institute_id"
  mediumColumn?: string;       // e.g. "u.medium_id"
  schoolColumn?: string;       // e.g. "u.school"
  courseColumn?: string;       // e.g. "vu.course" — direct course column (video/mcq)
  // For login-based tables that have NO course column: restrict to users who are
  // active in the selected course(s). Pass the user-id column (e.g. "lh.user_id")
  // and a course filter becomes "this row belongs to a student of that course".
  courseUserColumn?: string;
  divisionColumn?: string;     // e.g. "u.division"
  genderColumn?: string;       // e.g. "u.gender"
}

export interface BuiltClause {
  where: string;          // " WHERE ... " (empty string if no filters)
  params: unknown[];      // positional params for mysql2
}

/**
 * Builds the WHERE clause + parameter list for a filtered query.
 * Skips any filter whose column was not provided in opts (e.g. login_history has no course).
 */
export function buildWhereClause(f: FilterQuery, opts: ClauseOptions): BuiltClause {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (f.dateFrom && f.dateTo) {
    parts.push(`${opts.dateColumn} BETWEEN ? AND ?`);
    params.push(f.dateFrom, f.dateTo);
  } else if (f.dateFrom) {
    parts.push(`${opts.dateColumn} >= ?`);
    params.push(f.dateFrom);
  } else if (f.dateTo) {
    parts.push(`${opts.dateColumn} <= ?`);
    params.push(f.dateTo);
  } else {
    if (f.year !== "all") {
      parts.push(`YEAR(${opts.dateColumn}) = ?`);
      params.push(f.year);
    }
    if (f.month !== "all") {
      parts.push(`MONTH(${opts.dateColumn}) = ?`);
      params.push(f.month);
    }
  }

  if (opts.instituteColumn && f.institutes.length > 0) {
    parts.push(`${opts.instituteColumn} IN (${f.institutes.map(() => "?").join(",")})`);
    params.push(...f.institutes);
  }
  if (opts.mediumColumn && f.mediums.length > 0) {
    parts.push(`${opts.mediumColumn} IN (${f.mediums.map(() => "?").join(",")})`);
    params.push(...f.mediums);
  }
  if (opts.schoolColumn && f.schools.length > 0) {
    parts.push(`${opts.schoolColumn} IN (${f.schools.map(() => "?").join(",")})`);
    params.push(...f.schools);
  }
  if (opts.courseColumn && f.courses.length > 0) {
    parts.push(`${opts.courseColumn} IN (${f.courses.map(() => "?").join(",")})`);
    params.push(...f.courses);
  }
  // Course filter on a course-less (login) table: keep only rows whose user is
  // active in the selected course(s), via a video/mcq membership subquery. This
  // is what makes logins / sessions / student counts respect the Course filter.
  if (opts.courseUserColumn && f.courses.length > 0) {
    const ph = f.courses.map(() => "?").join(",");
    parts.push(
      `${opts.courseUserColumn} IN (` +
        `SELECT user_id FROM video_usage WHERE course IN (${ph}) ` +
        `UNION SELECT user_id FROM mcq_report WHERE course IN (${ph}))`,
    );
    params.push(...f.courses, ...f.courses);
  }
  if (opts.divisionColumn && f.divisions.length > 0) {
    parts.push(`${opts.divisionColumn} IN (${f.divisions.map(() => "?").join(",")})`);
    params.push(...f.divisions);
  }
  if (opts.genderColumn && f.genders.length > 0) {
    parts.push(`${opts.genderColumn} IN (${f.genders.map(() => "?").join(",")})`);
    params.push(...f.genders);
  }

  return {
    where: parts.length > 0 ? ` WHERE ${parts.join(" AND ")}` : "",
    params,
  };
}

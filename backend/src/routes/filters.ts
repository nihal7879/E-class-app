import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { FilterQuerySchema } from "../lib/filters.js";

const router = Router();

// Small "col IN (?, ?)" helper for the cascading narrowing below.
function inClause(col: string, vals: string[]): { sql: string; params: string[] } {
  if (vals.length === 0) return { sql: "", params: [] };
  return { sql: `${col} IN (${vals.map(() => "?").join(",")})`, params: [...vals] };
}

function andWhere(...clauses: string[]): string {
  const parts = clauses.filter(Boolean);
  return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
}

/**
 * GET /api/filters/institutes
 * Every institute (id + name). Powers the login dropdown.
 */
router.get(
  "/institutes",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query<any[]>(
      `SELECT institute_id AS id, name FROM institutes ORDER BY name`,
    );
    res.json(rows.map((r) => ({ id: r.id, name: r.name })));
  }),
);

/**
 * GET /api/filters/catalogue
 * Every distinct value that populates the filter dropdowns. Cascades:
 * when `institutes` (and/or `mediums`) are passed, `mediums` and `schools`
 * narrow to that selection (Institute → Medium → School).
 */
router.get(
  "/catalogue",
  asyncHandler(async (req, res) => {
    const f = FilterQuerySchema.parse(req.query);
    const inst = inClause("u.institute_id", f.institutes);
    const med = inClause("u.medium_id", f.mediums);
    const sch = inClause("u.school", f.schools);

    const [yearRows] = await pool.query<any[]>(
      `SELECT DISTINCT y FROM (
         SELECT YEAR(login_date)       AS y FROM login_history WHERE login_date IS NOT NULL
         UNION SELECT YEAR(last_access_date) FROM video_usage    WHERE last_access_date IS NOT NULL
         UNION SELECT YEAR(attempted_date)   FROM mcq_report     WHERE attempted_date IS NOT NULL
       ) t WHERE y IS NOT NULL ORDER BY y DESC`,
    );

    const [monthRows] = await pool.query<any[]>(
      `SELECT DISTINCT m FROM (
         SELECT MONTH(login_date)       AS m FROM login_history WHERE login_date IS NOT NULL
         UNION SELECT MONTH(last_access_date) FROM video_usage    WHERE last_access_date IS NOT NULL
         UNION SELECT MONTH(attempted_date)   FROM mcq_report     WHERE attempted_date IS NOT NULL
       ) t WHERE m IS NOT NULL ORDER BY m`,
    );

    // Institutes: always the full list (so the user can switch institute).
    const [instituteRows] = await pool.query<any[]>(
      `SELECT institute_id AS id, name FROM institutes ORDER BY name`,
    );

    // Mediums: narrowed to the selected institute(s) AND school(s) — so a school
    // login (or any view scoped to a school) only sees the mediums that school's
    // students are actually enrolled under, not every medium in the system.
    const [mediumRows] = await pool.query<any[]>(
      `SELECT DISTINCT m.medium_id AS id, m.name AS name
       FROM mediums m
       JOIN users u ON u.medium_id = m.medium_id
       ${andWhere(inst.sql, sch.sql)}
       ORDER BY m.name`,
      [...inst.params, ...sch.params],
    );

    // Schools: narrowed to the selected institute(s) + medium(s).
    const [schoolRows] = await pool.query<any[]>(
      `SELECT DISTINCT u.school AS school
       FROM users u
       ${andWhere("u.school IS NOT NULL", "u.school <> ''", inst.sql, med.sql)}
       ORDER BY u.school`,
      [...inst.params, ...med.params],
    );

    // Courses: narrowed to the selected institute(s) + medium(s) too. The
    // institute/medium columns are projected into the derived table `t`, so the
    // outer WHERE must reference t.*, not u.* (u is out of scope here).
    const tInst = inClause("t.institute_id", f.institutes);
    const tMed = inClause("t.medium_id", f.mediums);
    const tSchool = inClause("t.school", f.schools);
    const courseWhere = andWhere(
      "t.course IS NOT NULL",
      "t.course <> ''",
      tInst.sql,
      tMed.sql,
      tSchool.sql,
    );
    const [courseRows] = await pool.query<any[]>(
      `SELECT DISTINCT t.course AS course FROM (
         SELECT vu.course AS course, u.institute_id, u.medium_id, u.school
           FROM video_usage vu JOIN users u ON u.user_id = vu.user_id
         UNION ALL
         SELECT mr.course AS course, u.institute_id, u.medium_id, u.school
           FROM mcq_report mr JOIN users u ON u.user_id = mr.user_id
       ) t
       ${courseWhere}
       ORDER BY t.course`,
      [...tInst.params, ...tMed.params, ...tSchool.params],
    );

    const [divisionRows] = await pool.query<any[]>(
      `SELECT DISTINCT division FROM users WHERE division IS NOT NULL AND division <> '' ORDER BY division`,
    );

    const [genderRows] = await pool.query<any[]>(
      `SELECT DISTINCT gender FROM users WHERE gender IS NOT NULL AND gender <> '' ORDER BY gender`,
    );

    const [bounds] = await pool.query<any[]>(
      `SELECT MIN(d) AS minDate, MAX(d) AS maxDate FROM (
         SELECT login_date AS d FROM login_history WHERE login_date IS NOT NULL
         UNION ALL SELECT last_access_date FROM video_usage    WHERE last_access_date IS NOT NULL
         UNION ALL SELECT attempted_date   FROM mcq_report     WHERE attempted_date   IS NOT NULL
       ) t`,
    );

    res.json({
      years: yearRows.map((r) => r.y),
      months: monthRows.map((r) => r.m),
      institutes: instituteRows.map((r) => ({ id: r.id, name: r.name })),
      mediums: mediumRows.map((r) => ({ id: r.id, name: r.name })),
      schools: schoolRows.map((r) => r.school),
      courses: courseRows.map((r) => r.course),
      divisions: divisionRows.map((r) => r.division),
      genders: genderRows.map((r) => r.gender),
      minDate: bounds[0]?.minDate ?? null,
      maxDate: bounds[0]?.maxDate ?? null,
    });
  }),
);

export default router;

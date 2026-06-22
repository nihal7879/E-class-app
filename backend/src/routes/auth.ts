import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { env } from "../config.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// Body sent by the login form: account username + password, plus the account
// `type` chosen in the login dropdown — "I" = institute, "S" = school. The same
// upstream Authenticate endpoint validates both; only the `type` it's told and
// the local table we resolve the returned id against differ.
const LoginBodySchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  type: z.enum(["I", "S"]).default("I"),
});

// Shape of the upstream Authenticate/Login response. On success `Data` is the
// institute id (as a string, e.g. "23"); on failure `Data` is null and `Code`
// is a non-200 status (e.g. 417 "Invalid institute account detail").
interface UpstreamLoginResponse {
  Code?: number;
  Message?: string;
  Data?: string | null;
}

/**
 * POST /api/auth/login
 *
 * Validates credentials against the senior's Authenticate API
 * (dashboard1.sundarameclass.com), which returns the account's id on success.
 * The login dropdown decides the account `type`:
 *   - "I" (institute): the returned id is matched against our `institutes` table;
 *     the dashboard scopes to that institute.
 *   - "S" (school):    the returned id is matched against our `schools` table;
 *     the frontend opens that school's page directly.
 *
 *   200 → { type:"I", instituteId, instituteName }  or  { type:"S", schoolId, schoolName }
 *   401 → { error }   (wrong username/password)
 *   404 → { error }   (valid creds but the institute/school isn't ingested yet)
 */
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password, type } = LoginBodySchema.parse(req.body);

    // Ask the upstream Authenticate API with the chosen account type.
    const url = `${env.ECLASS_API_BASE.replace(/\/$/, "")}/api/v1/Authenticate/Login`;
    let upstream: UpstreamLoginResponse;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username, password, type }),
      });
      upstream = (await resp.json()) as UpstreamLoginResponse;
    } catch (err) {
      console.error("Authenticate API call failed:", err);
      res.status(502).json({ error: "Could not reach the authentication service. Please try again." });
      return;
    }

    // Null Data (or a non-200 upstream Code) means the credentials were wrong.
    const resolvedId = upstream.Data != null ? Number(upstream.Data) : NaN;
    if (upstream.Code !== 200 || !Number.isFinite(resolvedId)) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    if (type === "S") {
      // Confirm the school exists locally so its page has data to show.
      const [rows] = await pool.query<any[]>(
        `SELECT school_id AS id, name FROM schools WHERE school_id = ? LIMIT 1`,
        [resolvedId],
      );
      const school = rows[0];
      if (!school) {
        res.status(404).json({
          error: "This school is authenticated but has no data yet. Please contact the administrator.",
        });
        return;
      }
      res.json({ type: "S", schoolId: school.id, schoolName: school.name });
      return;
    }

    // type === "I": confirm the institute exists locally.
    const [rows] = await pool.query<any[]>(
      `SELECT institute_id AS id, name FROM institutes WHERE institute_id = ? LIMIT 1`,
      [resolvedId],
    );
    const institute = rows[0];
    if (!institute) {
      res.status(404).json({
        error: "This institute is authenticated but has no data yet. Please contact the administrator.",
      });
      return;
    }

    res.json({ type: "I", instituteId: institute.id, instituteName: institute.name });
  }),
);

export default router;

// Vercel serverless entry. Vercel auto-detects files under /api as functions and
// runs them with @vercel/node (TypeScript compiled on the fly). It just re-exports
// the Express app from src/index.ts; importing that module sees process.env.VERCEL
// set, so it skips app.listen()/node-cron and behaves as a request handler.
//
// vercel.json rewrites every path to this function, so Express still does its own
// /api/* routing on the original URL.
import app from "../src/index.js";

export default app;

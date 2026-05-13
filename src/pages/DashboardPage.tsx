import { useNavigate } from "react-router-dom";
import KpiStrip from "@/components/kpi/KpiStrip";
import SchoolTrendChart from "@/components/charts/SchoolTrendChart";
import SchoolSessionBar from "@/components/charts/SchoolSessionBar";
import ComingSoonCard from "@/components/placeholders/ComingSoonCard";
import SectionHeader from "@/components/ui/SectionHeader";
import { schoolId } from "@/lib/parse";

export default function DashboardPage() {
  const nav = useNavigate();
  const goSchool = (school: string) => nav(`/school/${schoolId(school)}`);

  return (
    <div className="space-y-6 pb-12">
      <KpiStrip />

      <div>
        <SectionHeader
          title="Login trends"
          description="See how each school's daily login activity changes over time."
        />
        <SchoolTrendChart onSchoolClick={goSchool} />
      </div>

      <div>
        <SectionHeader
          title="Compare schools"
          description="Side-by-side comparison of activity across your schools."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SchoolSessionBar onSchoolClick={goSchool} />
          </div>
          <ComingSoonCard
            title="Device usage"
            description="Find out who logs in from mobile, laptop, or tablet. We'll turn this on once device info is added to your exports."
            icon={<DeviceIcon />}
          />
        </div>
      </div>

      <div>
        <SectionHeader
          title="More analytics coming next"
          description="Future modules we're working on."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ComingSoonCard
            title="Video usage"
            description="See which chapters and subjects students spend most time on."
            icon={<VideoIcon />}
          />
          <ComingSoonCard
            title="MCQ results"
            description="Quiz attempts, accuracy, weak chapters, and per-student scores."
            icon={<QuizIcon />}
          />
          <ComingSoonCard
            title="Engagement"
            description="Active streaks, return rates, and cohorts of your most engaged students."
            icon={<SparkIcon />}
          />
        </div>
      </div>
    </div>
  );
}

function DeviceIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="14" height="10" rx="2" />
      <rect x="16" y="9" width="6" height="11" rx="1.5" />
      <line x1="6" y1="20" x2="12" y2="20" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <polygon points="17 10 22 7 22 17 17 14 17 10" />
    </svg>
  );
}
function QuizIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}

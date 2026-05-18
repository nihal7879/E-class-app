import { useNavigate } from "react-router-dom";
import KpiStrip from "@/components/kpi/KpiStrip";
import SchoolCompositionChart from "@/components/charts/SchoolCompositionChart";
import VideoUsageCard from "@/components/charts/VideoUsageCard";
import McqResultsCard from "@/components/charts/McqResultsCard";
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
          title="Overall school activity"
          description="See how each school splits its time across logins, sessions, video usage and MCQ attempts — plus how many courses they're learning from."
        />
        <SchoolCompositionChart onSchoolClick={goSchool} />
      </div>

      <div>
        <SectionHeader
          title="Video usage & MCQ results"
          description="Where students spend time on content, and how they perform on quizzes."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <VideoUsageCard />
          <McqResultsCard />
        </div>
      </div>
    </div>
  );
}

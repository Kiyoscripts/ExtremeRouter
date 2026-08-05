import PageHeader from "@/shared/components/PageHeader";
import HealthMonitor from "@/shared/components/HealthMonitor";
import BreakerMonitor from "@/shared/components/BreakerMonitor";

export const dynamic = "force-dynamic";

export default function HealthPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Provider Health"
        description="Real-time provider success rate, latency, and error tracking"
        icon="monitor_heart"
      />
      <HealthMonitor />
      <BreakerMonitor />
    </div>
  );
}

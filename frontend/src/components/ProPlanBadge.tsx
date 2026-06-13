import type { ProPlanId } from "../types";

type ProPlanBadgeProps = {
  plan?: ProPlanId | null;
  className?: string;
};

const PLAN_LABELS: Record<ProPlanId, string> = {
  monthly: "PRO",
  yearly: "LOOKSMAXXER",
  lifetime: "CHAD",
};

function ProPlanBadge({ plan, className = "" }: ProPlanBadgeProps) {
  if (!plan) {
    return null;
  }

  return (
    <span className={`pro-plan-badge-title ${plan} ${className}`.trim()}>
      {PLAN_LABELS[plan]}
    </span>
  );
}

export default ProPlanBadge;

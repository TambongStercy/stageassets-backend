import { SetMetadata } from '@nestjs/common';

export const CHECK_PLAN_LIMIT_KEY = 'checkPlanLimit';

export type PlanLimitType = 'event_creation' | 'speaker_invitation';

/**
 * Decorator to check subscription plan limits
 * @param limitType - Type of limit to check ('event_creation' or 'speaker_invitation')
 */
export const CheckPlanLimit = (limitType: PlanLimitType) =>
  SetMetadata(CHECK_PLAN_LIMIT_KEY, limitType);

type JudgeGrantVault = {
  accessStatus?: string | null;
  judgeId?: string | null;
  judgeAccessGranted?: boolean | null;
  judgeAccessGrantedAt?: Date | string | null;
  clientOtpVerified?: boolean | null;
  lawyerOtpVerified?: boolean | null;
};

export function hasLegacyJudgeGrant(
  vault: JudgeGrantVault | null | undefined,
  assignedJudgeId?: string | null
): boolean {
  return Boolean(
    vault &&
    vault.accessStatus === "open" &&
    assignedJudgeId &&
    vault.judgeId === assignedJudgeId &&
    (!vault.clientOtpVerified || !vault.lawyerOtpVerified)
  );
}

export function hasJudgeGrant(
  vault: JudgeGrantVault | null | undefined,
  assignedJudgeId?: string | null,
  judgeId?: string | null
): boolean {
  if (!vault || !assignedJudgeId) return false;
  if (judgeId && judgeId !== assignedJudgeId) return false;
  if (vault.judgeId && vault.judgeId !== assignedJudgeId) return false;

  return Boolean(
    vault.judgeAccessGranted ||
    vault.judgeAccessGrantedAt ||
    hasLegacyJudgeGrant(vault, assignedJudgeId)
  );
}

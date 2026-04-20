export const ONBOARDING_WALKTHROUGH_ID = 'lsp-v2.onboarding';
export const ONBOARDING_GLOBAL_LAST_SEEN_KEY = 'lsp.onboarding.lastSeenVersion';
export const ONBOARDING_GLOBAL_NEVER_SHOW_KEY = 'lsp.onboarding.neverShowOnboarding';

export type OnboardingDecisionInput = {
  currentVersion: string;
  lastSeenVersion?: string;
  neverShow: boolean;
  showOnUpdate: boolean;
};

export type OnboardingDecision = {
  shouldOpen: boolean;
  nextLastSeenVersion: string;
};

function parseMajor(version: string): number | null {
  const match = version.trim().match(/^(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function isRelevantUpdate(currentVersion: string, lastSeenVersion: string): boolean {
  if (currentVersion === lastSeenVersion) return false;
  const currentMajor = parseMajor(currentVersion);
  const lastMajor = parseMajor(lastSeenVersion);
  if (currentMajor === null || lastMajor === null) {
    return true;
  }
  return currentMajor !== lastMajor;
}

export function computeOnboardingDecision(input: OnboardingDecisionInput): OnboardingDecision {
  const { currentVersion, lastSeenVersion, neverShow, showOnUpdate } = input;
  if (neverShow) {
    return { shouldOpen: false, nextLastSeenVersion: currentVersion };
  }
  if (!lastSeenVersion) {
    return { shouldOpen: true, nextLastSeenVersion: currentVersion };
  }
  if (!showOnUpdate) {
    return { shouldOpen: false, nextLastSeenVersion: currentVersion };
  }
  return {
    shouldOpen: isRelevantUpdate(currentVersion, lastSeenVersion),
    nextLastSeenVersion: currentVersion
  };
}

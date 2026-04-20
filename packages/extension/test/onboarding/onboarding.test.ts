import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  computeOnboardingDecision,
  ONBOARDING_GLOBAL_LAST_SEEN_KEY,
  ONBOARDING_GLOBAL_NEVER_SHOW_KEY,
  ONBOARDING_WALKTHROUGH_ID
} from '../../src/onboarding/onboarding';

describe('onboarding', () => {
  it('contains walkthrough contribution in package.json', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      contributes?: {
        walkthroughs?: Array<{
          id?: string;
          steps?: Array<{ media?: { image?: string; altText?: string } }>;
        }>;
      };
    };
    const walkthroughs = packageJson.contributes?.walkthroughs ?? [];
    const walkthrough = walkthroughs.find((item) => item.id === ONBOARDING_WALKTHROUGH_ID);
    expect(Boolean(walkthrough)).toBe(true);
    const steps = walkthrough?.steps ?? [];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => typeof step.media?.image === 'string' && step.media.image.length > 0)).toBe(true);
    expect(steps.every((step) => typeof step.media?.altText === 'string' && step.media.altText.length > 0)).toBe(true);
  });

  it('opens on first install when lastSeenVersion is undefined', () => {
    const decision = computeOnboardingDecision({
      currentVersion: '2.0.0',
      neverShow: false,
      showOnUpdate: true
    });
    expect(decision.shouldOpen).toBe(true);
    expect(decision.nextLastSeenVersion).toBe('2.0.0');
  });

  it('opens on relevant major update when showOnUpdate is true', () => {
    const decision = computeOnboardingDecision({
      currentVersion: '2.0.0',
      lastSeenVersion: '1.9.9',
      neverShow: false,
      showOnUpdate: true
    });
    expect(decision.shouldOpen).toBe(true);
    expect(decision.nextLastSeenVersion).toBe('2.0.0');
  });

  it('does not open when neverShow is true', () => {
    const decision = computeOnboardingDecision({
      currentVersion: '2.0.0',
      lastSeenVersion: '1.9.9',
      neverShow: true,
      showOnUpdate: true
    });
    expect(decision.shouldOpen).toBe(false);
    expect(decision.nextLastSeenVersion).toBe('2.0.0');
  });

  it('always updates lastSeenVersion', () => {
    const decision = computeOnboardingDecision({
      currentVersion: '2.0.1',
      lastSeenVersion: '2.0.0',
      neverShow: false,
      showOnUpdate: false
    });
    expect(decision.nextLastSeenVersion).toBe('2.0.1');
  });

  it('exports onboarding global state keys', () => {
    expect(ONBOARDING_GLOBAL_LAST_SEEN_KEY).toBe('lsp.onboarding.lastSeenVersion');
    expect(ONBOARDING_GLOBAL_NEVER_SHOW_KEY).toBe('lsp.onboarding.neverShowOnboarding');
  });
});

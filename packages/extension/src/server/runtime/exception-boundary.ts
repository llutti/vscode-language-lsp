export function runWithBoundary(input: {
  cycleId: string;
  task: () => void;
  onError: (error: unknown, cycleId: string) => void;
}): boolean {
  try {
    input.task();
    return true;
  } catch (error) {
    input.onError(error, input.cycleId);
    return false;
  }
}

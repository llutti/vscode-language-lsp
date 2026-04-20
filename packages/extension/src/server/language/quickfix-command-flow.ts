export type NamePromptDeps = {
  askName: (defaultValue: string, title: string) => Promise<string | undefined>;
  apply: (finalName: string) => Promise<void>;
  validateIdentifier: (value: string) => boolean;
};

export async function applyQuickFixWithPrompt(
  title: string,
  suggestedName: string,
  deps: NamePromptDeps
): Promise<boolean> {
  const picked = await deps.askName(suggestedName, title);
  if (picked === undefined) return false;
  const trimmed = picked.trim();
  if (!trimmed || !deps.validateIdentifier(trimmed)) {
    return false;
  }
  await deps.apply(trimmed);
  return true;
}

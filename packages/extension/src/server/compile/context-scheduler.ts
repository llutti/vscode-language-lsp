export type CompilationPlan = {
  priorityKey: string | null;
  orderedKeys: string[];
};

export function buildCompilationPlan(openKeys: string[], activeKey: string | null): CompilationPlan {
  const unique: string[] = [];
  for (const key of openKeys) {
    if (!unique.includes(key)) unique.push(key);
  }
  const priorityKey = activeKey && unique.includes(activeKey) ? activeKey : null;
  const orderedKeys = priorityKey ? [priorityKey, ...unique.filter((key) => key !== priorityKey)] : unique;
  return { priorityKey, orderedKeys };
}

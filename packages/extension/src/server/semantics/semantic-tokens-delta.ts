export type SemanticTokenArrayEdit = {
  start: number;
  deleteCount: number;
  data: number[];
};

export function computeSemanticTokensArrayDelta(oldData: number[], currentData: number[]): SemanticTokenArrayEdit[] {
  let prefix = 0;
  const minLen = Math.min(oldData.length, currentData.length);
  while (prefix < minLen && oldData[prefix] === currentData[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < (minLen - prefix)
    && oldData[oldData.length - 1 - suffix] === currentData[currentData.length - 1 - suffix]
  ) suffix++;

  const deleteCount = oldData.length - prefix - suffix;
  const insertSlice = currentData.slice(prefix, currentData.length - suffix);

  if (deleteCount === 0 && insertSlice.length === 0) return [];
  return [{ start: prefix, deleteCount, data: insertSlice }];
}

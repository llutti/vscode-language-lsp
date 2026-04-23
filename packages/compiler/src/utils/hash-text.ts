export function hashText(text: string): string
{
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1)
  {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

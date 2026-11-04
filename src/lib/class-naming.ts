import { Class } from '@/types';

export function getClassDisplayName(schoolClass: Pick<Class, 'name' | 'stream'>): string {
  return [schoolClass.name.trim(), schoolClass.stream?.trim()]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
}

export function isClassNameTaken(
  classes: Class[],
  academicYearId: string,
  name: string,
  stream?: string,
  excludeClassId?: string
): boolean {
  const normalize = (value: string) =>
    value.toLocaleLowerCase().replace(/([0-9])\s+([a-z])$/, '$1$2');
  const requestedName = normalize(getClassDisplayName({ name, stream }));
  return classes.some((schoolClass) =>
    schoolClass.academicYearId === academicYearId &&
    schoolClass.id !== excludeClassId &&
    normalize(getClassDisplayName(schoolClass)) === requestedName
  );
}

export function getNextStreamSuggestions(classes: Class[], academicYearId: string): string[] {
  const streamsByBase = new Map<string, { baseName: string; letters: Set<string> }>();

  for (const schoolClass of classes) {
    if (schoolClass.academicYearId !== academicYearId) continue;
    const displayName = getClassDisplayName(schoolClass);
    const match = /^(.*\d)\s*([a-z])$/i.exec(displayName);
    if (!match) continue;

    const baseName = match[1].trim();
    const key = baseName.toLocaleLowerCase();
    const entry = streamsByBase.get(key) ?? { baseName, letters: new Set<string>() };
    entry.letters.add(match[2].toUpperCase());
    streamsByBase.set(key, entry);
  }

  return [...streamsByBase.values()].flatMap(({ baseName, letters }) => {
    const highestStream = [...letters].sort().pop();
    if (!highestStream || highestStream === 'Z') return [];
    const nextStream = String.fromCharCode(highestStream.charCodeAt(0) + 1);
    return [`${baseName}${nextStream}`];
  });
}

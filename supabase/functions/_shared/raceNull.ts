// DB-OUTAGE-TRACK-1017
export const raceNull = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
import type { Course } from './routes';
export type Indicator = -1 | 0 | 1;
/** These are fictional game limits, not legal limits for the named real roads. */
export function roadSpeedLimit(
  course: Course,
  distance: number,
  works = false,
) {
  if (
    works &&
    distance > course.length * 0.3 - 100 &&
    distance < course.length * 0.49
  )
    return 40;
  const theme = course.config.theme;
  return theme === 'coast' ||
    theme === 'riverside' ||
    theme === 'river' ||
    course.config.id === 'hangang'
    ? 80
    : theme === 'forest' ||
        theme === 'pasture' ||
        theme === 'hill' ||
        course.config.id === 'namsan'
      ? 50
      : 60;
}

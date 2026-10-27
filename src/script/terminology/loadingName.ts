/** A term's name while its lookup is pending. Older editors saved it as a coding's display. */
export const LOADING_NAME = 'loading...';

/** Whether a saved name or display is just the placeholder (see LOADING_NAME), not a real name. */
export function isLoadingName(name: any): boolean {
  return typeof name === 'string' && name.trim() === LOADING_NAME;
}

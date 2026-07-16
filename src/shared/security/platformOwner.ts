export function matchesPlatformOwnerEmail(
  email: string,
  configuredOwnerEmail: string | null
): boolean {
  return configuredOwnerEmail !== null && email.trim().toLowerCase() === configuredOwnerEmail;
}

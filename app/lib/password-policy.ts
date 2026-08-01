export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRequirement = {
  key: string;
  label: string;
  valid: boolean;
};

export function getPasswordRequirements(
  password: string
): PasswordRequirement[] {
  return [
    {
      key: "length",
      label: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
      valid:
        password.length >= PASSWORD_MIN_LENGTH &&
        password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      key: "lowercase",
      label: "Mindestens 1 Kleinbuchstabe",
      valid: /[a-z]/.test(password),
    },
    {
      key: "uppercase",
      label: "Mindestens 1 Großbuchstabe",
      valid: /[A-Z]/.test(password),
    },
    {
      key: "number",
      label: "Mindestens 1 Zahl",
      valid: /[0-9]/.test(password),
    },
    {
      key: "special",
      label: "Mindestens 1 Sonderzeichen",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isPasswordValid(password: string) {
  return getPasswordRequirements(password).every(
    (requirement) => requirement.valid
  );
}

export function getPasswordValidationMessage(
  password: string
) {
  const failedRequirements =
    getPasswordRequirements(password).filter(
      (requirement) => !requirement.valid
    );

  if (failedRequirements.length === 0) {
    return null;
  }

  return (
    "Das Passwort erfüllt noch nicht alle Anforderungen: " +
    failedRequirements
      .map((requirement) => requirement.label)
      .join(", ") +
    "."
  );
}
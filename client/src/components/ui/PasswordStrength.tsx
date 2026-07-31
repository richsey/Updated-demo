import { Check, X } from "lucide-react";

interface PasswordRequirements {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function validatePassword(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`\-]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const reqs = validatePassword(password);
  return Object.values(reqs).every(Boolean);
}

export function PasswordStrength({ password }: { password: string }) {
  const requirements = validatePassword(password);

  const criteria = [
    { label: "At least 8 characters", met: requirements.minLength },
    { label: "At least one uppercase letter", met: requirements.hasUpper },
    { label: "At least one lowercase letter", met: requirements.hasLower },
    { label: "At least one number", met: requirements.hasNumber },
    { label: "At least one special character", met: requirements.hasSpecial },
  ];

  return (
    <div className="space-y-2 mt-2">
      <div className="text-sm font-medium text-muted-foreground">Password requirements:</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {criteria.map((item, index) => (
          <div
            key={index}
            className={`flex items-center text-xs transition-colors duration-200 ${
              password.length === 0
                ? "text-muted-foreground"
                : item.met
                ? "text-success"
                : "text-destructive"
            }`}
          >
            {item.met ? (
              <Check className="mr-2 h-3 w-3" />
            ) : (
              <X className="mr-2 h-3 w-3" />
            )}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

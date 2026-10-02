export const loginErrors = {
  invalid: "Kullanıcı adı ve şifreni gir.",
  credentials: "Kullanıcı adı veya şifre yanlış.",
  rate: "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.",
  request: "Geçersiz istek.",
} as const;

export type LoginError = keyof typeof loginErrors;

export function loginErrorMessage(value: unknown): string {
  return typeof value === "string" && Object.hasOwn(loginErrors, value)
    ? loginErrors[value as LoginError]
    : "";
}

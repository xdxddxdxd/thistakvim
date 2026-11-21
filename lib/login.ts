export const minSignupPassword = 8;
export const maxPassword = 256;
export const maxAccountName = 64;
export const maxEmail = 254;

export const loginErrors = {
  invalid: "E-posta adresini veya kullanıcı adını ve şifreni gir.",
  credentials: "Giriş bilgileri yanlış.",
  unconfirmed: "Giriş yapmak için önce e-posta adresini doğrula.",
  confirmation: "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Kayıt ekranından tekrar dene.",
  rate: "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.",
  request: "Geçersiz istek.",
} as const;

export const signupErrors = {
  invalid: "Adını ve geçerli bir e-posta adresini gir.",
  password: "Şifren en az 8 karakter olmalı.",
  weak: "Daha güçlü bir şifre seç.",
  rate: loginErrors.rate,
  request: loginErrors.request,
  unavailable: "Kayıt şu anda yapılamıyor. Biraz bekleyip tekrar dene.",
} as const;

export const checkEmailMessage = "E-posta adresine gelen doğrulama bağlantısını aç. İletiyi bulamazsan spam klasörüne de bak.";

export type LoginError = keyof typeof loginErrors;
export type SignupError = keyof typeof signupErrors;

function errorMessage(messages: Record<string, string>, value: unknown) {
  return typeof value === "string" && Object.hasOwn(messages, value) ? messages[value] : "";
}

export function loginErrorMessage(value: unknown) {
  return errorMessage(loginErrors, value);
}

export function signupErrorMessage(value: unknown) {
  return errorMessage(signupErrors, value);
}

export function normalizedEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.length <= maxEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email) ? email : null;
}

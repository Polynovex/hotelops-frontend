export const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
export const isValidNigerianPhone = (phone: string) => /^\+234\d{10}$/.test(phone);

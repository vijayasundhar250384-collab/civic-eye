const KEY = "civiclens.biometric.credential";

export function hasBiometricEnrolment() {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(KEY));
}

export function clearBiometricEnrolment() {
  window.localStorage.removeItem(KEY);
}

function bufferToBase64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export async function biometricSupported() {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Registers this device's fingerprint / face as a local unlock for the app. */
export async function biometricEnrol(username: string) {
  if (!(await biometricSupported())) {
    throw new Error("This device has no fingerprint or face unlock available.");
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "CivicLens", id: window.location.hostname },
      user: { id: userId, name: username, displayName: username },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Biometric setup was cancelled.");
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ id: bufferToBase64(credential.rawId), username }),
  );
  return true;
}

/** Asks for the device fingerprint / face before opening the app. */
export async function biometricUnlock() {
  const stored = window.localStorage.getItem(KEY);
  if (!stored) return false;
  const { id } = JSON.parse(stored) as { id: string };
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: base64ToBuffer(id), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return Boolean(assertion);
}

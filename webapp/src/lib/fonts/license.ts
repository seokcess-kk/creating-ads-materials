export interface LicenseInfo {
  confirmed: boolean;
  note?: string;
}

const KNOWN_OPEN_LICENSES = ["SIL OFL 1.1", "Apache 2.0", "MIT"];

export function isKnownOpenLicense(note: string | null | undefined): boolean {
  if (!note) return false;
  return KNOWN_OPEN_LICENSES.some((l) => note.includes(l));
}

export function assertLicenseConfirmed(info: LicenseInfo): void {
  if (!info.confirmed) {
    throw new Error("폰트 상업 사용 라이선스 확인이 필요합니다.");
  }
}

export interface UploadLicenseCheck {
  confirmed: boolean;
  note?: string;
  source?: string;
}

export function validateUploadLicense(check: UploadLicenseCheck): LicenseInfo {
  if (!check.confirmed) {
    throw new Error("라이선스 확인 체크박스가 필요합니다.");
  }
  return {
    confirmed: true,
    note: check.note,
  };
}

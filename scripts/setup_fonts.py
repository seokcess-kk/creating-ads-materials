"""
폰트 라이브러리 셋업 스크립트
Google Drive에서 폰트 zip을 다운로드하고 fonts/ 디렉토리에 압축 해제한다.

사용법:
  python scripts/setup_fonts.py

환경변수 (.env):
  FONT_DRIVE_ID: Google Drive 파일 ID
"""

import os
import sys
import zipfile
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")

FONTS_DIR = PROJECT_ROOT / "fonts"
ZIP_PATH = PROJECT_ROOT / "fonts_library.zip"


def count_fonts() -> int:
    """fonts/ 디렉토리의 폰트 파일 수를 반환한다."""
    if not FONTS_DIR.exists():
        return 0
    exts = ("*.ttf", "*.otf", "*.TTF", "*.OTF", "*.ttc", "*.TTC")
    return sum(len(list(FONTS_DIR.glob(e))) for e in exts)


def download_from_drive(file_id: str, output_path: Path):
    """Google Drive에서 파일을 다운로드한다."""
    try:
        import gdown
    except ImportError:
        print("gdown 패키지를 설치합니다...")
        os.system(f"{sys.executable} -m pip install gdown")
        import gdown

    url = f"https://drive.google.com/uc?id={file_id}"
    print(f"Google Drive에서 폰트 다운로드 중...")
    gdown.download(url, str(output_path), quiet=False, fuzzy=True)


def extract_zip(zip_path: Path):
    """zip 파일을 해제한다."""
    print(f"압축 해제 중: {zip_path}")
    with zipfile.ZipFile(str(zip_path), "r") as zf:
        zf.extractall(str(PROJECT_ROOT))
    print("압축 해제 완료!")


def main():
    print("=== 폰트 라이브러리 셋업 ===\n")

    # 이미 폰트가 있는지 확인
    existing = count_fonts()
    if existing > 10:
        print(f"fonts/ 디렉토리에 이미 {existing}개 폰트가 있습니다.")
        answer = input("다시 다운로드하시겠습니까? (y/N): ").strip().lower()
        if answer != "y":
            print("셋업을 건너뜁니다.")
            return

    # 1순위: 로컬 zip 파일
    if ZIP_PATH.exists():
        print(f"로컬 zip 파일 발견: {ZIP_PATH}")
        extract_zip(ZIP_PATH)

    # 2순위: Google Drive에서 다운로드
    else:
        file_id = os.environ.get("FONT_DRIVE_ID", "")
        if not file_id:
            print("ERROR: FONT_DRIVE_ID 환경변수가 설정되지 않았습니다.", file=sys.stderr)
            print("")
            print("다음 중 하나를 수행하세요:")
            print("  1. .env 파일에 FONT_DRIVE_ID=<파일ID> 추가")
            print("  2. fonts_library.zip을 프로젝트 루트에 복사 후 다시 실행")
            print("  3. fonts/ 디렉토리에 폰트 파일을 직접 복사")
            sys.exit(1)

        download_from_drive(file_id, ZIP_PATH)

        if not ZIP_PATH.exists():
            print("ERROR: 다운로드 실패!", file=sys.stderr)
            sys.exit(1)

        extract_zip(ZIP_PATH)
        ZIP_PATH.unlink()
        print("zip 파일 삭제 완료 (용량 절약)")

    # 검증
    installed = count_fonts()
    if installed > 0:
        print(f"\n셋업 완료! {installed}개 폰트가 설치되었습니다.")
    else:
        print("\nWARNING: 폰트 설치를 확인할 수 없습니다.", file=sys.stderr)


if __name__ == "__main__":
    main()

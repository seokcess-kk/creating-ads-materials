"""
폰트 라이브러리 셋업 스크립트
Google Drive에서 폰트 zip을 다운로드하고 fonts/ 디렉토리에 압축 해제한다.

사용법:
  python scripts/setup_fonts.py

환경:
  - gdown 패키지 필요: pip install gdown
  - Google Drive 파일 ID는 FONT_DRIVE_ID 변수에 설정
"""

import os
import sys
import zipfile
from pathlib import Path

# === 설정 ===
# Google Drive 공유 링크에서 파일 ID를 추출하여 여기에 입력
# 예: https://drive.google.com/file/d/XXXXX/view → XXXXX 부분
FONT_DRIVE_ID = ""  # TODO: Google Drive 업로드 후 파일 ID 입력

PROJECT_ROOT = Path(__file__).parent.parent
FONTS_DIR = PROJECT_ROOT / "fonts"
ZIP_PATH = PROJECT_ROOT / "fonts_library.zip"


def check_fonts_exist() -> bool:
    """fonts/ 디렉토리에 폰트 파일이 이미 있는지 확인한다."""
    if not FONTS_DIR.exists():
        return False
    font_files = list(FONTS_DIR.glob("*.ttf")) + list(FONTS_DIR.glob("*.otf")) + \
                 list(FONTS_DIR.glob("*.TTF")) + list(FONTS_DIR.glob("*.OTF"))
    return len(font_files) > 10


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
    print(f"  파일 ID: {file_id}")
    gdown.download(url, str(output_path), quiet=False)


def extract_zip(zip_path: Path, target_dir: Path):
    """zip 파일을 해제한다."""
    print(f"압축 해제 중: {zip_path} → {target_dir}/")
    with zipfile.ZipFile(str(zip_path), "r") as zf:
        zf.extractall(str(target_dir.parent))
    print(f"완료!")


def main():
    print("=== 폰트 라이브러리 셋업 ===\n")

    # 이미 폰트가 있는지 확인
    if check_fonts_exist():
        font_count = len(list(FONTS_DIR.glob("*.ttf")) + list(FONTS_DIR.glob("*.otf")) +
                        list(FONTS_DIR.glob("*.TTF")) + list(FONTS_DIR.glob("*.OTF")))
        print(f"fonts/ 디렉토리에 이미 {font_count}개 폰트가 있습니다.")
        answer = input("다시 다운로드하시겠습니까? (y/N): ").strip().lower()
        if answer != "y":
            print("셋업을 건너뜁니다.")
            return

    # zip 파일이 로컬에 있는지 확인
    if ZIP_PATH.exists():
        print(f"로컬 zip 파일 발견: {ZIP_PATH}")
        extract_zip(ZIP_PATH, FONTS_DIR)
    elif FONT_DRIVE_ID:
        # Google Drive에서 다운로드
        download_from_drive(FONT_DRIVE_ID, ZIP_PATH)
        if ZIP_PATH.exists():
            extract_zip(ZIP_PATH, FONTS_DIR)
            # 다운로드한 zip 삭제 (용량 절약)
            ZIP_PATH.unlink()
            print(f"zip 파일 삭제 완료 (용량 절약)")
        else:
            print("ERROR: 다운로드 실패!", file=sys.stderr)
            sys.exit(1)
    else:
        print("ERROR: 폰트를 다운로드할 수 없습니다.", file=sys.stderr)
        print("")
        print("다음 중 하나를 수행하세요:")
        print("  1. fonts_library.zip을 프로젝트 루트에 복사 후 다시 실행")
        print("  2. scripts/setup_fonts.py의 FONT_DRIVE_ID에 Google Drive 파일 ID 입력")
        print("  3. fonts/ 디렉토리에 폰트 파일을 직접 복사")
        sys.exit(1)

    # 검증
    if check_fonts_exist():
        font_count = len(list(FONTS_DIR.glob("*.ttf")) + list(FONTS_DIR.glob("*.otf")) +
                        list(FONTS_DIR.glob("*.TTF")) + list(FONTS_DIR.glob("*.OTF")))
        print(f"\n셋업 완료! {font_count}개 폰트가 설치되었습니다.")
    else:
        print("\nWARNING: 폰트 설치를 확인할 수 없습니다.", file=sys.stderr)


if __name__ == "__main__":
    main()

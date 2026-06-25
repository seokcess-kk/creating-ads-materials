/**
 * URL을 fetch해 Blob으로 받아 강제 다운로드한다.
 * - fetch 자체가 거부되면(네트워크/CORS 등) 새 탭으로 폴백 — 같은 오리진 API는 Content-Disposition으로 저장된다.
 * - 응답은 왔지만 HTTP 에러(같은 오리진 4xx/5xx)면 폴백하지 않고 에러를 전파한다.
 *   (폴백 시 에러 JSON이 새 탭에 노출되고, 호출부는 거짓 '저장됨'을 표시하게 되므로.)
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    // fetch가 reject됨(네트워크/CORS 등) — 새 탭 폴백
    const w = window.open(url, "_blank", "noopener");
    if (!w) {
      throw new Error(
        "다운로드를 시작하지 못했어요. 팝업 차단을 해제하고 다시 시도해 주세요.",
      );
    }
    return;
  }

  if (!res.ok) {
    // 같은 오리진 API의 에러 — 서버가 준 메시지를 사용자에게 그대로 보여준다.
    let msg = `다운로드 실패 (${res.status})`;
    try {
      const data = await res.clone().json();
      if (data?.error) msg = String(data.error);
    } catch {
      /* JSON 응답이 아니면 상태코드 메시지를 유지 */
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // 앵커 다운로드는 비동기로 진행된다. 같은 tick에 revoke하면 큰 파일(예: 캐러셀 zip)이
  // 일부 브라우저에서 중단될 수 있으므로 한 틱 뒤로 미뤄 정리한다.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

/**
 * fetch() 는 업로드 진행률(progress)을 알려주지 않기 때문에,
 * XMLHttpRequest 를 Promise 로 감싸서 업로드 진행률을 함께 제공합니다.
 */
export function uploadFormDataWithProgress<T>(
  url: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const body: unknown = xhr.response;

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }

      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : `요청이 실패했습니다. (status ${xhr.status})`;

      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("네트워크 오류로 요청에 실패했습니다."));
    xhr.ontimeout = () => reject(new Error("요청이 시간 초과되었습니다."));

    xhr.send(formData);
  });
}

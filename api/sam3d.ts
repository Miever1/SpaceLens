// api/sam3d.ts
export const BASE_URL = "https://overidly-anthropogenic-margot.ngrok-free.dev";

const SAM3D_TOKEN = "my_secure_token_123";

export type SamPoint = {
  x: number;
  y: number;
  label?: number; // 1: 前景，0: 背景（目前都用 1）
};

export type Sam3DItem = {
  key: string;
  url: string;
  last_modified: string | null;
  size?: number;
};

/* -------------------------------------------------------------------------- */
/* 1) 2D 分割：上传图片 + 多个点 → 返回 { segUrl, maskUrl }                    */
/* -------------------------------------------------------------------------- */
export async function sam3dSegment(params: {
  uri: string;
  serverFilename: string;
  points: SamPoint[];
}): Promise<{ segUrl: string | null; maskUrl: string | null }> {
  const { uri, serverFilename, points } = params;

  const form = new FormData();
  form.append("file", {
    uri,
    name: serverFilename,
    type: "image/jpeg",
  } as any);

  form.append("points_json", JSON.stringify(points));

  const res = await fetch(`${BASE_URL}/segment/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SAM3D_TOKEN}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`segment failed: ${res.status} ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // ✅ 新后端：JSON 里有 seg_url / mask_url
  if (contentType.includes("application/json")) {
    const json: any = await res.json();

    console.log("[sam3dSegment] raw json:", json);

    const segUrlRaw =
      json.seg_url ?? json.segUrl ?? json.seg ?? json.url ?? null;
    const maskUrlRaw = json.mask_url ?? json.maskUrl ?? json.mask ?? null;

    const segUrl =
      segUrlRaw && typeof segUrlRaw === "string"
        ? segUrlRaw.startsWith("http")
          ? segUrlRaw
          : `${BASE_URL}${segUrlRaw}`
        : null;

    const maskUrl =
      maskUrlRaw && typeof maskUrlRaw === "string"
        ? maskUrlRaw.startsWith("http")
          ? maskUrlRaw
          : `${BASE_URL}${maskUrlRaw}`
        : null;

    console.log("[sam3dSegment] parsed urls:", { segUrl, maskUrl });

    return { segUrl, maskUrl };
  }

  // 🔙 兼容老版本：直接返回 PNG（二进制），我们当成 seg 图用
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  console.log("[sam3dSegment] fallback dataUrl mode");

  return {
    segUrl: dataUrl,
    maskUrl: null,
  };
}

/* -------------------------------------------------------------------------- */
/* 2) 3D 生成                                                                 */
/* -------------------------------------------------------------------------- */
export async function sam3dGenerate3D(params: {
  uri: string;
  serverFilename: string;
  x?: number;
  y?: number;
}) {
  const { uri, serverFilename, x, y } = params;

  const form = new FormData();
  form.append("file", {
    uri,
    name: serverFilename,
    type: "image/jpeg",
  } as any);

  if (typeof x === "number") form.append("x", String(x));
  if (typeof y === "number") form.append("y", String(y));

  const res = await fetch(`${BASE_URL}/generate3d/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SAM3D_TOKEN}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generate3d failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const glbUrl = data.glb_url as string;

  if (/^https?:\/\//i.test(glbUrl)) {
    return glbUrl;
  }

  return `${BASE_URL}${glbUrl}`;
}

/* -------------------------------------------------------------------------- */
/* 3) 列出 S3 里所有 3D 模型                                                   */
/* -------------------------------------------------------------------------- */
export async function sam3dListModels(): Promise<Sam3DItem[]> {
  const res = await fetch(`${BASE_URL}/list3d/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SAM3D_TOKEN}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`list3d failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.items as Sam3DItem[];
}
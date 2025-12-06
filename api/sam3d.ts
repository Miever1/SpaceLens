// api/sam3d.ts
// import { Platform } from "react-native";

// 本地调试模拟器时可以这样：
// const BASE_URL =
//   Platform.OS === "ios"
//     ? "http://localhost:9000"  // iOS 模拟器
//     : "http://10.0.2.2:9000";  // Android 模拟器

// 真机 / 评审环境：走 ngrok 公网地址
const SAM3D_TOKEN = process.env.EXPO_PUBLIC_SAM3D_TOKEN!;
const BASE_URL = process.env.EXPO_PUBLIC_SAM3D_BASE_URL!;

export type SamPoint = {
  x: number;
  y: number;
  label?: number; // 1: 前景，0: 背景（目前都用 1）
};

// 列表接口返回的 3D 模型信息
export type Sam3DItem = {
  key: string;               // S3 key，比如 static/projects/3d/model_xxx.glb
  url: string;               // 直接可访问的 HTTPS 链接
  last_modified: string | null;
  size?: number;             // 字节数，可选
};

/* -------------------------------------------------------------------------- */
/* 小工具：拼 URL（处理相对路径 / 绝对路径）                                   */
/* -------------------------------------------------------------------------- */
function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path}`;
}

/* -------------------------------------------------------------------------- */
/* 1) 2D 分割：上传图片 + 多个点 → 返回 { segUrl, maskUrl }                    */
/* -------------------------------------------------------------------------- */
export async function sam3dSegment(params: {
  uri: string;
  serverFilename: string;
  points: SamPoint[];
}): Promise<{ segUrl: string; maskUrl: string }> {
  const { uri, serverFilename, points } = params;

  if (!points || points.length === 0) {
    throw new Error("sam3dSegment: points 不能为空");
  }

  // ⭐ 补齐 label，强制都为前景点 1（防止 undefined 被后端当成 0）
  const normalizedPoints = points.map((p) => ({
    ...p,
    label: typeof p.label === "number" ? p.label : 1,
  }));

  const form = new FormData();
  form.append("file", {
    uri,
    name: serverFilename,        // ⚠️ 要和 generate3d 用同一个名字
    type: "image/jpeg",
  } as any);

  form.append("points_json", JSON.stringify(normalizedPoints));

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/segment/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SAM3D_TOKEN}`,
      },
      body: form,
    });
  } catch (err) {
    console.error("sam3dSegment: network error", err);
    throw new Error("segment network error");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("sam3dSegment: bad response", res.status, text);
    throw new Error(`segment failed: ${res.status} ${text}`);
  }

  const json = await res.json();

  const segUrl = resolveUrl(json.seg_url)!;
  const maskUrl = resolveUrl(json.mask_url)!;

  return { segUrl, maskUrl };
}

/* -------------------------------------------------------------------------- */
/* 2) 3D 生成：返回 glb_url + 可选 usdz_url（自动兼容 S3 / 本地相对路径）       */
/* -------------------------------------------------------------------------- */
export async function sam3dGenerate3D(params: {
  uri: string;
  serverFilename: string;
}): Promise<{ glbUrl: string; usdzUrl?: string | null }> {
  const { uri, serverFilename } = params;

  const form = new FormData();
  form.append("file", {
    uri,
    name: serverFilename,
    type: "image/jpeg",
  } as any);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/generate3d/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SAM3D_TOKEN}`,
      },
      body: form,
    });
  } catch (err) {
    console.error("sam3dGenerate3D: network error", err);
    throw new Error("generate3d network error");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("sam3dGenerate3D: bad response", res.status, text);
    throw new Error(`generate3d failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const glbUrl = resolveUrl(data.glb_url)!;
  const usdzUrl = resolveUrl(data.usdz_url) ?? null;

  return { glbUrl, usdzUrl };
}

/* -------------------------------------------------------------------------- */
/* 3) 列出 S3 里所有 3D 模型                                                   */
/* -------------------------------------------------------------------------- */
export async function sam3dListModels(): Promise<Sam3DItem[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/list3d/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SAM3D_TOKEN}`,
      },
    });
  } catch (err) {
    console.error("sam3dListModels: network error", err);
    throw new Error("list3d network error");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("sam3dListModels: bad response", res.status, text);
    throw new Error(`list3d failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return (data.items || []) as Sam3DItem[];
}
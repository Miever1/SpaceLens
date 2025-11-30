// api/sam3d.ts
// import { Platform } from "react-native";

// 本地调试模拟器时可以这样：
// const BASE_URL =
//   Platform.OS === "ios"
//     ? "http://localhost:9000"  // iOS 模拟器
//     : "http://10.0.2.2:9000";  // Android 模拟器

// 真机 / 评审环境：走 ngrok 公网地址
export const BASE_URL = "https://overidly-anthropogenic-margot.ngrok-free.dev";

const SAM3D_TOKEN = "my_secure_token_123";

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
/* 1) 2D 分割：上传图片 + 多个点 → 返回 { segUrl, maskUrl }                    */
/*    segUrl  : 后端生成的可视化 PNG（暗背景 + 绿边），可选显示                */
/*    maskUrl : 纯 mask PNG（透明背景，前景 alpha=1），给前端特效用          */
/* -------------------------------------------------------------------------- */
export async function sam3dSegment(params: {
  uri: string;
  serverFilename: string;
  points: SamPoint[];
}): Promise<{ segUrl: string; maskUrl: string }> {
  const { uri, serverFilename, points } = params;

  const form = new FormData();
  form.append("file", {
    uri,
    name: serverFilename,
    type: "image/jpeg",
  } as any);

  // ⭐ 必须传这个（后端通过 points_json 做多点分割）
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

  // 现在后端返回 JSON：
  // { "seg_url": "/seg_vis/seg_xxx.png", "mask_url": "/mask/mask_xxx.png" }
  const json = await res.json();

  const segUrl = `${BASE_URL}${json.seg_url}`;
  const maskUrl = `${BASE_URL}${json.mask_url}`;

  return { segUrl, maskUrl };
}

/* -------------------------------------------------------------------------- */
/* 2) 3D 生成：返回 glb_url + 可选 usdz_url（自动兼容 S3 / 本地相对路径）       */
/* -------------------------------------------------------------------------- */
export async function sam3dGenerate3D(params: {
  uri: string;
  serverFilename: string;
  x?: number;
  y?: number;
}): Promise<{ glbUrl: string; usdzUrl?: string | null }> {
  const { uri, serverFilename, x, y } = params;

  const form = new FormData();
  form.append("file", {
    uri,
    name: serverFilename,
    type: "image/jpeg",
  } as any);

  // 后端目前不依赖 x,y，有就带上，没有也没关系
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

  // 后端现在返回：
  // { glb_url: "...", usdz_url: "..." | null }
  const data = await res.json();
  let glbUrl = data.glb_url as string;
  let usdzUrl = data.usdz_url as string | null | undefined;

  // 如果是相对路径（/models/xxx.glb），拼上 BASE_URL
  if (!/^https?:\/\//i.test(glbUrl)) {
    glbUrl = `${BASE_URL}${glbUrl}`;
  }
  if (usdzUrl && !/^https?:\/\//i.test(usdzUrl)) {
    usdzUrl = `${BASE_URL}${usdzUrl}`;
  }

  return { glbUrl, usdzUrl };
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
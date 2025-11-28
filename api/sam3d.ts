// api/sam3d.ts
// import { Platform } from "react-native";

// const BASE_URL =
//   Platform.OS === "ios"
//     ? "http://localhost:9000"  // iOS 模拟器
//     : "http://10.0.2.2:9000";  // Android 模拟器

// 真机调后端：用你后端所在机器的局域网 IP + 端口
const BASE_URL = "https://overidly-anthropogenic-margot.ngrok-free.dev";

const SAM3D_TOKEN = "";           
export type SamPoint = {
  x: number;
  y: number;
  label?: number; // 1: 前景，0: 背景（目前都用 1）
};

/** 2D 分割：上传图片 + 多个点 → 返回「高亮前景 + 背景压暗」PNG(dataURL) */
export async function sam3dSegment(params: {
  uri: string;
  serverFilename: string;
  points: SamPoint[];
}) {
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

  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  return dataUrl;
}

/** 3D 生成：返回后端产出的 GLB 的完整 URL（自动兼容 S3 / 本地） */
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

  // 后端现在可能返回：
  // 1) glb_url = "https://miever.s3.ap-east-1.amazonaws.com/static/projects/3d/xxx.glb"
  // 2) glb_url = "/models/xxx.glb"（S3 失败时本地兜底）
  const data = await res.json();
  const glbUrl = data.glb_url as string;

  // 如果已经是完整的 http/https 链接（S3 情况），直接用
  if (/^https?:\/\//i.test(glbUrl)) {
    return glbUrl;
  }

  // 否则认为是相对路径（/models/xxx.glb），拼上 BASE_URL
  const fullUrl = `${BASE_URL}${glbUrl}`;
  return fullUrl;
}
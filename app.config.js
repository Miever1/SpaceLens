// app.config.js
import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    SAM3D_TOKEN: process.env.SAM3D_TOKEN,
    SAM3D_BASE_URL: process.env.SAM3D_BASE_URL,
  },
});
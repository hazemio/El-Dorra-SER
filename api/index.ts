import { createApp } from '../src/main';

export default async function handler(req: any, res: any) {
  // إضافة الهيدرز يدوياً لضمان تمرير الـ Preflight
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://el-dorra-sys.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // إنهاء طلب الـ Preflight مباشرة
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const app = await createApp();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}

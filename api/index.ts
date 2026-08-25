import { createApp } from '../src/main';

export default async function handler(req: any, res: any) {
  // الرد الفوري على طلبات الـ Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const app = await createApp();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}

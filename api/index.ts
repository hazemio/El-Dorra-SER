import { createApp } from '../src/main';

export default async function handler(req: any, res: any) {
  // ترويسات CORS صريحة قبل أي شيء
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://el-dorra-sys.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // إرجاع رد فوري للـ Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const app = await createApp();
    const instance = app.getHttpAdapter().getInstance();
    return instance(req, res);
  } catch (error: any) {
    console.error('SERVERLESS HANDLER ERROR:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error during app bootstrap',
      error: error?.message || error,
    });
  }
}

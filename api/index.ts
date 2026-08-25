import { createApp } from '../src/main';

let cachedHandler: any;

export default async function handler(req: any, res: any) {
  if (!cachedHandler) {
    const app = await createApp();
    cachedHandler = app.getHttpAdapter().getInstance();
  }
  return cachedHandler(req, res);
}
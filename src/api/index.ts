import { createApp } from '../src/main';

let handler;

export default async function(req, res) {

  if (!handler) {
    const app = await createApp();

    handler = app.getHttpAdapter().getInstance();
  }

  return handler(req, res);
}
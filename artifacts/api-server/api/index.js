import app from "../dist/app.mjs";

export default async function handler(req, res) {
  return app(req, res);
}

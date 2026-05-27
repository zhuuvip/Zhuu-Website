import app from "../dist/app.mjs";
import { createServer } from "http";

let server;

export default function handler(req, res) {
  if (!server) {
    server = createServer(app);
  }
  app(req, res);
}

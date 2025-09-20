// genthumb-backend/lib/init-middleware.ts
import type { NextApiRequest, NextApiResponse } from "next";

export function initMiddleware(fn: any) {
  return (req: NextApiRequest, res: NextApiResponse) =>
    new Promise<void>((resolve, reject) => {
      fn(req, res, (result: any) => {
        if (result instanceof Error) {
          return reject(result);
        }
        resolve();
      });
    });
}

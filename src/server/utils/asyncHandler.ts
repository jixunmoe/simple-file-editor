import e from 'express';

type AsyncHandlerMiddleware = (req: e.Request, res: e.Response, next: e.NextFunction) => Promise<any>;
type AsyncRequestHandler = (req: e.Request, res: e.Response) => Promise<any>;
type AsyncHandler = AsyncHandlerMiddleware | AsyncRequestHandler;

export default function asyncHandler(fn: AsyncHandler) {
  return async (req: e.Request, res: e.Response, next: e.NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
import e from 'express';
import FileAPI from './FileAPI';

export function getAPIRoute(): e.Router {
  const router = e.Router();
  const fileAPI = new FileAPI();
  router.use('/file', fileAPI.router());
  return router;
}

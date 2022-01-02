import e from 'express';
import fsSync from 'fs';
import fs from 'fs/promises';
import p from 'path';

import {BadRequestError, InternalServerError, MissingParameterError, NotFoundError, SiteNotFoundError} from '../errors';
import asyncHandler from '../utils/asyncHandler';
import {DIR_LISTING_ITEM_TYPE} from '../../common/constants';

export default class FileAPI {
  private sites = new Map<string, string>();
  constructor() {
    const config = JSON.parse(fsSync.readFileSync("config.json", 'utf-8'));
    for(const [site, path] of Object.entries(config.sites)) {
      if (typeof path !== 'string') {
        throw new Error(`config.json:sites/${site} should be a string, got ${typeof path}(${path}) instead.`);
      } else {
        this.sites.set(site, path);
      }
    }
  }
  router = () => {
    const router = e.Router();
    router.use('/:site', asyncHandler(this.verifyPath));
    router.get('/:site/(*/$)?', asyncHandler(this.statTarget), asyncHandler(this.listDirectory));
    router.get('/:site/*', asyncHandler(this.statTarget), asyncHandler(this.getFile));
    router.put('/:site/*', asyncHandler(this.putFile));
    router.delete('/:site/*', asyncHandler(this.statTarget), asyncHandler(this.deleteFile));
    return router;
  };

  verifyPath = async (req, res, next) => {
    const site: void|string = req.params.site;

    if (!site) {
      throw new MissingParameterError("path / site");
    }

    if (!this.sites.has(site)) {
      throw new SiteNotFoundError(site);
    }

    if (req.path.includes("/..")) {
      throw new BadRequestError("disallowed path");
    }
    const path = req.path.replace(/^\/+/, '');

    req.siteBase = p.resolve(this.sites.get(site));
    req.targetPath = p.resolve(this.sites.get(site), path);
    next();
  };

  statTarget = async (req: e.Request, res: e.Response, next: e.NextFunction) => {
    let stat: fsSync.Stats;
    try {
      stat = await fs.stat(req.targetPath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new NotFoundError(req.path);
      }
      req.log.error(err, { path: req.targetPath }, "could not stat path");
      throw new InternalServerError('could not fetch information about given path');
    }

    req.targetStat = stat;
    next();
  };

  listDirectory = async (req: e.Request, res: e.Response) => {
    const stat: fsSync.Stats = req.targetStat;
    if (!stat.isDirectory()) {
      throw new BadRequestError("is not a directory");
    }
    const filesInside = await fs.readdir(req.targetPath);
    const children = await Promise.all(filesInside.map(async (name) => {
      const stat = await fs.stat(p.resolve(req.targetPath, name));
      return {
        name,
        type: stat.isFile() ? DIR_LISTING_ITEM_TYPE.TYPE_FILE : DIR_LISTING_ITEM_TYPE.TYPE_DIR,
      };
    }));

    res.json({
      success: true,
      children,
    });
  }

  getFile = async (req: e.Request, res: e.Response) => {
    const stat: fsSync.Stats = req.targetStat;
    if (!stat.isFile()) {
      throw new BadRequestError("is not a file");
    }
    res.status(200);
    res.sendFile(req.targetPath);
  }

  putFile = async (req: e.Request, res: e.Response, next: e.NextFunction) => {
    const dir = p.dirname(req.targetPath);
    await fs.mkdir(dir, { recursive: true });

    try {
      const stat = await fs.stat(req.targetPath);
      if (!stat.isFile()) {
        return next(new BadRequestError("target is not a file"));
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        req.log.error(err, 'could not stat given path');
        throw new BadRequestError('could not stat requested path');
      }
    }

    const f = fsSync.createWriteStream(req.targetPath, {
      autoClose: true,
    });
    req.pipe(f);
    f.once('finish', () => {
      console.info('end');
      res.json({
        success: true,
      });
    });
    f.once('error', (err) => {
      next(err);
    });
  }

  deleteFile = async (req: e.Request, res: e.Response) => {
    if (req.siteBase === req.targetPath) {
      throw new BadRequestError('you can not delete root');
    }
    const stat: fsSync.Stats = req.targetStat;
    if (!stat.isFile() && !stat.isDirectory()) {
      throw new BadRequestError('target is not a file or folder');
    }

    await fs.rm(req.targetPath, { recursive: true, force: true });
    res.json({
      success: true
    });
  }
}
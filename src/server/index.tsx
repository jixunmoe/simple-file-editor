import App from '../common/App';
import React from 'react';
import {StaticRouter} from 'react-router-dom';
import express from 'express';
import {renderToString} from 'react-dom/server';
import {getAPIRoute} from './api';
import {BaseHTTPError} from './errors';

import ExpressPinoLogger from 'express-pino-logger';
const pino = ExpressPinoLogger();

const assets = require(process.env.RAZZLE_ASSETS_MANIFEST);

const cssLinksFromAssets = (assets, entrypoint) => {
  return assets[entrypoint]?.css?.map(asset =>
    `<link rel="stylesheet" href="${asset}">`
  ).join('');
};

const jsScriptTagsFromAssets = (assets, entrypoint, ...extra) => {
  return assets[entrypoint] ? assets[entrypoint].js ?
    assets[entrypoint].js.map(asset =>
      `<script src="${asset}" ${extra.join(' ')}></script>`
    ).join('') : '' : '';
};

interface AppContext {
  url?: string;
}

export const renderApp = (req, res) => {
  const context: AppContext = {};
  const markup = renderToString(
    <StaticRouter context={context} location={req.url}>
      <App/>
    </StaticRouter>
  );
  const html = `<!doctype html>
  <html lang="zh-CN">
  <head>
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta charset="utf-8" />
      <title>文件编辑器</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${cssLinksFromAssets(assets, 'client')}
  </head>
  <body>
      <div id="root">${markup}</div>
      ${jsScriptTagsFromAssets(assets, 'client', 'defer', 'crossorigin')}
  </body>
</html>`;
  return {context, html};
};

const app = express();

app.disable('x-powered-by');
app.use(express.static(process.env.RAZZLE_PUBLIC_DIR));
app.use(pino);
app.use('/api', getAPIRoute());
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  const {context, html} = renderApp(req, res);
  if (context.url) {
    res.redirect(context.url);
  } else {
    res.status(200).send(html);
  }
});
app.use((err, req, res, next) => {
  // TODO: log error here
  if (err instanceof BaseHTTPError) {
    res.status(err.status);
    res.json({
      message: err.message
    });
    return;
  }

  next(err);
});

export default app;

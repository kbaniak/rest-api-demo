/*
 * (C) 2022 Krystian Baniak
 * krystian.baniak@exios.pl
 *
 * */
import process from 'process';
import fs from 'fs';
import restify from 'restify';
import resterr from 'restify-errors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createResponseBody, RepoMaster } from './lib/repoMaster.mjs';

// configuration
const cfg = {
  appVersion: '1.0.1',
  host: '127.0.0.1',
  port: 20070,
  sio: {
    port: 20071,
    room: 'exs'
  },
  dbfile: 'db/db.json',
  persist: false
};
// statistics
const appStats = {
  requests: 0,
  heartbeats: 0,
  get: 0,
  put: 0,
};

/* globals */
const server = restify.createServer();
server.use([
  restify.plugins.authorizationParser(),
  restify.plugins.queryParser(),
  restify.plugins.bodyParser({ mapParams: true }),
  (req,res,next) => { appStats.requests++; next() }
]);
const webInstance = express(); /* express instance*/
const httpServer = http.createServer(webInstance); /* http server with express handler */
const sioMaster = new Server(httpServer, { transports: ['websocket']});
const master = new RepoMaster({
  handle: server,
  config: cfg,
  stats: appStats
});

/* start health-check responder for Kubernetes service monitoring */
webInstance.get('/heartbeat', (req, res) => {
  appStats.heartbeats++;
  res.send('Alive.');
});
 
server.get('/info/:regio', async (req,res,next) => {
  try {
    const _r = createResponseBody(req.path(), cfg.appVersion, cfg.host, cfg.port);
    appStats.get++;
    if (req.params.regio == 'stats') {
      _r.response = { ...appStats }
    }
    res.send(_r);
    return next()
  } catch (err) {
    console.log(`info: ${err.toString()}`);
    return next(new resterr.InternalServerError('request processing failed'))
  }
});


async function startService() {
  console.log(`+ starting rest api worker at: ${cfg.host}:${cfg.port}`);
  master.loadSchema();
  server.listen(cfg.port, () => {
    console.info(`<restapi> service ver: ${cfg.appVersion} is up`)
  });
  httpServer.listen(cfg.sio.port, () => { 
    console.log(`<websck> service is now ready on port: ${cfg.sio.port}`);
  });
}

/* main startup code */
startService()
  .then(() => console.log('service started'))
  .catch(e => {
    console.error(`api service failed: ${e}`);
    process.exit(1)
  })

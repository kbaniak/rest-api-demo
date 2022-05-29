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
import Getopt from 'node-getopt';

// configuration
const cfg = {
  appVersion: '1.0.3',
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

/* commandline params*/
const getopt = new Getopt([
  ['s', 'schema=ARG', 'load specific schema db file' ],
  ['c', 'config=ARG', 'load specific version of configuration' ],
  ['p', 'persist', 'persist schema changes to disk' ],
  ['h', 'help', 'display usage']
]);
getopt.setHelp(
  `(c) 2022 Krystian Baniak, version ${cfg.appVersion}\n` +
  "Usage: node svc.mjs [OPTIONS]\n" +
  "\n" +
  "[[OPTIONS]]\n"
);


/* configuration */
try {
  const opt = getopt.parse(process.argv.slice(2));
  if (opt.options.help) {
    getopt.showHelp();
    process.exit(0);
  }
  if (opt.options.persist) {
    cfg.persist = true;
    console.log(`Warning: schema operations will be persistent!`)
  }
  if (opt.options.schema) {
    if (fs.existsSync(opt.options.schema)) {
      cfg.dbfile = opt.options.schema;
      console.log(`+++ loading schema from: ${cfg.dbfile}`);
    }
  }
  if (opt.options.config && fs.existsSync(opt.options.config)) {
    let _cf = JSON.parse( fs.readFileSync(opt.options.config).toString() );
    if (_cf && _cf.properties) {
      console.log(`+++ loading config options from: ${opt.options.config}`);
      Object.assign(cfg, _cf.properties);
    }
  }
}
catch (e) {
  console.error(`loadcf: error parsing configuration file: ${e}`);
  process.exit(11);
}

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

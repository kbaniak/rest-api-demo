import fs from 'fs';
import resterr from 'restify-errors';
import uuid from 'uuid';
import assert from 'assert';

/* normalized rest api response */
export function createResponseBody(path, appVersion, host, port) {
  return {
    response: null,
    version: `Exios rest-api worker ${appVersion}`,
    selfLink: `http://${host}:${port}${path}`,
    timestamp: Date.now(),
    result: 'success'
  }
}

function testEqual(pa, pb) {
  try {
    assert.deepEqual(pa, pb)
    return true
  }
  catch (err) { }
  return false
}

export class RepoMaster {

  constructor(opts) {
    this.ref = opts.handle;
    this.cfg = opts.config;
    this.def = null;
    this.items = {};  // entities from schema
  }

  sync() {
    const ns = { ...this.def };
    ns.records = { ...this.items };
    ns.lastUpdated = Date.now();
    fs.copyFileSync(this.cfg.dbfile, this.cfg.dbfile + '.previous');
    fs.writeFileSync(this.cfg.dbfile, JSON.stringify(ns, null, 2))
  }
  
  loadSchema() {
    const self = this;
    self.def = JSON.parse(fs.readFileSync(this.cfg.dbfile).toString());
    const prefix = self.def.prefix;
    
    if ('records' in self.def) {
      for (const key of Object.keys(self.def.records)) {
        self.items[key] = [ ...self.def.records[key] ]
      }
    }
  
    for (const entity of Object.keys(self.def.schema)) {
      
      console.log(`<api> register hooks for ${entity}`);
      if (!(entity in self.items)) self.items[entity] = [];

      // GET method
      self.ref.get(`/${prefix}/${entity}/:id`, (req,res,next) => {
        try {
          const r = createResponseBody(req.path(), self.cfg.appVersion, self.cfg.host, self.cfg.port);
          const kindType = `isa:${prefix}.${entity}`;
          if (req.params.id) {
            if (entity in self.items) {
              const it = self.items[entity].find(f => f.id === req.params.id);
              if (it) {
                r.response = { ...it, kind: kindType }
              } else {
                r.result = "failed";
                r.error = "instance has not been found"
              }
            } else {
                r.result = "failed";
                r.error = "instance has not been found"
            }
          } else {
            // return whole collection
            if (entity in self.items)
              r.response = self.items[entity].map(e => { return { ...e, kind: kindType }})
            else
              r.response = []
          }
          res.send(r);
          return next()
        } catch (err) {
          console.log(`${entity}:get ${err.toString()}`);
          return next(new resterr.InternalServerError('request processing failed'))
        }
      });
      
      // POST method
      self.ref.post(`/${prefix}/${entity}/`, (req,res,next) => {
        try {
          const r = createResponseBody(req.path(), self.cfg.appVersion, self.cfg.host, self.cfg.port);
          const kindType = `isa:${prefix}.${entity}`;
          const el = self.parseSchemaEntity(entity, req.params);
          if (el) {
            el.id = uuid.v4();
            r.response = {
              ...el,
              kind: kindType
            }
            console.log(`<api> create record of type ${entity} id: ${el.id}`)
            self.items[entity].push(el);
            if (self.cfg.persist)
              self.sync()
          } else {
            r.error = 'invalid entity declaration';
            r.result = 'failed'
          }
          res.send(r);
          return next()
        } catch (err) {
          console.log(`${entity}:post ${err.toString()}`);
          return next(new resterr.InternalServerError('request processing failed'))
        }
      });

      // PUT method
      self.ref.put(`/${prefix}/${entity}/:id`, (req,res,next) => {
        try {
          const r = createResponseBody(req.path(), self.cfg.appVersion, self.cfg.host, self.cfg.port);
          const kindType = `isa:${prefix}.${entity}`;
          if ('id' in req.params && req.params.id) {
            const eli = self.items[entity].findIndex(f => f.id === req.params.id);
            if (eli > -1) {
              const el = { ...self.items[entity][eli] };
              const ns = self.patchSchemaEntity(entity, el, req.params);
              if (ns) {
                const same = testEqual(ns, el);
                self.items[entity]
                r.response = {
                  state: same ? 'record not modified' : 'record updated',
                  ref: { ...ns }
                }
                if (!same) { 
                  console.log(`<api> update record of type ${entity} id: ${req.params.id}`)
                  self.items[entity][eli] = ns;
                  if (self.cfg.persist)
                    self.sync()
                } else {
                  console.log(`<api> record left intact of type ${entity} id: ${req.params.id}`)
                }
              } else {
                r.error = 'invalid update request';
                r.result = 'failed'
              }
            } else {
              r.error = 'entity not found';
              r.result = 'failed'
            }
          } else {
            r.error = 'ambiguous request';
            r.result = 'failed'
          }
          res.send(r);
          return next()
        } catch (err) {
          console.log(`${entity}:put ${err.toString()}`);
          return next(new resterr.InternalServerError('request processing failed'))
        }
      });
      
      // DELETE method
      self.ref.del(`/${prefix}/${entity}/:id`, (req,res,next) => {
        try {
          const r = createResponseBody(req.path(), self.cfg.appVersion, self.cfg.host, self.cfg.port);
          const kindType = `isa:${prefix}.${entity}`;
          if ('id' in req.params && req.params.id) {
            const eli = self.items[entity].findIndex(f => f.id === req.params.id);
            if (eli > -1) {
              const el = self.items[entity][eli];
              self.items[entity]
              r.response = {
                state: 'record deleted',
                ref: { ...el}
              }
              console.log(`<api> delete record of type ${entity} id: ${req.params.id}`)
              self.items[entity].splice(eli, 1)
              if (self.cfg.persist)
                self.sync()
            } else {
              r.error = 'entity not found';
              r.result = 'failed'
            }
          } else {
            r.error = 'ambiguous request';
            r.result = 'failed'
          }
          res.send(r);
          return next()
        } catch (err) {
          console.log(`${entity}:delete ${err.toString()}`);
          return next(new resterr.InternalServerError('request processing failed'))
        }
      });

    }
  }

  patchSchemaEntity(eName, src, params) {
    const self = this;
    try {
      let el = { ...src };
      const rules = self.def.schema;
      if (eName in rules) {
        const entityKeys = Object.keys(rules[eName]);
        for (const key in params) {
          if (key === 'id') continue; 
          if (!entityKeys.includes(key)) throw new Error(`unknown property specified: ${key} ${entityKeys}`);
          const ri = rules[eName][key];
          if (typeof(params[key]) === ri.type) {
            el[key] = params[key]
          } else {
            throw new Error(`param ${key} not valid`)
          }
        }
      } else
        throw new Error('invalid entity name')
      return el;
    } catch (err) {
      console.error(`${eName}: parse failed for: ${err.toString()}`)
    }
    return null
  }

  parseSchemaEntity(eName, params) {
    const self = this;
    try {
      let el = {};
      const rules = self.def.schema;
      if (eName in rules) {
        for (const key in rules[eName]) {
          const ri = rules[eName][key];
          if (key in params && typeof(params[key]) === ri.type) {
            el[key] = params[key]
          } else {
            throw new Error(`param ${key} not valid`)
          }
        }
      } else
        throw new Error('invalid entity name')
      return el;
    } catch (err) {
      console.error(`${eName}: parse failed for: ${err.toString()}`)
    }
    return null
  }

}


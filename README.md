# rest-api-demo

demo rest api for presentation purposes
depends on:
```
- nodejs >= 16.x
- express
- restify
- restify-errors
- uuid
- node-getopt
```

This simple service implements a rest api that provides CRUD functionality for json based schema.
By default scheme changes are not persisted to disk. To change that you need to add -p parametr on a command line. 

`node svc.mjs -p`


Operations:

* GET - list all entities or show details of an entity identified with uuid (id)
* POST - create new entity
* DELETE - delete entity with uuid as identifier
* PUT - modify entity with uuid as identifier

Example includes School schema with user and group entities.

## Schema Definition 

Schema is kept as JSON data in `db.db.json`.

The `schema` key contains definition for entity attributes.
The `records` dictionary allows you to provide arrays with entities. 

```
{
  "prefix": "school",
  "schema": {
    "user": {
      "name": { "type": "string" },
      "nick": { "type": "string" },
      "surname": { "type": "string" },
      "age": { "type": "number" }
    },
    "group": {
      "name": { "type": "string" },
      "description": { "type": "string" }
    }
  },
  "records": {
    "group": [
      { "id": "09bdaaef-b31c-4814-8f71-15c3ef99586d", "name": "teachers", "description": "example group" }
    ]
  }
}
```

The HTTP request for api is:  `/$PREFIX/$ENTITY/$ID`.
ID is required for detailed inspection, removal or modification.

## Usage

Examples of usage with curl.
All entities are referenced by id {UUID}.


### list resources

```
$ curl -sk http://127.0.0.1:20070/school/user/ | jq
{
  "response": [],
  "version": "Exios rest-api worker 1.0.2",
  "selfLink": "http://127.0.0.1:20070/school/user/",
  "timestamp": 1653823499107,
  "result": "success"
}

```

### cretate resource

```
$ curl -sk -XPOST -H'Content-Type: application/json' -d '{"name":"Czesiek","surname":"Myszaty","nick":"cmysz","age":23}' http://127.0.0.1:20070/school/user/ | jq
{
  "response": {
    "name": "Czesiek",
    "nick": "cmysz",
    "surname": "Myszaty",
    "age": 23,
    "id": "638d8b4c-d509-4f9b-9ea0-78ed1e8034ee",
    "kind": "isa:school.user"
  },
  "version": "Exios rest-api worker 1.0.1",
  "selfLink": "http://127.0.0.1:20070/school/user/",
  "timestamp": 1653822998564,
  "result": "success"
}

$ curl -sk http://127.0.0.1:20070/school/user/ | jq
{
  "response": [
    {
      "name": "Czesiek",
      "nick": "cmysz",
      "surname": "Myszaty",
      "age": 23,
      "id": "638d8b4c-d509-4f9b-9ea0-78ed1e8034ee",
      "kind": "isa:school.user"
    }
  ],
  "version": "Exios rest-api worker 1.0.1",
  "selfLink": "http://127.0.0.1:20070/school/user/",
  "timestamp": 1653823000276,
  "result": "success"
}


```
### remove resource

The state parameter in the response will show if record is deleted.

```
$ curl -sk -XDELETE http://127.0.0.1:20070/school/user/638d8b4c-d509-4f9b-9ea0-78ed1e8034ee | jq
{
  "response": {
    "state": "record deleted",
    "ref": {
      "name": "Czesiek",
      "nick": "cmysz",
      "surname": "Myszaty",
      "age": 23,
      "id": "638d8b4c-d509-4f9b-9ea0-78ed1e8034ee"
    }
  },
  "version": "Exios rest-api worker 1.0.2",
  "selfLink": "http://127.0.0.1:20070/school/user/638d8b4c-d509-4f9b-9ea0-78ed1e8034ee",
  "timestamp": 1653823623781,
  "result": "success"
}



$ curl -sk http://127.0.0.1:20070/school/user/ | jq
{
  "response": [],
  "version": "Exios rest-api worker 1.0.2",
  "selfLink": "http://127.0.0.1:20070/school/user/",
  "timestamp": 1653823499107,
  "result": "success"
}

```

### update resource

! Note that API will check if modification is indeed needed. The state will indicate when change actualy happend.

Attempt to modify an age of a pupil.

```
--
-- fist attempt
--
$curl -sk -XPUT -H'Content-Type: application/json' -d '{"age":25}' http://127.0.0.1:20070/school/user/638d8b4c-d509-4f9b-9ea0-78ed1e8034ee | jq
{
  "response": {
    "state": "record updated",
    "ref": {
      "name": "Czesiek",
      "nick": "cmysz",
      "surname": "Myszaty",
      "age": 25,
      "id": "638d8b4c-d509-4f9b-9ea0-78ed1e8034ee"
    }
  },
  "version": "Exios rest-api worker 1.0.1",
  "selfLink": "http://127.0.0.1:20070/school/user/638d8b4c-d509-4f9b-9ea0-78ed1e8034ee",
  "timestamp": 1653823008375,
  "result": "success"
}
```

now repeat operation:

```
--
-- second attempt
--
$ curl -sk -XPUT -H'Content-Type: application/json' -d '{"age":25}' http://127.0.0.1:20070/school/user/638d8b4c-d509-4f9b-9ea0-78ed1e8034ee | jq

{
  "response": {
    "state": "record not modified",
    "ref": {
      "name": "Czesiek",
      "nick": "cmysz",
      "surname": "Myszaty",
      "age": 25,
      "id": "638d8b4c-d509-4f9b-9ea0-78ed1e8034ee"
    }
  },
  "version": "Exios rest-api worker 1.0.1",
  "selfLink": "http://127.0.0.1:20070/school/user/638d8b4c-d509-4f9b-9ea0-78ed1e8034ee",
  "timestamp": 1653823018982,
  "result": "success"
}

```

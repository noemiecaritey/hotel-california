/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_340737475")

  // update collection data
  unmarshal({
    "name": "lunettes"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_340737475")

  // update collection data
  unmarshal({
    "name": "lunette"
  }, collection)

  return app.save(collection)
})

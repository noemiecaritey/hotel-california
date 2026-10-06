/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2903569922")

  // remove field
  collection.fields.removeById("text1041995051")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2903569922")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1041995051",
    "max": 0,
    "min": 0,
    "name": "monture",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})

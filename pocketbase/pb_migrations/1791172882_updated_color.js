/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2903569922")

  // add field
  collection.fields.addAt(1, new Field({
    "help": "",
    "hidden": false,
    "id": "select59357059",
    "maxSelect": 1,
    "name": "tag",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "monture",
      "verre"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2903569922")

  // remove field
  collection.fields.removeById("select59357059")

  return app.save(collection)
})

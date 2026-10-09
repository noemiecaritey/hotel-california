/// <reference path="../pb_data/types.d.ts" />
// Catalogue lisible par tout le monde (lecture seule) : le site récupère les lunettes sans être connecté.
const COLLECTIONS = ["lunettes", "color", "variantes"]

migrate((app) => {
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name)
    collection.listRule = ""
    collection.viewRule = ""
    app.save(collection)
  }
}, (app) => {
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name)
    collection.listRule = null
    collection.viewRule = null
    app.save(collection)
  }
})

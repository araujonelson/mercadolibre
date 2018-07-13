var mongoose = require('mongoose');

//Instance the Schema
var Schema = mongoose.Schema;

//Creamos el schema para logging
var logging_schema = new Schema({
	ip: String,
    path: String,
    timestamp: String
});

var loggingSchema = mongoose.model('loggingModel', logging_schema);

module.exports = loggingSchema;
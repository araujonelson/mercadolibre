const mongoose     = require('mongoose');

//Conexión a MongoDB
const mongoUrl = 'mongodb://10.0.1.49:27017,10.0.1.80:27017/proxylogging?replicaSet=mongodb-replica-set';

// Realizo la conexión al Replica Set de MongoDB.
mongoose.connect(mongoUrl, { useNewUrlParser: true }, function (err) {
    if (err) throw err;
    console.log('MongoDB Replicate Set Successfully connected');
 });
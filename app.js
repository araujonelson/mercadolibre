'use strict';

//Dependencias
const express      = require('express');
const axios        = require('axios');
const responseTime = require('response-time')
const dateTime     = require('node-datetime');
const cluster      = require('cluster');
const loggingModel = require('./model/logging.js');
const redisUtils   = require('./util/redis.js');
require('./util/mongo.js');

//Importo las variables de Redis
const redisQueue     = redisUtils.redisQueue;
const redisWorker    = redisUtils.redisWorker;
const redisQueueName = redisUtils.redisQueueName;
const redisClient    = redisUtils.redisClient;

var DEBUG = true;

//Cargo Express Framework
const app = express();

//Creo un middleware que agrega header X-Response-Time a la respuestas
app.use(responseTime());

// Code to run if we're in the master process
if (cluster.isMaster) {

  DEBUG && console.log(`Master ${process.pid} is running`);
  // Count the machine's CPUs
  var numCPUs = require('os').cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    DEBUG && console.log(`Forking process number ${i}...`);
    cluster.fork();
  }

// Code to run if we're in a worker process
} else {
  //Creo la cola en caso de que aún no haya sido creada
  redisQueue.createQueue({qname: redisQueueName}, function (err, resp) {
    if (resp===1) {
      console.log("Cola creada!");
    }
  });

  const callApi = (req, res) => {
    //Obtengo el path del request
    var path = req.originalUrl;
    var proxyUrl = `https://api.mercadolibre.com${path}`;
    return axios.get(proxyUrl)
      .then(response => {
        //Obtengo el json de la respuesta
        let json = response.data;
        //Cacheo la respuesta según su path y el objeto json por 5 minutos (300 segundos)
        redisClient.setex(path, 300, JSON.stringify(json));
        //Envío la respuesta al cliente
        res.send(json);
        //Envío el log a la cola
        sendMessageToQueue(req, getCurrentTime());
      })
      .catch(err => {
        res.send('Ops! Ocurrió un error.');
      });
  };

  const getCache = (req, res) => {
    //Verifico si el path a consultar está cacheado
    redisClient.get(req.originalUrl, (err, result) => {
      //En caso de estar cacheado, envío la respuesta al cliente y envío el log a la cola.
      if (result) {
        res.send(result);
        sendMessageToQueue(req, getCurrentTime());
      //Caso contrario, llamo al API a través del proxy reverso creado.
      } else {
        callApi(req, res);
      }
    });
  }

  //Función encargada de enviar todos los mensajes a la cola.
  function sendMessageToQueue(req, timestamp) {
    var redisQueueMessage = "{\"path\": \""+req.originalUrl+"\", \"ip\": \""+req.headers['x-forwarded-for']+"\", \"timestamp\": \""+timestamp+"\" }";
    redisQueue.sendMessage({qname: redisQueueName, message: redisQueueMessage}, function (err, resp) {
      if(err) console.log("Error al insertar en la cola");
      DEBUG && console.log("Mensaje enviado a la cola");
    });
  }

  function getCurrentTime() {
    var dt = dateTime.create();
    var formatted = dt.format('d/m/Y H:M:S');
    return formatted;
  }

  //Listener que recibe los mensajes de la cola
  redisWorker.on("message", function(msg, next, id){
    DEBUG && console.log("Mensaje recibido de la cola",id);
    //Convierto el mensaje a JSON-like para mejor manipulación
    var messageAsJson = JSON.parse(msg);
    
    //Preparamos el objeto a insertar
    var newLog = loggingModel({
      ip: messageAsJson['ip'],
      path: messageAsJson['path'],
      timestamp: messageAsJson['timestamp']
    });

    //Insertamos el log en la BD
    newLog.save(function(err) {
      if (err) throw err;
      DEBUG && console.log("Log insertado correctamente");
    });
    next()
  });

  // Cualquier conexión la manejo por el método getCache para comprobar
  // que exista en cache, caso contrario la desvío al proxy.
  app.get('/*', getCache);

  app.listen(3000, function () {
    console.log('meli-proxy listening on port 3000!');
    redisWorker.start();
  });

}
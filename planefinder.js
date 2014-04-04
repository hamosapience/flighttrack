var geolib = require('geolib');
var planefinder = require('planefinder');
var fr = require("./fr-client.js");
var geom = require("./geom.js");

var coords = {
  latitude: 55.75292,
  longitude: 37.617437
};
var maxDistance = 50000;  // meters

var center = coords;




var bounds = geolib.getBoundsOfDistance(coords, maxDistance);

var pfClient = planefinder.createClient({
    bounds: bounds,
    interval: 1000
});

var frClient = fr.createClient({
    bounds: bounds,
    interval: 1000
});

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs');

io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('log level', 1);
io.set('transports', [
    'websocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
]);

app.listen(8000);

function handler (req, res) {
  fs.readFile(__dirname + '/client.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

io.sockets.on('connection', function(socket){
    pfClient.on('data', function(traffic) {
        socket.emit('pf-traffic', {
            data: traffic
        });
    });
    frClient.on('data', function(traffic) {
        socket.emit('fr-traffic', {
            data: traffic
        });
    });
});



pfClient.resume();
frClient.resume();


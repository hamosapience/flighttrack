var geolib = require('geolib');
var planefinder = require('./pf-client');
var fr = require("./fr-client.js");
var geom = require("./geom.js");
var ftdb = require("./fltr-db.js");

var center = {
    latitude: 55.752685,
    longitude: 37.62
};

var sectorStartPoint = {
    latitude: 58.54,
    longitude: 38.74
};
var sectorEndPoint = {
    latitude: 57.5195,
    longitude: 67.7391
};

var maxDistance = 500000;  // meters

function sectorFilter(plane){
    return geom.isWithinRadius(plane, center, 0, 500000);
}

var bounds = geolib.getBoundsOfDistance(center, maxDistance);

var pfClient = planefinder.createClient({
    bounds: bounds,
    interval: 3000,
    filter: sectorFilter
});

var frClient = fr.createClient({
    bounds: bounds,
    interval: 1000,
    filter: sectorFilter
});

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs');

io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('log level', 1);
io.set('transports', [
    'websocket',
    'htmlfile',
    'xhr-polling',
    'jsonp-polling'
]);

app.listen(8010);

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
    pfClient.on('data', function(data) {
        ftdb.writeData(data);
        socket.emit('pf-traffic', {
            data: data
        });
    });
    // frClient.on('data', function(traffic) {
    //     socket.emit('fr-traffic', {
    //         data: traffic
    //     });
    // });
});



pfClient.resume();
ftdb.startCleaning(1000, 10);
// frClient.resume();


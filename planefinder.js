var geolib = require('geolib');
var planefinder = require('./pf-client');
var fr = require("./fr-client.js");
var geom = require("./geom.js");
var ftdb = require("./fltr-db.js");
var fs = require("fs");

var configFile = "./config.dev.js";

var config = JSON.parse(fs.readFileSync(configFile));

var coordList = [
{
    "latitude": "41.17",
    "longitude": "12.11"
},{
    "latitude": "76.15",
    "longitude": "7.01"
},{
    "latitude": "59.58",
    "longitude": "33.63"
}, {
    "latitude": "54",
    "longitude": "33"
}];

function sectorFilter(plane){
    // return true;
    var p = plane;
    p.longitude = plane.longitude.toString();
    p.latitude = plane.latitude.toString();
    return geolib.isPointInside(p, coordList);
}

var bounds = geolib.getBounds(coordList);
bounds = [ {
    latitude: bounds.minLat, longitude: bounds.minLng
}, {
    latitude: bounds.maxLat, longitude: bounds.maxLng
} ];

var pfClient = planefinder.createClient({
    bounds: bounds,
    interval: 2000,
    filter: sectorFilter
});


var dt = new ftdb.dataTransport();

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

var trackListeners = {};
var tracked = {};
function addTrackListener(hex_ident, socket){
    if (hex_ident in trackListeners) {
        trackListeners[hex_ident].push(socket);
    }
    else {
        trackListeners[hex_ident] = [socket];
        dt.on("flightTrack-" + hex_ident, function(data){
            for (var socketId in trackListeners[hex_ident]){
                trackListeners[hex_ident][socketId].emit('flightTrack', data);
            }
        });
    }
}
function removeTrackListeners(hex_ident, socket){
    if (!trackListeners[hex_ident]){
        return;
    }
    for (var i = 0; i < trackListeners[hex_ident].length; i++){
        if (trackListeners[hex_ident][i].id === socket.id){
            trackListeners[hex_ident].pop(i);
            if (trackListeners[hex_ident].length === 0){
                dt.stopFlightTracking(hex_ident);
            }
        }
    }
}


// pfClient.on('data', function(data) {
//     ftdb.writeData(data);
// });

frClient.on('data', function(data) {
    ftdb.writeData(data);
});

io.sockets.on('connection', function(socket){

    var tracking;

    var trackingInt;
    dt.on("flightList", function(data){
        socket.emit('flightList', {
            data: data
        });
    });

    socket.on("startTracking", function(hex_ident){
        tracking = hex_ident;
        trackingInt = dt.startFlightTracking(hex_ident);
        addTrackListener(hex_ident, socket);
    });

    socket.on("stopTracking", function(){
        removeTrackListeners(tracking, socket);
        tracking = undefined;
    });

    socket.on("disconnect", function(){
        removeTrackListeners(tracking, socket);
        tracking = undefined;

    });

});





dt.start(1000);
// pfClient.resume();
ftdb.startCleaning(3000, 10);
frClient.resume();


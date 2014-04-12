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
    console.log('removeTrackListeners', hex_ident, socket.id);
    for (var i = 0; i < trackListeners[hex_ident].length; i++){
        if (trackListeners[hex_ident][i].id === socket.id){
            console.log('removing', socket.id);
            trackListeners[hex_ident].pop(i);
            if (trackListeners[hex_ident].length === 0){
                dt.stopFlightTracking(hex_ident);
            }
        }
    }
}


pfClient.on('data', function(data) {
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

    // frClient.on('data', function(traffic) {
    //     socket.emit('fr-traffic', {
    //         data: traffic
    //     });
    // });
});





dt.start(2000);
pfClient.resume();
ftdb.startCleaning(3000, 10);
// frClient.resume();


var moment = require("moment");
var redis = require("redis");
var pg = require('pg');
var events = require('events');
var util = require('util');

var conString = "postgres://hamomd5:p0stgr3s13@localhost/hamo";

var pgClient = new pg.Client(conString);
pgClient.connect();
var redisClient = redis.createClient();
redisClient.select(0);
redisClient.flushdb();

exports.dataTransport = function(){
};
util.inherits(exports.dataTransport, events.EventEmitter);

var dataTransport = exports.dataTransport;


var cache = {};
var cleaner;

dataTransport.prototype.getFlightList = function(){
    var that = this;
    pgClient.query(
        'SELECT DISTINCT ON ("hex-ident") "flight_no", "hex-ident" FROM meteo."flight-track";',
        function(err, data){
            that.emit("flightList", data.rows);
        }
    );
};

dataTransport.prototype.getFlightTrack = function(hex_ident){
    var that = this;
    pgClient.query(
        'SELECT timestamp, lat, lon, altitude, speed FROM meteo."flight-track" t ' +
        'WHERE t."hex-ident" = \'' + hex_ident + "' ORDER BY timestamp;",
        function(err, data){
            that.emit("flightTrack-" + hex_ident, data.rows);
        });
};

dataTransport.prototype.startFlightTracking = function(hex_ident, interval){
    var binded = this.getFlightTrack.bind(this);
    return setInterval(function(){
        binded(hex_ident);
    }, interval);
};

dataTransport.prototype.start = function(interval){
    setInterval(this.getFlightList.bind(this), interval);
};

function writeDataToPg(plane){
    var timestamp = moment().toISOString();
    pgClient.query(
        'INSERT INTO meteo."flight-track" ' +
        '("hex-ident", timestamp, lat, lon, speed, altitude, flight_no) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [plane.hex_ident, timestamp, plane.lat, plane.lon, plane.ground_speed, plane.altitude, plane.flight_no],
        function(err, result) {
            if (err){
                return console.error('error running query', err);
            }
        }

    );
}


function cleanOld(timeout){
    var tresh = moment().subtract("minutes", timeout).toISOString();
    pgClient.query(
        'DELETE FROM meteo."flight-track" '+
        "WHERE timestamp < '" + tresh + "'"
    );
}

exports.writeData = function (data) {
    data.forEach(function(plane){
        var coordString = plane.lat + "," + plane.lon;
        var hex_ident = plane.hex_ident;
        redisClient.get(hex_ident, function(err, cachedCoordString){
            if (cachedCoordString !== coordString){
                redisClient.set(hex_ident, coordString);
                writeDataToPg(plane);
            }
        });
    });

};


exports.startCleaning = function(interval, timeout){
    setInterval(function(){
        cleanOld(timeout);
    }, interval);
};




var moment = require("moment");
var redis = require("redis");
var pg = require('pg');
var events = require('events');
var util = require('util');

var conString = "postgres://hamomd5:p0stgr3s13@localhost/hamo";

var TRACKING_INTERVAL = 1000;

var pgClient = new pg.Client(conString);
pgClient.connect();
var redisClient = redis.createClient();
redisClient.select(0);


redisClient.flushdb();
// pgClient.query('DELETE FROM meteo."flight-track"');
// pgClient.query('SELECT DISTINCT ON ("hex-ident") "hex-ident", "lat", "lon" FROM (SELECT * FROM meteo."flight-track" ORDER BY "timestamp" DESC) ordered;', function(err, data){
//     console.log('initial');
//     data.rows.forEach(function(item){
//         redisClient.set(item["hex-ident"], item.lat + "," + item.lon);
//     });
// });


exports.dataTransport = function(cb){
};

util.inherits(exports.dataTransport, events.EventEmitter);

var dataTransport = exports.dataTransport;


var cache = {};
var tracked = {};
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
            console.log(data);
            that.emit("flightTrack-" + hex_ident, data.rows);
        });
};

function cleanOld(timeout){
    var tresh = moment().subtract("minutes", timeout).toISOString();
    pgClient.query(
        'DELETE FROM meteo."flight-track" '+
        "WHERE timestamp < '" + tresh + "'"
    );
}

dataTransport.prototype.startFlightTracking = function(hex_ident){
    if (hex_ident in tracked){
        return;
    }
    var binded = this.getFlightTrack.bind(this);
    var t = setInterval(function(){
        binded(hex_ident);
    }, TRACKING_INTERVAL);
    tracked[hex_ident] = t;

};

dataTransport.prototype.stopFlightTracking = function(hex_ident){
    clearInterval(tracked[hex_ident]);
    delete tracked[hex_ident];
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


exports.writeData = function (data) {
    if (!data){
        return;
    }
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





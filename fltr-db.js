var moment = require("moment");
var redis = require("redis");
var pg = require('pg');
var conString = "postgres://hamomd5:p0stgr3s13@localhost/hamo";

var pgClient = new pg.Client(conString);
var redisClient = redis.createClient();

redisClient.select(0);
redisClient.flushdb();

pgClient.connect();

var cache = {};
var cleaner;

var cacheMod = "memory";

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


function cacheGet(key, cb){
    if (cacheMod === "memory"){
        cb(err, cache[key]);
    }
    if (cacheMod === "redis"){
        client.get();
    }
}

exports.writeData = function (data) {
    data.forEach(function(plane){
        var coordString = plane.lat + "," + plane.lon;
        var hex_ident = plane.hex_ident;
        redisClient.get(hex_ident, function(err, cachedCoordString){
            console.log(cachedCoordString);
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

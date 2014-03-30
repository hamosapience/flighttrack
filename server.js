var request = require("request");
var io = require('socket.io').listen(8000);

var dataUrl = "http://bma.fr24.com/zones/europe_all.js";
var data;

var pd_callback = function(x){
    return x;
};

// [HEX-CODE, LAT, LON, TRACK, ALTITUDE, SPEED, SQUAWK, RADAR, AIRCRAFT, REGISTRATION, ???, FROM, TO, FLIGHT_N?, ???, ???, ID?, ???]

setInterval(function(){
    data = request("http://bma.fr24.com/zones/europe_all.js", function(error, response, body){
        data = eval(body);
        console.log(data["2fc63d2"]);
    });
}, 4000);





var request = require("request");
var fs = require("fs");

setInterval(function(){

var data = request("http://bma.fr24.com/zones/europe_all.js", function(error, response, body){
    console.log(response);
    fs.writeFileSync("data" + Math.floor(Math.random()*6 + 1) + ".js", body);
});
}, 60000);

var config = require('./config/config.json');
var util = require('util');

var conn =  config;
var connString = util.format("pg://%s:%s@%s:%d/%s", conn.user, conn.password, conn.host, conn.port, conn.database);

var Connect = require('./pgclient');



function balanser(maxCountConnect, minCountConnect, arrayTybes) {

}

balanser.prototype.addQuery = function(tube, query, cb) {

};



function GPSconnect() {
    Connect.apply(this, arguments);
}

GPSconnect.prototype = Object.create(Connect.prototype);

GPSconnect.prototype.priority = 5;

var gps = new GPSconnect(connString);
gps.on('open', function() {
    gps.addQuery('select * from test', [], function(err, result) {
        console.log(result);
    });

    gps.addQuery('select * from test', [], function(err, result) {
        console.log(result);
    });

    gps.addQuery('select  from test', [], function(err, result) {
        if(err) console.log(err);
        console.log(result);
    });

    gps.start();
});

gps.on('maxCount', function(message) {
    console.log(message);
});





//connect.on('open', function() {
//
//
//    connect.addQuery('select * from test', [], function(err, result) {
//        console.log(result);
//    });
//
//
//
//    setTimeout(function() {
//        connect.addQuery('select * from test', [], function(err, result) {
//            console.log(result);
//        });
//
//        connect.addQuery('select * from test', [], function(err, result) {
//            console.log(result);
//        });
//
//        connect.start();
//
//
//
//    }, 2000);
//});
//
//connect.on('error', function(err) {
//    console.log(err);
//});













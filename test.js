var config = require('./config/config.json');

var conn =  config;
var connString = "pg://"+ conn.user +":"+ conn.password +"@"+ conn.host +":"+ conn.port +"/" + conn.database;

var Connect = require('./client');
var Balancer = require('./');


var pg = require('pg');
pg.defaults.poolSize = 200;

function pgclient() {
    Connect.apply(this, arguments);
}

pgclient.prototype = Object.create(Connect.prototype);
pgclient.prototype.open = function(open, cb) {
    pg.connect(connString, function(err, client, done) {
        if (err) {
            return err;
        }
        open();
        cb(client);
    });
};

pgclient.prototype.close = function(close, client) {
    client.end();
    close();
};

pgclient.prototype.send = function(arg, client) {
    client.query(arg[0], arg[1], arg[2]);
};

Balancer.import(pgclient);

var balancer = new Balancer(10,50, connString);
balancer.on('ready', function() {
    run();

    function run() {
        var y=0;
        var time = +new Date();
        for(var i=0;i<1200; i++) {
            balancer.addQuery('select pg_sleep(1)', [], function(err, result) {
                if(err) console.log(err);
                console.log(y);
                y++;
                if(y==1200) {
                    console.log(balancer._connectArray.length);
                    console.log(+new Date()-time, 1);
                    run1();

                }
            });
        }
    }

    function run1() {

        var y=0;
        var time = +new Date();
        for(var i=0;i<1200; i++) {
            balancer.addQuery('select pg_sleep(1)', [], function(err, result) {
                if(err) console.log(err);
                console.log(y);
                y++;
                if(y==1200) {
                    console.log(balancer._connectArray.length);
                    console.log(+new Date()-time, 2);
                }
            });
        }
    }
});

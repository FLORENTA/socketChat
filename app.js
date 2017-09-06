/* Loading node modules needed */
var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var ent = require('ent');
var io = require('socket.io').listen(server);
var dateFormat = require("dateformat");
var mysql = require("mysql");
var uniqid = require("uniqid");
var md5 = require("js-md5");
var bodyParser = require("body-parser");
var urlencodedParser = bodyParser.urlencoded({extended : false});
var session = require("express-session");
var sharedSession = require("express-socket.io-session");

app.set("trust proxy", 1);

/* Connexion to the database */
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "chat"
});

/* Initialization */
con.connect(function(err){

    if(err) throw err;

    console.log("connected !");

});

/* To get static files in public folder */
app.use(express.static(__dirname + "/public"));

/* Session */
app.use(session({secret : uniqid()}));

/* Shared session with socket.io */
io.use(sharedSession(session));

/* Homepage */
app.get("/", function(req, res){

    res.render("home.ejs", {
        path : req.path
    });

});

/* Renders the chat interface */
app.get("/chat", function(req, res){

    if(req.session && req.session.loggedIn === true){

        var sqlUpdateConnected = "UPDATE members SET connected = true WHERE token = " + mysql.escape(req.session.token);
        var sqlMembers = "SELECT * FROM members WHERE connected = true";

        con.query(sqlUpdateConnected, function(err, result){
            if (err) throw err;
        });

        con.query(sqlMembers, function(err, results){
            if (err) throw err;

            res.render("chat.ejs", {
                path: req.path,
                token: req.session.token,
                username: req.session.username,
                connectedMembers: results
            });
        });
    }
    else{
        res.redirect("/login");
    }

});

/* Page to create an account */
app.get("/account/create", function(req, res){

    res.render("register.ejs", {
        url : "/register/action",
        path : req.path
    });

});

/* Page to check account information */
app.get("/account/modify", function(req, res){

    if(req.session && req.session.loggedIn === true){

        var sql = "SELECT * FROM members WHERE token = " + mysql.escape(req.session.token);

        con.query(sql, function(err, result){
            if (err) throw err;

            if(result.length === 0){
                res.redirect("/myHome", {
                    path: req.path,
                    username: req.session.username
                });
            }
            else{
                /* Render the page with the result to fill in the fields */
                res.render("register.ejs", {
                    path: req.path,
                    username: result[0].username,
                    name: result[0].name,
                    firstname: result[0].firstname,
                    url : req.url,
                    email: result[0].email
                });
            }
        });
    }
    else{
        res.redirect("/login");
    }

});

app.post("/account/modify", urlencodedParser, function(req, res) {

    if (req.session && req.session.loggedIn === true){
        var member = {
            name: ent.encode(req.body.name),
            firstname: ent.encode(req.body.firstname),
            username: ent.encode(req.body.username),
            email: ent.encode(req.body.email),
            password: md5(ent.encode(req.body.password)),
            connected: false
        };

        var sql = "UPDATE members SET ? WHERE token = " + mysql.escape(req.session.token);

        con.query(sql, member, function(err){
            if (err) throw err;

            /* The username may have changed */
            req.session.username = member.username;
            res.redirect("/account/modify");
        });
    }
    else{
        redirect("/");
    }

});

/* Treatment page if a user creates an account */
app.post("/register/action", urlencodedParser, function(req, res){

    var member = {
        name: ent.encode(req.body.name),
        firstname: ent.encode(req.body.firstname),
        username: ent.encode(req.body.username),
        email: ent.encode(req.body.email),
        password: md5(ent.encode(req.body.password)),
        token: md5(uniqid()),
        connected: false
    };

    var sql = "INSERT INTO members SET ?";

    con.query(sql, member, function(err){
        if (err) throw err;
    });

    res.redirect("/login");

});

/* Login page to access personal interface & chat */
app.get("/login", function(req, res){

    res.render("login.ejs", {
        url : "/login",
        path : req.path
    });

});

/* User homepage */
app.get("/myHome", function(req, res){

    if(req.session && req.session.loggedIn === true){
        res.render("my_homepage.ejs", {
            path: req.path,
            username: req.session.username
        });
    }
    else{
        res.redirect("/login");
    }
});

/* Checking login & username */
app.post("/login", urlencodedParser, function(req, res){

    var username = ent.encode(req.body.username);
    var password = md5(ent.encode(req.body.password));

    var sql = "SELECT * FROM members WHERE username = " + mysql.escape(username) +
              " AND password = " + mysql.escape(password) + "";

    con.query(sql, function(err, result){
        if(err) throw err;

        if(result.length === 0){
            res.redirect("/login");
        }
        else{
            req.session.username = username;
            req.session.token = result[0].token;
            req.session.loggedIn = true;

            res.redirect("/myHome");
        }
    });
});

/* Logout */
app.get("/logout", function(req, res){

    var sqlUpdateConnectedStatus = "UPDATE members SET connected = false WHERE token = " +
                                    mysql.escape(req.session.token) + "";

    con.query(sqlUpdateConnectedStatus, function(err){
        if (err) throw err;

    });

    if(req.session && req.session.loggedIn === true){
        req.session = null;
    }

    res.redirect("/");
});

// Redirects to route "/" if not on route "/"
app.use(function(req, res){

    res.redirect("/");

});

// Listen to connections
io.on("connection", function(socket){

    socket.on("joined_chat", function(userData){

        socket.handshake.session.userData = userData;

        console.log(socket.handshake.session);

    });

    // Let's get all the messages stored in database and send them to the newly connected user
    con.query("SELECT * FROM discussion", function (err, result) {

        if (err) throw err;

        socket.emit("all_messages", result);

    });

    // Listen to new message sent by a member
    socket.on("new_message", function(message){

        var date = new Date();
        var sqlDate = dateFormat(date, "yyyy-mm-dd'T'HH:MM:ss");

        var sql = "INSERT INTO discussion set ?";

        var toInsert = {pseudo : socket.pseudo, message: message, date: sqlDate};

        con.query(sql, toInsert, function(err, result){
           if(err) throw err;
        });

        var newMessage = {pseudo: socket.pseudo, message: message, date: sqlDate};

        socket.emit("new_message", newMessage);

        socket.broadcast.emit("new_message", newMessage);

    });

    socket.on("verify_username", function(username){

        username = ent.encode(username);

        /* Let's check also according to the session. Otherwise,
           the user cannot submit the form with their own pseudo
        */
        var sqlUsername;

        if(socket.handshake) {
            sqlUsername = "SELECT * FROM members WHERE username = " + mysql.escape(username) +
                          " AND NOT token = " + mysql.escape(req.session.token) + "";
        }
        else{
            sqlUsername = "SELECT * FROM members WHERE username = " + mysql.escape(username) + "";
        }

        con.query(sqlUsername, function(err, result){
            if (err) throw err;

            if (result.length > 0){
                socket.emit("verify_username", {used: true, pseudo: username});
            }
            else{
                socket.emit("verify_username", {used: false});
            }
        });
    });

    socket.on("disconnect", function(){

        var sqlUserConnectedStatus = "UPDATE members SET connected = false WHERE token = " +
                                      mysql.escape(sharedSession) + "";

        var sqlConnectedUsers = "SELECT * FROM members WHERE connected = true";

        con.query(sqlUserConnectedStatus, function(err){
            if (err) throw err;
        });

        con.query(sqlConnectedUsers, function(err, results){
            if (err) throw err;

            socket.broadcast.emit("connected_members", results);
        });

    })

});

server.listen(8000);
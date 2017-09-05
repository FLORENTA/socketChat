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

function checkSession(){

    if(typeof (session) !== "undefined" && session !== null) {
        if (session.loggedIn === true) {
            return true;
        }
    }
}

app.set("trust proxy", 1);

// Connexion to the database
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chat"
});

// Initialization
con.connect(function(err){
    if(err) throw err;
    console.log("connected !");
});

// To get static files in public folder
app.use(express.static(__dirname + "/public"));

// Session
app.use(session({secret : uniqid()}));

/* Homepage */
app.get("/", function(req, res){
    res.render("home.ejs", {path : req.path});
});

/* Renders the chat interface */
app.get("/chat", function(req, res){

    if(checkSession()){
        res.render("chat.ejs", {path: req.path, token: session.token, username: session.username});
    }
    else{
        res.redirect("/login");
    }

});

/* Page to create an account */
app.get("/account/create", function(req, res){
    res.render("register.ejs", {url : "/register/action", path : req.path});
});

/* Page to check account information */
app.get("/account/modify", function(req, res){

    if(checkSession()){

        var sql = "SELECT * FROM members WHERE token = " + mysql.escape(session.token);

        con.query(sql, function(err, result){
            if (err) throw err;

            if(result.length === 0){
                res.redirect("/myHome", {
                    path: req.path,
                    username: session.username
                });
            }
            else{

                res.render("register.ejs", {
                    path: req.path,
                    username: result[0].username,
                    name: result[0].nom,
                    firstname: result[0].prenom,
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

    var member = {
        nom: ent.encode(req.body.name),
        prenom: ent.encode(req.body.firstname),
        username: ent.encode(req.body.username),
        email: ent.encode(req.body.email),
        password: md5(ent.encode(req.body.password)),
        connected: false
    };

    var sql = "UPDATE members SET ? WHERE token = " + mysql.escape(session.token);

    con.query(sql, member, function(err, result){
        if (err) throw err;

        res.redirect("/account/modify");
    });

});

/* Treatment page if a user creates an account */
app.post("/register/action", urlencodedParser, function(req, res){

    var member = {
        nom: ent.encode(req.body.name),
        prenom: ent.encode(req.body.firstname),
        username: ent.encode(req.body.username),
        email: ent.encode(req.body.email),
        password: md5(ent.encode(req.body.password)),
        token: md5(uniqid()),
        connected: false
    };

    var sql = "INSERT INTO members SET ?";

    con.query(sql, member, function(err, result){
        if (err) throw err;
    });

    res.redirect("/login");

});

/* Login page to access personal interface & chat */
app.get("/login", function(req, res){
    res.render("login.ejs", {url : "/login", path : req.path});
});

/* User homepage */
app.get("/myHome", function(req, res){

    if(checkSession()){
        res.render("my_homepage.ejs", {path: req.path, username: session.username});
    }
    else{
        res.redirect("/login");
    }
});

/* Checking login & username */
app.post("/login", urlencodedParser, function(req, res){

    var username = ent.encode(req.body.username);
    var password = md5(ent.encode(req.body.password));

    var sql = "SELECT * FROM members WHERE username = " + mysql.escape(username) + " AND password = " + mysql.escape(password) + "";

    con.query(sql, function(err, result){
        if(err) throw err;

        if(result.length === 0){
            res.redirect("/login");
        }
        else{
            session.username = username;
            session.token = result[0].token;
            session.loggedIn = true;

            res.redirect("/myHome");
        }
    });
});

/* Logout */
app.get("/logout", function(req, res){

    if(typeof (session) !== "undefined" || session !== null){
        session = null;
    }

    res.redirect("/");
});

// Redirects to route "/" if not on route "/"
app.use(function(req, res, next){
    res.redirect("/");
});

// Listen to connections
io.on("connection", function(socket){

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

    socket.on("disconnect", function(){
        var index = connectedMembers.indexOf(socket.pseudo);
    });

});

server.listen(8000);
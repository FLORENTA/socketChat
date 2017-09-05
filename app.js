var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var ent = require('ent');
var io = require('socket.io').listen(server);
var dateFormat = require("dateformat");
var mysql = require("mysql");

// Array to store the pseudo of the user when they connect
var connectedMembers = [];

// Connexion to the database
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "chat"
});

// Initialization
con.connect(function(err){
    if(err) throw err;
    console.log("connected !");
});

// Css File
app.use(express.static(__dirname + "/public"));

app.get("/", function(req, res){
    res.render("home.ejs");
});

// Route "/"
app.get("/chat", function(req, res){
    res.render("index.ejs");
});

app.get("/account/create", function(req, res){
   res.render("register.ejs", {url : "/register/action"});
});

app.get("/login", function(req, res){
    res.render("login.ejs");
});


// Redirects to route "/" if not on route "/"
app.use(function(req, res, next){
    res.redirect("/");
});

// Listen to connections
io.on("connection", function(socket){

    // Let's get all the messages stored in database and send them to the newly connected user
    con.query("SELECT * FROM discussion", function (err, result, field) {
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

    // Listen to new member pseudo
    socket.on("pseudo", function(pseudo){

        socket.pseudo = ent.encode(pseudo);

        connectedMembers.push(socket.pseudo);

        socket.emit("connected_members", connectedMembers);

        socket.broadcast.emit("connected_members", connectedMembers);

    });

    socket.on("disconnect", function(){
        console.log(socket.pseudo);
        console.log(connectedMembers);

        var index = connectedMembers.indexOf(socket.pseudo);
    });

});

server.listen(8080);